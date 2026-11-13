"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  Pencil,
  Pin,
  Sparkles,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSystemFamilyNote } from "@/lib/supabase/familyMeta";
import { getCurrentWeekBounds } from "@/lib/supabase/useHomeData";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type {
  DinnerPlan,
  FamilyNote,
  HouseholdSettings,
  WeeklyEvent,
} from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface HappeningTodayCardProps {
  propertyId: string | null;
  dinnerPlans: DinnerPlan[];
  weeklyEvents: WeeklyEvent[];
  householdSettings?: HouseholdSettings | null;
  isAdmin?: boolean;
  onDataChanged: () => Promise<void> | void;
  onSelectFamilyView?: () => void;
}

function addDaysISO(baseIso: string, days: number): string {
  const date = new Date(`${baseIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTodayLabel(isoDate: string): string {
  try {
    const raw = new Date(`${isoDate}T12:00:00`).toLocaleDateString("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return isoDate;
  }
}

/**
 * Wall-tablet & hub overview widget: "Händer idag"
 * Combines today's dinner ("Vad blir det till middag idag?"), today's events,
 * tomorrow's waste-bin reminder, and pinned family notes.
 */
export function HappeningTodayCard({
  propertyId,
  dinnerPlans,
  weeklyEvents,
  householdSettings,
  isAdmin = false,
  onDataChanged,
  onSelectFamilyView,
}: HappeningTodayCardProps) {
  const { isConnected, getEntity } = useHomeAssistant();
  const [pinnedNotes, setPinnedNotes] = useState<FamilyNote[]>([]);
  const [isEditingDinner, setIsEditingDinner] = useState(false);
  const [draftDish, setDraftDish] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { todayStr, tomorrowStr, todayLabel } = useMemo(() => {
    const { todayStr: tStr } = getCurrentWeekBounds();
    return {
      todayStr: tStr,
      tomorrowStr: addDaysISO(tStr, 1),
      todayLabel: formatTodayLabel(tStr),
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId) {
      setPinnedNotes([]);
      return;
    }

    let cancelled = false;
    void supabase
      .from("family_notes")
      .select(
        "id, property_id, author_id, author_name, content, is_pinned, is_done, note_color, target_profile_id, target_name, created_at",
      )
      .eq("property_id", propertyId)
      .eq("is_done", false)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const visible = (data as FamilyNote[])
          .filter((n) => !isSystemFamilyNote(n.content))
          .slice(0, 3);
        setPinnedNotes(visible);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId, dinnerPlans, weeklyEvents]);

  const todayPlan = useMemo(
    () =>
      dinnerPlans.find(
        (p) =>
          (!propertyId || p.property_id === propertyId) &&
          p.meal_date === todayStr,
      ) ?? null,
    [dinnerPlans, propertyId, todayStr],
  );

  const { todayEvents, tomorrowWaste, haWasteText } = useMemo(() => {
    const scoped = weeklyEvents.filter(
      (ev) => !propertyId || ev.property_id === propertyId,
    );

    const todayList = scoped.filter(
      (ev) => ev.start_date <= todayStr && ev.end_date >= todayStr,
    );

    const nextDayWaste = scoped.filter(
      (ev) => ev.category === "waste" && ev.start_date === tomorrowStr,
    );

    let wasteText: string | null = null;
    const wasteEntityId = householdSettings?.waste_ha_entity_id;
    if (isConnected && wasteEntityId) {
      const entity = getEntity(wasteEntityId);
      if (
        entity &&
        entity.state &&
        entity.state !== "unavailable" &&
        entity.state !== "unknown" &&
        entity.state !== "none" &&
        entity.state !== "off"
      ) {
        const label = entity.attributes.friendly_name ?? "Sophämtning";
        wasteText = `${label}: ${entity.state}`;
      }
    }

    return {
      todayEvents: todayList,
      tomorrowWaste: nextDayWaste,
      haWasteText: wasteText,
    };
  }, [
    weeklyEvents,
    propertyId,
    todayStr,
    tomorrowStr,
    householdSettings,
    isConnected,
    getEntity,
  ]);

  if (!propertyId) return null;

  async function saveTodayDinner(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || busy) return;

    setBusy(true);
    const dish = draftDish.trim();
    const notes = draftNotes.trim() || null;
    const url = draftUrl.trim() || null;

    if (!dish) {
      if (todayPlan) {
        await supabase.from("dinner_plans").delete().eq("id", todayPlan.id);
      }
    } else if (todayPlan) {
      await supabase
        .from("dinner_plans")
        .update({
          dish_name: dish,
          recipe_url: url,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", todayPlan.id);
    } else {
      await supabase.from("dinner_plans").insert({
        property_id: propertyId,
        meal_date: todayStr,
        dish_name: dish,
        recipe_url: url,
        notes,
      });
    }

    setIsEditingDinner(false);
    await onDataChanged();
    setBusy(false);
  }

  const hasEvents =
    todayEvents.length > 0 ||
    tomorrowWaste.length > 0 ||
    Boolean(haWasteText) ||
    pinnedNotes.length > 0;

  return (
    <Card className="space-y-3.5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D49A42]/18 text-[#D49A42]">
            <CalendarDays className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Händer idag
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">{todayLabel}</p>
          </div>
        </div>

        {onSelectFamilyView && (
          <button
            type="button"
            onClick={onSelectFamilyView}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B] hover:text-[var(--text-primary)]"
          >
            <span>Veckan &amp; mat</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Today's dinner highlight */}
      {isAdmin && isEditingDinner ? (
        <form
          onSubmit={saveTodayDinner}
          className="space-y-2 rounded-xl border border-[#6B8E6B]/45 bg-[#6B8E6B]/10 p-3"
        >
          <div className="flex items-center gap-2">
            <UtensilsCrossed
              className="h-4 w-4 shrink-0 text-[#6B8E6B]"
              aria-hidden="true"
            />
            <input
              type="text"
              autoFocus
              value={draftDish}
              onChange={(e) => setDraftDish(e.target.value)}
              placeholder="Vad blir det till middag idag?"
              className="min-h-9 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Spara dagens middag"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B8E6B] text-white"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingDinner(false)}
              aria-label="Avbryt"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Valfri anteckning…"
              className="min-h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-[11px] text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="Valfri receptlänk (https://…)"
              className="min-h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-[11px] text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#6B8E6B]/35 bg-[#6B8E6B]/10 px-3.5 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <UtensilsCrossed
              className="mt-0.5 h-4 w-4 shrink-0 text-[#6B8E6B]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B8E6B]">
                Vad blir det till middag idag?
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {todayPlan?.dish_name || "Ej planerat ännu"}
              </p>
              {todayPlan?.notes && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {todayPlan.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {todayPlan?.recipe_url && (
              <a
                href={todayPlan.recipe_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#6B8E6B]/35 bg-[var(--bg-card)] px-2.5 py-1 text-xs font-semibold text-[#6B8E6B] hover:underline"
              >
                <span>Recept</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setDraftDish(todayPlan?.dish_name ?? "");
                  setDraftNotes(todayPlan?.notes ?? "");
                  setDraftUrl(todayPlan?.recipe_url ?? "");
                  setIsEditingDinner(true);
                }}
                aria-label="Planera dagens middag"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Today's important events, waste reminders & pinned notes */}
      {hasEvents ? (
        <div className="flex flex-wrap gap-2">
          {todayEvents.map((ev) => {
            const isWaste = ev.category === "waste";
            const isHoliday = ev.category === "school_off";
            const pillClass = isWaste
              ? "border-[#C86D51]/40 bg-[#C86D51]/12 text-[#C86D51]"
              : isHoliday
                ? "border-[#6B8E6B]/40 bg-[#6B8E6B]/14 text-[#6B8E6B]"
                : "border-[#D49A42]/40 bg-[#D49A42]/14 text-[#D49A42]";

            return (
              <span
                key={ev.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${pillClass}`}
              >
                {isWaste ? (
                  <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : isHoliday ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CalendarDays
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{isWaste ? `${ev.title} idag!` : ev.title}</span>
                {ev.subtitle && (
                  <span className="opacity-80">· {ev.subtitle}</span>
                )}
              </span>
            );
          })}

          {tomorrowWaste.map((ev) => (
            <span
              key={`tm-${ev.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#C86D51]/40 bg-[#C86D51]/10 px-3 py-1.5 text-xs font-semibold text-[#C86D51]"
            >
              <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Imorgon: {ev.title} – ställ ut tunnan!</span>
            </span>
          ))}

          {haWasteText && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C86D51]/40 bg-[#C86D51]/12 px-3 py-1.5 text-xs font-semibold text-[#C86D51]">
              <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{haWasteText}</span>
            </span>
          )}

          {pinnedNotes.map((note) => (
            <span
              key={note.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
            >
              <Pin
                className="h-3 w-3 shrink-0 text-[#C86D51]"
                aria-hidden="true"
              />
              {note.target_name && (
                <span className="font-semibold text-[#C86D51]">
                  {note.target_name}:
                </span>
              )}
              <span className="max-w-[260px] truncate">{note.content}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-secondary)]">
          Inga särskilda händelser eller påminnelser inlagda för idag.
        </p>
      )}
    </Card>
  );
}
