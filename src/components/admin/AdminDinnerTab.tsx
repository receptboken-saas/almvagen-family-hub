"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Trash2, UtensilsCrossed } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentWeekBounds } from "@/lib/supabase/useHomeData";
import type { DinnerPlan } from "@/lib/supabase/types";

interface AdminDinnerTabProps {
  propertyId: string | null;
  dinnerPlans: DinnerPlan[];
  onDataChanged: () => Promise<void>;
  onFeedback: (msg: string) => void;
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

function formatDayDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

interface DayDraft {
  dish: string;
  notes: string;
  url: string;
}

/**
 * Admin dinner planner tab: allows planning Mon–Sun for this week & next week,
 * saving directly to Supabase dinner_plans.
 */
export function AdminDinnerTab({
  propertyId,
  dinnerPlans,
  onDataChanged,
  onFeedback,
}: AdminDinnerTabProps) {
  const [weekOffset, setWeekOffset] = useState<0 | 7>(0);
  const [drafts, setDrafts] = useState<Record<string, DayDraft>>({});
  const [savingDate, setSavingDate] = useState<string | null>(null);

  const { todayStr, days } = useMemo(() => {
    const { todayStr: tStr, mondayStr } = getCurrentWeekBounds();
    const baseMonday = addDaysISO(mondayStr, weekOffset);
    const weekDays = WEEKDAY_NAMES.map((label, idx) => {
      const date = addDaysISO(baseMonday, idx);
      return {
        label,
        date,
        shortDate: formatDayDate(date),
      };
    });
    return { todayStr: tStr, days: weekDays };
  }, [weekOffset]);

  const planByDate = useMemo(() => {
    const map = new Map<string, DinnerPlan>();
    for (const plan of dinnerPlans) {
      if (!propertyId || plan.property_id === propertyId) {
        map.set(plan.meal_date, plan);
      }
    }
    return map;
  }, [dinnerPlans, propertyId]);

  useEffect(() => {
    const nextDrafts: Record<string, DayDraft> = {};
    for (const day of days) {
      const existing = planByDate.get(day.date);
      nextDrafts[day.date] = {
        dish: existing?.dish_name ?? "",
        notes: existing?.notes ?? "",
        url: existing?.recipe_url ?? "",
      };
    }
    setDrafts(nextDrafts);
  }, [days, planByDate]);

  if (!propertyId) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-6 text-sm text-[var(--text-secondary)]">
        Skapa eller välj ett hus först för att planera veckans middagar.
      </div>
    );
  }

  function updateDraft(date: string, patch: Partial<DayDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [date]: {
        dish: prev[date]?.dish ?? "",
        notes: prev[date]?.notes ?? "",
        url: prev[date]?.url ?? "",
        ...patch,
      },
    }));
  }

  async function saveDay(e: FormEvent, date: string, label: string) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || savingDate) return;

    const draft = drafts[date] ?? { dish: "", notes: "", url: "" };
    const dish = draft.dish.trim();
    const notes = draft.notes.trim() || null;
    const url = draft.url.trim() || null;
    const existing = planByDate.get(date);

    setSavingDate(date);
    try {
      if (!dish) {
        if (existing) {
          const { error } = await supabase
            .from("dinner_plans")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          onFeedback(`Tog bort middag för ${label}.`);
        }
      } else if (existing) {
        const { error } = await supabase
          .from("dinner_plans")
          .update({
            dish_name: dish,
            notes,
            recipe_url: url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        onFeedback(`Uppdaterade middag för ${label}: ${dish}.`);
      } else {
        const { error } = await supabase.from("dinner_plans").insert({
          property_id: propertyId,
          meal_date: date,
          dish_name: dish,
          notes,
          recipe_url: url,
        });
        if (error) throw error;
        onFeedback(`Lade till middag för ${label}: ${dish}.`);
      }
      await onDataChanged();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Kunde inte spara middagen.",
      );
    } finally {
      setSavingDate(null);
    }
  }

  async function clearDay(date: string, label: string) {
    const supabase = getSupabaseClient();
    const existing = planByDate.get(date);
    if (!supabase || !existing || savingDate) return;

    setSavingDate(date);
    try {
      const { error } = await supabase
        .from("dinner_plans")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      updateDraft(date, { dish: "", notes: "", url: "" });
      onFeedback(`Tog bort middag för ${label}.`);
      await onDataChanged();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Kunde inte ta bort middagen.",
      );
    } finally {
      setSavingDate(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D49A42]/18 text-[#D49A42]">
            <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Planera veckans middagar
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Visas för övriga i widgeten &quot;Vad blir det till middag idag?&quot; och i
              surfplattans &quot;Händer idag&quot;.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1">
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
              weekOffset === 0
                ? "bg-[#6B8E6B] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Denna vecka
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(7)}
            className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
              weekOffset === 7
                ? "bg-[#6B8E6B] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Nästa vecka
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const draft = drafts[day.date] ?? { dish: "", notes: "", url: "" };
          const existing = planByDate.get(day.date);
          const isToday = day.date === todayStr;
          const isSaving = savingDate === day.date;

          return (
            <form
              key={day.date}
              onSubmit={(e) => void saveDay(e, day.date, day.label)}
              className={`space-y-2.5 rounded-2xl border p-4 ${
                isToday
                  ? "border-[#6B8E6B]/50 bg-[#6B8E6B]/8"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? "text-[#6B8E6B]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {day.label}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {day.shortDate}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-[#6B8E6B] px-2 py-0.5 text-[10px] font-semibold text-white">
                      Idag
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {existing && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void clearDay(day.date, day.label)}
                      aria-label={`Rensa middag för ${day.label}`}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-secondary)] hover:border-[#C86D51] hover:text-[#C86D51] disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Rensa</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#6B8E6B] px-3 text-xs font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSaving ? "Sparar…" : "Spara"}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={draft.dish}
                  onChange={(e) =>
                    updateDraft(day.date, { dish: e.target.value })
                  }
                  placeholder="Maträtt (t.ex. Tacos, Lax i ugn…)"
                  className="min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
                <input
                  type="text"
                  value={draft.notes}
                  onChange={(e) =>
                    updateDraft(day.date, { notes: e.target.value })
                  }
                  placeholder="Valfri anteckning / tillbehör"
                  className="min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
                <input
                  type="url"
                  value={draft.url}
                  onChange={(e) =>
                    updateDraft(day.date, { url: e.target.value })
                  }
                  placeholder="Valfri receptlänk (https://…)"
                  className="min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
