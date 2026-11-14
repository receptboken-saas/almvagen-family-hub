"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  Repeat,
  Settings2,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { HouseholdSettings, WeeklyEvent } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface WasteScheduleCardProps {
  propertyId: string | null;
  weeklyEvents: WeeklyEvent[];
  householdSettings: HouseholdSettings | null;
  onDataChanged?: () => Promise<void> | void;
}

interface SyncWasteResponse {
  message?: string;
  synced_count?: number;
  events_count?: number;
  error?: string;
}

type RollingIntervalDays = 7 | 14 | 28;

const BIN_PRESETS = [
  "Kärl 1 (Mat- & Restavfall)",
  "Kärl 2 (Förpackningar)",
  "Trädgårdsavfall",
] as const;

const INTERVAL_OPTIONS: ReadonlyArray<{
  days: RollingIntervalDays;
  label: string;
}> = [
  { days: 14, label: "Varannan vecka (var 14:e dag)" },
  { days: 28, label: "Var 4:e vecka (var 28:e dag)" },
  { days: 7, label: "Varje vecka (var 7:e dag)" },
];

const ROLLING_WEEKS = 26;

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDaysFromToday(dateStr: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatShortDate(dateStr: string): string {
  try {
    const formatted = new Date(`${dateStr.slice(0, 10)}T12:00:00`).toLocaleDateString(
      "sv-SE",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
      },
    );
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateStr;
  }
}

async function extractFunctionError(err: unknown): Promise<string> {
  if (!err || typeof err !== "object") {
    return "Kunde inte hämta sophämtningsschema just nu.";
  }
  const record = err as { message?: string; context?: Response };
  if (record.context && typeof record.context.json === "function") {
    try {
      const payload = (await record.context.clone().json()) as {
        error?: string;
        message?: string;
      };
      if (payload.error) return payload.error;
      if (payload.message) return payload.message;
    } catch {
      // Ignore JSON parse errors
    }
  }
  return record.message || "Kunde inte hämta sophämtningsschema just nu.";
}

/**
 * Smart waste collection card with municipality + bin configuration,
 * Gemini schedule sync (`sync_waste_schedule`), manual fallback,
 * and automatic 0/1/2-day pickup reminders.
 */
export function WasteScheduleCard({
  propertyId,
  weeklyEvents,
  householdSettings,
  onDataChanged,
}: WasteScheduleCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [municipalityInput, setMunicipalityInput] = useState(
    householdSettings?.municipality ?? "",
  );
  const [areaInput, setAreaInput] = useState(
    householdSettings?.address_area ?? "",
  );
  const [manualTitle, setManualTitle] = useState("");
  const [manualDate, setManualDate] = useState(() => getTodayIsoDate());
  const [rollingBinName, setRollingBinName] = useState<string>(BIN_PRESETS[0]);
  const [rollingAnchorDate, setRollingAnchorDate] = useState(() =>
    getTodayIsoDate(),
  );
  const [rollingIntervalDays, setRollingIntervalDays] =
    useState<RollingIntervalDays>(14);
  const [generatingRolling, setGeneratingRolling] = useState(false);
  const [clearingUpcoming, setClearingUpcoming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMunicipalityInput(householdSettings?.municipality ?? "");
    setAreaInput(householdSettings?.address_area ?? "");
  }, [householdSettings?.municipality, householdSettings?.address_area]);

  const upcomingPickups = useMemo(() => {
    if (!propertyId) return [];
    return weeklyEvents
      .filter((ev) => ev.property_id === propertyId && ev.category === "waste")
      .map((ev) => ({
        event: ev,
        diffDays: diffDaysFromToday(ev.start_date),
      }))
      .filter((item) => item.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 4);
  }, [weeklyEvents, propertyId]);

  if (!propertyId) return null;

  async function handleGenerateRollingSchedule(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const cleanBinName = rollingBinName.trim();
    if (
      !supabase ||
      !propertyId ||
      !cleanBinName ||
      !rollingAnchorDate ||
      generatingRolling
    ) {
      return;
    }

    setGeneratingRolling(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const todayStr = getTodayIsoDate();
      const { error: deleteError } = await supabase
        .from("weekly_events")
        .delete()
        .eq("property_id", propertyId)
        .eq("category", "waste")
        .eq("title", cleanBinName)
        .gte("start_date", todayStr);

      if (deleteError) {
        setErrorMessage(deleteError.message);
        return;
      }

      const subtitle =
        municipalityInput.trim() ||
        householdSettings?.municipality?.trim() ||
        null;

      const totalDays = ROLLING_WEEKS * 7;
      const rows: Array<{
        property_id: string;
        profile_id: null;
        category: "waste";
        title: string;
        subtitle: string | null;
        start_date: string;
        end_date: string;
        source: "rolling_schedule";
      }> = [];

      for (
        let offset = 0;
        offset <= totalDays;
        offset += rollingIntervalDays
      ) {
        const pickupDate = addDaysToIsoDate(rollingAnchorDate, offset);
        rows.push({
          property_id: propertyId,
          profile_id: null,
          category: "waste",
          title: cleanBinName,
          subtitle,
          start_date: pickupDate,
          end_date: pickupDate,
          source: "rolling_schedule",
        });
      }

      const { error: insertError } = await supabase
        .from("weekly_events")
        .insert(rows);

      if (insertError) {
        setErrorMessage(insertError.message);
        return;
      }

      setStatusMessage(
        `${rows.length} exakta tömningar skapade för ${cleanBinName} (var ${rollingIntervalDays}:e dag).`,
      );
      if (onDataChanged) await onDataChanged();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Kunde inte generera rullande schema.",
      );
    } finally {
      setGeneratingRolling(false);
    }
  }

  async function handleClearAllUpcoming() {
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || clearingUpcoming) return;

    setClearingUpcoming(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const todayStr = getTodayIsoDate();
      const { error } = await supabase
        .from("weekly_events")
        .delete()
        .eq("property_id", propertyId)
        .eq("category", "waste")
        .gte("start_date", todayStr);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage("Alla kommande tömningar har rensats.");
      if (onDataChanged) await onDataChanged();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Kunde inte rensa kommande tömningar.",
      );
    } finally {
      setClearingUpcoming(false);
    }
  }

  async function handleGeminiSync(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const cleanMunicipality = municipalityInput.trim();
    if (!supabase || !propertyId || !cleanMunicipality || syncing) return;

    setSyncing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { data, error } =
        await supabase.functions.invoke<SyncWasteResponse>(
          "gemini-hub-assistant",
          {
            body: {
              action: "sync_waste_schedule",
              property_id: propertyId,
              payload: {
                municipality: cleanMunicipality,
                area_or_bins: areaInput.trim() || null,
              },
            },
          },
        );

      if (error) {
        setErrorMessage(await extractFunctionError(error));
      } else if (data?.error) {
        setErrorMessage(data.error);
      } else {
        const count = data?.synced_count ?? data?.events_count;
        setStatusMessage(
          data?.message ||
            (typeof count === "number"
              ? `Sophämtningsschema synkat (${count} tömningar)`
              : "Sophämtningsschemat är uppdaterat med Gemini"),
        );
        setShowSettings(false);
        if (onDataChanged) await onDataChanged();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Fel vid hämtning av schema.",
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleManualAdd(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const title = manualTitle.trim();
    if (!supabase || !propertyId || !title || !manualDate || savingManual) {
      return;
    }

    setSavingManual(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.from("weekly_events").insert({
      property_id: propertyId,
      profile_id: null,
      category: "waste",
      title,
      subtitle: householdSettings?.municipality ?? null,
      start_date: manualDate,
      end_date: manualDate,
      source: "manual",
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setManualTitle("");
      setShowManualForm(false);
      setStatusMessage("Tömning tillagd");
      if (onDataChanged) await onDataChanged();
    }
    setSavingManual(false);
  }

  async function handleDelete(eventId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("weekly_events")
      .delete()
      .eq("id", eventId);
    if (!error && onDataChanged) {
      await onDataChanged();
    }
  }

  const savedMunicipality = householdSettings?.municipality?.trim();

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C86D51]/15 text-[#C86D51]">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Sophämtning
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {savedMunicipality
                  ? `${savedMunicipality} · Påminnelse 1–2 dagar innan`
                  : "Påminnelse 1–2 dagar före tömning"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSettings((prev) => !prev);
              setErrorMessage(null);
            }}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
          >
            <Settings2 className="h-3.5 w-3.5 text-[#6B8E6B]" aria-hidden="true" />
            <span>Ställ in kommun &amp; kärl</span>
          </button>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-[#6B8E6B]/30 bg-[#6B8E6B]/12 px-3.5 py-2 text-xs font-medium text-[#6B8E6B]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-3.5 py-2 text-xs text-[#C86D51]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {showSettings && (
          <div className="space-y-3">
            <form
              onSubmit={handleGenerateRollingSchedule}
              className="space-y-3 rounded-2xl border border-[#6B8E6B]/35 bg-[#6B8E6B]/8 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Repeat
                    className="h-4 w-4 shrink-0 text-[#6B8E6B]"
                    aria-hidden="true"
                  />
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                    Skapa rullande kärl-schema (100 % exakt)
                  </h4>
                </div>
                <span className="rounded-full bg-[#6B8E6B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#6B8E6B]">
                  26 veckor
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Kärl / Tunna
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BIN_PRESETS.map((preset) => {
                    const active = rollingBinName === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRollingBinName(preset)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[#6B8E6B] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="rolling-bin-name"
                  type="text"
                  required
                  value={rollingBinName}
                  onChange={(e) => setRollingBinName(e.target.value)}
                  placeholder="T.ex. Kärl 1 (Mat- & Restavfall)"
                  className="min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="rolling-anchor-date"
                    className="block text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    Nästa kända tömningsdatum
                  </label>
                  <input
                    id="rolling-anchor-date"
                    type="date"
                    required
                    value={rollingAnchorDate}
                    onChange={(e) => setRollingAnchorDate(e.target.value)}
                    className="min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="rolling-interval"
                    className="block text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    Intervall
                  </label>
                  <select
                    id="rolling-interval"
                    value={rollingIntervalDays}
                    onChange={(e) =>
                      setRollingIntervalDays(
                        Number(e.target.value) as RollingIntervalDays,
                      )
                    }
                    className="min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <button
                  type="submit"
                  disabled={
                    generatingRolling ||
                    !rollingBinName.trim() ||
                    !rollingAnchorDate
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {generatingRolling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Genererar…</span>
                    </>
                  ) : (
                    <>
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>Generera kommande 6 månader</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClearAllUpcoming}
                  disabled={clearingUpcoming || upcomingPickups.length === 0}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C86D51]/40 bg-[var(--bg-card)] px-3 text-xs font-medium text-[#C86D51] transition-colors hover:bg-[#C86D51]/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {clearingUpcoming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Rensar…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Rensa alla kommande tömningar</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <form
              onSubmit={handleGeminiSync}
              className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 p-3.5"
            >
              <div className="space-y-1">
                <label
                  htmlFor="waste-municipality"
                  className="block text-[11px] font-semibold text-[var(--text-secondary)]"
                >
                  Kommun
                </label>
                <input
                  id="waste-municipality"
                  type="text"
                  required
                  value={municipalityInput}
                  onChange={(e) => setMunicipalityInput(e.target.value)}
                  placeholder="T.ex. Svedala kommun"
                  className="min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="waste-area-bins"
                  className="block text-[11px] font-semibold text-[var(--text-secondary)]"
                >
                  Område / Kärl / Nästa tömningsdag (valfritt för AI-synk)
                </label>
                <textarea
                  id="waste-area-bins"
                  rows={2}
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="T.ex. Klågerup – Fyrfack 1 (Mat/Rest) tisdagar udda veckor, Fyrfack 2 var 4:e vecka"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={syncing || !municipalityInput.trim()}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Hämtar schema…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-[#D49A42]" />
                      <span>Hämta schema med Gemini</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualForm((prev) => !prev)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Lägg till enstaka tömning</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {showManualForm && (
          <form
            onSubmit={handleManualAdd}
            className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3"
          >
            <input
              type="text"
              required
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="T.ex. Kärl 1 (Mat- & Restavfall)"
              className="min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="min-h-10 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingManual || !manualTitle.trim()}
                className="min-h-10 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-45"
              >
                {savingManual ? "Sparar…" : "Spara"}
              </button>
            </div>
          </form>
        )}

        {upcomingPickups.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center">
            <p className="text-xs text-[var(--text-secondary)]">
              Inget sophämtningsschema inlagt ännu.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#6B8E6B] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>Ställ in kommun &amp; kärl</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManualForm((prev) => !prev)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Lägg till enstaka tömning</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-2">
              {upcomingPickups.map(({ event, diffDays }) => {
                const isToday = diffDays === 0;
                const isTomorrow = diffDays === 1;
                const isTwoDays = diffDays === 2;

                let containerStyle =
                  "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40";
                let badgeStyle =
                  "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]";
                let badgeText = formatShortDate(event.start_date);

                if (isToday) {
                  containerStyle =
                    "border-[#C86D51]/60 bg-[#C86D51]/15 ring-1 ring-[#C86D51]/30";
                  badgeStyle = "bg-[#C86D51] text-white";
                  badgeText = "Töms idag!";
                } else if (isTomorrow) {
                  containerStyle =
                    "border-[#C86D51]/45 bg-gradient-to-r from-[#C86D51]/12 to-[#D49A42]/12";
                  badgeStyle = "bg-[#C86D51] text-white";
                  badgeText = "Imorgon – ställ ut tunnan!";
                } else if (isTwoDays) {
                  containerStyle = "border-[#D49A42]/50 bg-[#D49A42]/12";
                  badgeStyle = "bg-[#D49A42] text-white";
                  badgeText = "Om 2 dagar";
                }

                return (
                  <li
                    key={event.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors ${containerStyle}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {isToday && (
                        <Truck
                          className="h-4 w-4 shrink-0 animate-pulse text-[#C86D51]"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {event.title}
                        </p>
                        <p className="tabular-nums text-[11px] text-[var(--text-secondary)]">
                          {formatShortDate(event.start_date)}
                          {event.subtitle ? ` · ${event.subtitle}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`tabular-nums rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeStyle}`}
                      >
                        {badgeText}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(event.id)}
                        aria-label={`Ta bort ${event.title}`}
                        title="Ta bort"
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[#C86D51]/15 hover:text-[#C86D51]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {!showSettings && (
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowManualForm((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[#6B8E6B]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Lägg till enstaka tömning</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
