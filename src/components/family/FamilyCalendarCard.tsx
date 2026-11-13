"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/useAuth";
import { fetchStructuredNotes } from "@/lib/supabase/familyMeta";
import type { FamilyNote, WeeklyEvent } from "@/lib/supabase/types";
import {
  clearCachedGoogleProviderToken,
  createGoogleCalendarEvent,
  fetchGoogleCalendarConfig,
  getCachedGoogleProviderToken,
  GOOGLE_CALENDAR_SCOPES,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  saveGoogleCalendarConfig,
  type GoogleCalendarConfig,
  type GoogleCalendarListItem,
} from "@/lib/google/calendarClient";
import { Card } from "@/components/ui/Card";

interface FamilyCalendarCardProps {
  propertyId: string | null;
  authorName: string;
  isAdmin: boolean;
  weeklyEvents?: WeeklyEvent[];
  onDataChanged?: () => Promise<void> | void;
}

interface CalendarItemPayload {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "event" | "holiday";
}

interface UnifiedCalendarItem {
  id: string;
  sourceType: "weekly_event" | "note";
  startDate: string;
  endDate: string;
  title: string;
  subtitle: string | null;
  kind: "event" | "holiday";
  origin: string | null;
}

const CALENDAR_PREFIX = "[CALENDAR:";

function parseCalendarNote(note: FamilyNote): UnifiedCalendarItem | null {
  if (!note.content.startsWith(CALENDAR_PREFIX)) return null;
  const jsonPart = note.content.slice(CALENDAR_PREFIX.length, -1);
  try {
    const parsed = JSON.parse(jsonPart) as Partial<CalendarItemPayload>;
    if (!parsed.date || !parsed.title) return null;
    return {
      id: note.id,
      sourceType: "note",
      startDate: parsed.date,
      endDate: parsed.date,
      title: parsed.title,
      subtitle: null,
      kind: parsed.kind === "holiday" ? "holiday" : "event",
      origin: "manual",
    };
  } catch {
    return null;
  }
}

function formatSwedishDate(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString("sv-SE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function subtractOneDayISO(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Family calendar & school holidays card backed by Supabase weekly_events (+ legacy notes)
 * with two-way Google Calendar sync via Google OAuth for Admins.
 */
export function FamilyCalendarCard({
  propertyId,
  authorName,
  isAdmin,
  weeklyEvents = [],
  onDataChanged,
}: FamilyCalendarCardProps) {
  const { session } = useAuth();
  const [noteItems, setNoteItems] = useState<UnifiedCalendarItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showGooglePanel, setShowGooglePanel] = useState(false);

  const [dateInput, setDateInput] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDateInput, setEndDateInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [kindInput, setKindInput] = useState<"event" | "holiday">("event");
  const [busy, setBusy] = useState(false);

  // Google Calendar state
  const [googleConfig, setGoogleConfig] = useState<GoogleCalendarConfig | null>(
    null,
  );
  const [googleCalendars, setGoogleCalendars] = useState<
    GoogleCalendarListItem[]
  >([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const googleToken = useMemo(
    () => getCachedGoogleProviderToken(session?.provider_token),
    [session?.provider_token],
  );

  const loadNoteItems = useCallback(async () => {
    if (!propertyId) {
      setNoteItems([]);
      return;
    }
    const raw = await fetchStructuredNotes(propertyId, CALENDAR_PREFIX);
    const today = new Date().toISOString().slice(0, 10);
    const parsed = raw
      .map(parseCalendarNote)
      .filter((item): item is UnifiedCalendarItem => item !== null)
      .filter((item) => item.endDate >= today);
    setNoteItems(parsed);
  }, [propertyId]);

  useEffect(() => {
    void loadNoteItems();
  }, [loadNoteItems]);

  useEffect(() => {
    let cancelled = false;
    void fetchGoogleCalendarConfig(propertyId).then((cfg) => {
      if (!cancelled) setGoogleConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    if (!isAdmin || !googleToken) return;
    let cancelled = false;
    void listGoogleCalendars(googleToken)
      .then((cals) => {
        if (cancelled) return;
        setGoogleCalendars(cals);
      })
      .catch(() => {
        // Token may have expired or calendar scope not granted
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, googleToken]);

  const combinedItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const fromWeekly: UnifiedCalendarItem[] = weeklyEvents
      .filter(
        (ev) =>
          (!propertyId || ev.property_id === propertyId) &&
          ev.category !== "waste" &&
          ev.end_date >= today,
      )
      .map((ev) => ({
        id: ev.id,
        sourceType: "weekly_event",
        startDate: ev.start_date,
        endDate: ev.end_date,
        title: ev.title,
        subtitle: ev.subtitle,
        kind: ev.category === "school_off" ? "holiday" : "event",
        origin: ev.source,
      }));

    return [...fromWeekly, ...noteItems].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
  }, [weeklyEvents, noteItems, propertyId]);

  if (!propertyId) return null;

  async function handleConnectGoogle() {
    const supabase = getSupabaseClient();
    if (!supabase || googleBusy) return;
    setGoogleBusy(true);
    setStatusMessage(null);

    try {
      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { error: linkErr } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          scopes: GOOGLE_CALENDAR_SCOPES,
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (linkErr) {
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            scopes: GOOGLE_CALENDAR_SCOPES,
            redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        if (oauthErr) {
          setStatusMessage(
            `Kunde inte starta Google-inloggning: ${oauthErr.message}`,
          );
        }
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Kunde inte ansluta till Google Kalender.",
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSelectCalendar(calendarId: string) {
    if (!propertyId || !calendarId) return;
    const cal = googleCalendars.find((c) => c.id === calendarId);
    const cfg: GoogleCalendarConfig = {
      calendarId,
      calendarSummary: cal?.summary ?? calendarId,
    };
    setGoogleConfig(cfg);
    await saveGoogleCalendarConfig(propertyId, cfg);
    setStatusMessage(`Valde gemensam kalender: ${cfg.calendarSummary}`);
  }

  async function handleImportFromGoogle() {
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !googleToken || !googleConfig || googleBusy) {
      return;
    }

    setGoogleBusy(true);
    setStatusMessage(null);
    try {
      const events = await listGoogleCalendarEvents(
        googleToken,
        googleConfig.calendarId,
        45,
      );

      // Replace previously synced Google Calendar events for this property
      await supabase
        .from("weekly_events")
        .delete()
        .eq("property_id", propertyId)
        .eq("source", "google_calendar");

      const rowsToInsert = events
        .filter((ev) => ev.summary && (ev.start?.date || ev.start?.dateTime))
        .map((ev) => {
          const startRaw = ev.start?.date ?? ev.start?.dateTime ?? "";
          const startDate = startRaw.slice(0, 10);

          let endDate = startDate;
          if (ev.end?.date) {
            // Google all-day end.date is exclusive
            const inclusive = subtractOneDayISO(ev.end.date);
            endDate = inclusive >= startDate ? inclusive : startDate;
          } else if (ev.end?.dateTime) {
            endDate = ev.end.dateTime.slice(0, 10);
          }

          let timeSub: string | null = googleConfig.calendarSummary;
          if (ev.start?.dateTime) {
            try {
              const t = new Date(ev.start.dateTime).toLocaleTimeString(
                "sv-SE",
                { hour: "2-digit", minute: "2-digit" },
              );
              timeSub = `kl ${t}`;
            } catch {
              // Keep calendar summary
            }
          }

          const titleLower = (ev.summary ?? "").toLowerCase();
          const isHoliday =
            titleLower.includes("lov") ||
            titleLower.includes("ledig") ||
            titleLower.includes("studiedag");

          return {
            property_id: propertyId,
            profile_id: null,
            category: isHoliday ? "school_off" : "calendar",
            title: ev.summary ?? "Händelse",
            subtitle: timeSub,
            start_date: startDate,
            end_date: endDate,
            source: "google_calendar",
          };
        });

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from("weekly_events")
          .insert(rowsToInsert);
        if (error) throw error;
      }

      await onDataChanged?.();
      setStatusMessage(
        `Hämtade ${rowsToInsert.length} händelser från ${googleConfig.calendarSummary}.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Kunde inte hämta från Google.";
      if (msg.includes("401")) {
        clearCachedGoogleProviderToken();
        setStatusMessage(
          "Google-sessionen har gått ut. Klicka på 'Förnya Google-koppling'.",
        );
      } else {
        setStatusMessage(msg);
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handlePushHolidaysToGoogle() {
    if (!propertyId || !googleToken || !googleConfig || googleBusy) return;
    setGoogleBusy(true);
    setStatusMessage(null);
    try {
      const existingGoogle = await listGoogleCalendarEvents(
        googleToken,
        googleConfig.calendarId,
        120,
      );
      const existingKeys = new Set(
        existingGoogle.map(
          (e) =>
            `${(e.summary ?? "").trim().toLowerCase()}|${(
              e.start?.date ??
              e.start?.dateTime ??
              ""
            ).slice(0, 10)}`,
        ),
      );

      const holidays = combinedItems.filter((item) => item.kind === "holiday");
      let pushed = 0;

      for (const h of holidays) {
        const key = `${h.title.trim().toLowerCase()}|${h.startDate}`;
        if (existingKeys.has(key)) continue;
        await createGoogleCalendarEvent(googleToken, googleConfig.calendarId, {
          title: h.title,
          startDate: h.startDate,
          endDate: h.endDate,
          description: h.subtitle
            ? `Skollov / ledig dag (${h.subtitle}) – Almvägen Family Hub`
            : "Skollov / ledig dag – Almvägen Family Hub",
        });
        pushed += 1;
      }

      setStatusMessage(
        pushed > 0
          ? `Skickade ${pushed} lovdagar/lediga dagar till ${googleConfig.calendarSummary}!`
          : "Alla lovdagar finns redan i er Google Kalender.",
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Kunde inte skicka lovdagar.";
      if (msg.includes("401")) {
        clearCachedGoogleProviderToken();
      }
      setStatusMessage(msg);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !titleInput.trim() || !dateInput || busy) {
      return;
    }
    setBusy(true);
    setStatusMessage(null);

    const title = titleInput.trim();
    const startDate = dateInput;
    const endDate =
      endDateInput && endDateInput >= startDate ? endDateInput : startDate;

    const { error } = await supabase.from("weekly_events").insert({
      property_id: propertyId,
      profile_id: null,
      category: kindInput === "holiday" ? "school_off" : "calendar",
      title,
      subtitle: authorName ? `Av ${authorName}` : null,
      start_date: startDate,
      end_date: endDate,
      source: "manual",
    });

    if (!error) {
      // If Admin has an active Google Calendar connection, mirror to shared Google Calendar
      if (isAdmin && googleToken && googleConfig) {
        try {
          await createGoogleCalendarEvent(
            googleToken,
            googleConfig.calendarId,
            {
              title,
              startDate,
              endDate,
              description: `Tillagd av ${authorName} via Almvägen Family Hub`,
            },
          );
          setStatusMessage(
            `Sparad i hubben och i ${googleConfig.calendarSummary}!`,
          );
        } catch {
          setStatusMessage(
            "Sparad i hubben, men Google-kopplingen behöver förnyas för att synka.",
          );
        }
      }

      setTitleInput("");
      setEndDateInput("");
      setShowForm(false);
      await onDataChanged?.();
    }
    setBusy(false);
  }

  async function handleDelete(item: UnifiedCalendarItem) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (item.sourceType === "note") {
      setNoteItems((prev) => prev.filter((n) => n.id !== item.id));
      await supabase.from("family_notes").delete().eq("id", item.id);
    } else {
      await supabase.from("weekly_events").delete().eq("id", item.id);
      await onDataChanged?.();
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Familjekalender &amp; Lovdagar
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {googleConfig
                  ? `Gemensam kalender: ${googleConfig.calendarSummary}`
                  : "Visar lovdagar, lediga dagar & familjehändelser"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowGooglePanel((prev) => !prev)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  googleConfig && googleToken
                    ? "border-[#6B8E6B]/45 bg-[#6B8E6B]/12 text-[#6B8E6B]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[#6B8E6B] hover:text-[var(--text-primary)]"
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Google</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Händelse</span>
            </button>
          </div>
        </div>

        {/* Admin Google Calendar panel */}
        {isAdmin && showGooglePanel && (
          <div className="space-y-3 rounded-xl border border-[#6B8E6B]/35 bg-[#6B8E6B]/8 p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[var(--text-primary)]">
                Google Kalender-koppling (Admin)
              </span>
              <button
                type="button"
                disabled={googleBusy}
                onClick={() => void handleConnectGoogle()}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#6B8E6B] px-3 text-xs font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50"
              >
                {googleBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                <span>
                  {googleToken
                    ? "Google ansluten"
                    : "Logga in med Google & koppla"}
                </span>
              </button>
            </div>

            {googleToken && googleCalendars.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                  Välj gemensam familjekalender:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={googleConfig?.calendarId ?? ""}
                    onChange={(e) => void handleSelectCalendar(e.target.value)}
                    className="min-h-9 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                  >
                    <option value="">Välj Google Kalender…</option>
                    {googleCalendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}
                        {cal.primary ? " (Primär)" : ""}
                      </option>
                    ))}
                  </select>

                  {googleConfig && (
                    <>
                      <button
                        type="button"
                        disabled={googleBusy}
                        onClick={() => void handleImportFromGoogle()}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#6B8E6B]/45 bg-[var(--bg-card)] px-3 font-semibold text-[#6B8E6B] hover:bg-[#6B8E6B]/10 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Hämta</span>
                      </button>
                      <button
                        type="button"
                        disabled={googleBusy}
                        onClick={() => void handlePushHolidaysToGoogle()}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#D49A42]/45 bg-[var(--bg-card)] px-3 font-semibold text-[#D49A42] hover:bg-[#D49A42]/10 disabled:opacity-50"
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>Skicka lovdagar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {!googleToken && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Logga in med Google för att välja er gemensamma familjekalender,
                hämta händelser till surfplattorna och automatiskt skicka nya
                händelser &amp; barnens lovdagar dit.
              </p>
            )}
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-[#6B8E6B]/40 bg-[#6B8E6B]/10 px-3 py-2 text-xs text-[var(--text-primary)]">
            <Check className="h-3.5 w-3.5 shrink-0 text-[#6B8E6B]" />
            <span>{statusMessage}</span>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="date"
                required
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                aria-label="Startdatum"
                className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <input
                type="date"
                value={endDateInput}
                min={dateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                aria-label="Valfritt slutdatum"
                title="Valfritt slutdatum"
                className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <select
                value={kindInput}
                onChange={(e) =>
                  setKindInput(e.target.value === "holiday" ? "holiday" : "event")
                }
                className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              >
                <option value="event">Familjehändelse</option>
                <option value="holiday">Skollov / Ledig dag</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="T.ex. Fotbollsträning eller Höstlov"
                className="min-h-10 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !titleInput.trim()}
                className="min-h-10 rounded-lg bg-[#6B8E6B] px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-45"
              >
                {busy ? "Sparar…" : "Spara"}
              </button>
            </div>
            {isAdmin && googleToken && googleConfig && (
              <p className="text-[11px] text-[#6B8E6B]">
                Synkas automatiskt till {googleConfig.calendarSummary}
              </p>
            )}
          </form>
        )}

        {combinedItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-5 text-center text-xs text-[var(--text-secondary)]">
            Inga kommande händelser eller lovdagar inlagda ännu.
          </p>
        ) : (
          <ul className="space-y-2">
            {combinedItems.slice(0, 8).map((item) => {
              const isToday =
                item.startDate <= todayStr && item.endDate >= todayStr;
              const isHoliday = item.kind === "holiday";
              const dateRangeLabel = isToday
                ? "Idag"
                : item.endDate > item.startDate
                  ? `${formatSwedishDate(item.startDate)} – ${formatSwedishDate(
                      item.endDate,
                    )}`
                  : formatSwedishDate(item.startDate);

              return (
                <li
                  key={item.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    isHoliday
                      ? "border-[#D49A42]/40 bg-[#D49A42]/10"
                      : isToday
                        ? "border-[#6B8E6B]/45 bg-[#6B8E6B]/10"
                        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="tabular-nums text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        {dateRangeLabel}
                      </span>
                      {isHoliday && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D49A42]/20 px-2 py-0.5 text-[10px] font-semibold text-[#D49A42]">
                          <Sparkles className="h-2.5 w-2.5" />
                          Lovdag
                        </span>
                      )}
                      {item.origin === "google_calendar" && (
                        <span className="rounded-full bg-[#6B8E6B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#6B8E6B]">
                          Google
                        </span>
                      )}
                    </div>
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="truncate text-[11px] text-[var(--text-secondary)]">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      aria-label={`Ta bort ${item.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[#C86D51]/15 hover:text-[#C86D51]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
