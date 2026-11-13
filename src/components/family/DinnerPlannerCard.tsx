"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Pencil,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentWeekBounds } from "@/lib/supabase/useHomeData";
import type { DinnerPlan } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface DinnerPlannerCardProps {
  propertyId: string | null;
  dinnerPlans: DinnerPlan[];
  onDataChanged: () => Promise<void> | void;
  canEdit?: boolean;
}

const WEEKDAY_NAMES = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];

function addDaysISO(baseIso: string, days: number): string {
  const date = new Date(`${baseIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * KISS "Vad blir det till middag?" card:
 * - Default view: max 2 rows (Today & Tomorrow) with clickable recipe_url if set.
 * - Expanded view: Mon-Sun of the current week saved directly to Supabase dinner_plans.
 */
export function DinnerPlannerCard({
  propertyId,
  dinnerPlans,
  onDataChanged,
  canEdit = true,
}: DinnerPlannerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draftDish, setDraftDish] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { todayStr, tomorrowStr, weekDays } = useMemo(() => {
    const { todayStr: tStr, mondayStr } = getCurrentWeekBounds();
    const tmStr = addDaysISO(tStr, 1);
    const days = WEEKDAY_NAMES.map((label, idx) => ({
      label,
      date: addDaysISO(mondayStr, idx),
    }));
    return { todayStr: tStr, tomorrowStr: tmStr, weekDays: days };
  }, []);

  const planByDate = useMemo(() => {
    const map = new Map<string, DinnerPlan>();
    for (const plan of dinnerPlans) {
      if (!propertyId || plan.property_id === propertyId) {
        map.set(plan.meal_date, plan);
      }
    }
    return map;
  }, [dinnerPlans, propertyId]);

  if (!propertyId) return null;

  const todayPlan = planByDate.get(todayStr);
  const tomorrowPlan = planByDate.get(tomorrowStr);

  async function saveDayMeal(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !editingDate || busy) return;

    setBusy(true);
    const existing = planByDate.get(editingDate);
    const dish = draftDish.trim();
    const url = draftUrl.trim() || null;

    if (!dish) {
      if (existing) {
        await supabase.from("dinner_plans").delete().eq("id", existing.id);
      }
    } else if (existing) {
      await supabase
        .from("dinner_plans")
        .update({
          dish_name: dish,
          recipe_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("dinner_plans").insert({
        property_id: propertyId,
        meal_date: editingDate,
        dish_name: dish,
        recipe_url: url,
      });
    }

    setEditingDate(null);
    setDraftDish("");
    setDraftUrl("");
    await onDataChanged();
    setBusy(false);
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D49A42]/18 text-[#D49A42]">
            <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)] sm:text-lg">
            Vad blir det till middag?
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
        >
          {canEdit && <Pencil className="h-3 w-3 text-[#6B8E6B]" />}
          <span>Veckans mat</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Default KISS view: max 2 rows (Today & Tomorrow) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#6B8E6B]/35 bg-[#6B8E6B]/10 px-3.5 py-2.5 text-sm">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B8E6B]">
              Idag:{" "}
            </span>
            <span className="font-semibold text-[var(--text-primary)]">
              {todayPlan?.dish_name || "Ej planerat"}
            </span>
          </div>
          {todayPlan?.recipe_url && (
            <a
              href={todayPlan.recipe_url}
              target="_blank"
              rel="noreferrer"
              aria-label="Öppna recept för idag"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6B8E6B] hover:underline"
            >
              <span>Recept</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D49A42]/35 bg-[#D49A42]/10 px-3.5 py-2.5 text-sm">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D49A42]">
              Imorgon:{" "}
            </span>
            <span className="font-semibold text-[var(--text-primary)]">
              {tomorrowPlan?.dish_name || "Ej planerat"}
            </span>
          </div>
          {tomorrowPlan?.recipe_url && (
            <a
              href={tomorrowPlan.recipe_url}
              target="_blank"
              rel="noreferrer"
              aria-label="Öppna recept för imorgon"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#D49A42] hover:underline"
            >
              <span>Recept</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Expanded Mon-Sun view */}
      {expanded && (
        <ul className="divide-y divide-[var(--border-subtle)]/70 border-t border-[var(--border-subtle)] pt-2">
          {weekDays.map((day) => {
            const plan = planByDate.get(day.date);
            const isEditing = editingDate === day.date;
            const isToday = day.date === todayStr;

            return (
              <li key={day.date} className="py-2 first:pt-1 last:pb-0">
                {isEditing ? (
                  <form onSubmit={saveDayMeal} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
                        {day.label.slice(0, 3)}
                      </span>
                      <input
                        type="text"
                        autoFocus
                        value={draftDish}
                        onChange={(e) => setDraftDish(e.target.value)}
                        placeholder="Maträtt…"
                        className="min-h-9 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        aria-label="Spara middag"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B8E6B] text-white"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDate(null)}
                        aria-label="Avbryt"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="url"
                      value={draftUrl}
                      onChange={(e) => setDraftUrl(e.target.value)}
                      placeholder="Valfri receptlänk (https://…)"
                      className="ml-18 min-h-8 w-[calc(100%-4.5rem)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-[11px] text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                    />
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`w-16 shrink-0 font-semibold ${
                          isToday
                            ? "text-[#6B8E6B]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {day.label}
                      </span>
                      <span
                        className={`truncate ${
                          plan?.dish_name
                            ? "font-medium text-[var(--text-primary)]"
                            : "italic text-[var(--text-secondary)]/70"
                        }`}
                      >
                        {plan?.dish_name || "—"}
                      </span>
                      {plan?.recipe_url && (
                        <a
                          href={plan.recipe_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Recept för ${day.label}`}
                          className="shrink-0 text-[#6B8E6B] hover:opacity-80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDate(day.date);
                          setDraftDish(plan?.dish_name ?? "");
                          setDraftUrl(plan?.recipe_url ?? "");
                        }}
                        aria-label={`Redigera middag för ${day.label}`}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
