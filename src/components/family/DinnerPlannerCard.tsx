"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, UtensilsCrossed, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchStructuredNotes } from "@/lib/supabase/familyMeta";
import type { FamilyNote } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface DinnerPlannerCardProps {
  propertyId: string | null;
  userId: string;
  authorName: string;
  canEdit: boolean;
}

const WEEKDAYS = [
  { key: "mon", label: "Måndag", jsDay: 1 },
  { key: "tue", label: "Tisdag", jsDay: 2 },
  { key: "wed", label: "Onsdag", jsDay: 3 },
  { key: "thu", label: "Torsdag", jsDay: 4 },
  { key: "fri", label: "Fredag", jsDay: 5 },
  { key: "sat", label: "Lördag", jsDay: 6 },
  { key: "sun", label: "Söndag", jsDay: 0 },
] as const;

type DayKey = (typeof WEEKDAYS)[number]["key"];

const DINNER_PREFIX = "[DINNER:";

function parseDinnerNotes(notes: FamilyNote[]): Partial<Record<DayKey, string>> {
  const map: Partial<Record<DayKey, string>> = {};
  for (const note of notes) {
    if (!note.content.startsWith(DINNER_PREFIX)) continue;
    const endIdx = note.content.indexOf("]");
    if (endIdx === -1) continue;
    const key = note.content.slice(DINNER_PREFIX.length, endIdx) as DayKey;
    const meal = note.content.slice(endIdx + 1).trim();
    if (WEEKDAYS.some((d) => d.key === key)) {
      map[key] = meal;
    }
  }
  return map;
}

/**
 * Weekly dinner planner card ("Vad blir det till middag?") highlighting today & tomorrow,
 * with inline editing persisted to Supabase family_notes.
 */
export function DinnerPlannerCard({
  propertyId,
  userId,
  authorName,
  canEdit,
}: DinnerPlannerCardProps) {
  const [meals, setMeals] = useState<Partial<Record<DayKey, string>>>({});
  const [editingDay, setEditingDay] = useState<DayKey | null>(null);
  const [draftMeal, setDraftMeal] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMeals = useCallback(async () => {
    if (!propertyId) {
      setMeals({});
      return;
    }
    const raw = await fetchStructuredNotes(propertyId, DINNER_PREFIX);
    setMeals(parseDinnerNotes(raw));
  }, [propertyId]);

  useEffect(() => {
    void loadMeals();
  }, [loadMeals]);

  if (!propertyId) return null;

  const todayJsDay = new Date().getDay();
  const tomorrowJsDay = (todayJsDay + 1) % 7;
  const todayDay = WEEKDAYS.find((d) => d.jsDay === todayJsDay) ?? WEEKDAYS[0];
  const tomorrowDay =
    WEEKDAYS.find((d) => d.jsDay === tomorrowJsDay) ?? WEEKDAYS[1];

  async function saveDayMeal(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !editingDay || busy) return;

    setBusy(true);
    const prefix = `${DINNER_PREFIX}${editingDay}]`;
    await supabase
      .from("family_notes")
      .delete()
      .eq("property_id", propertyId)
      .like("content", `${prefix}%`);

    if (draftMeal.trim()) {
      await supabase.from("family_notes").insert({
        property_id: propertyId,
        author_id: userId,
        author_name: authorName,
        content: `${prefix} ${draftMeal.trim()}`,
        is_pinned: false,
        is_done: false,
      });
    }

    setEditingDay(null);
    setDraftMeal("");
    await loadMeals();
    setBusy(false);
  }

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D49A42]/18 text-[#D49A42]">
            <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Vad blir det till middag?
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Veckans matsedel · tryck på en dag för att ändra
            </p>
          </div>
        </div>

        {/* Today & Tomorrow spotlight */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[#6B8E6B]/40 bg-[#6B8E6B]/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B8E6B]">
              Idag · {todayDay.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {meals[todayDay.key] || "Ej planerat ännu"}
            </p>
          </div>
          <div className="rounded-xl border border-[#D49A42]/40 bg-[#D49A42]/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D49A42]">
              Imorgon · {tomorrowDay.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {meals[tomorrowDay.key] || "Ej planerat ännu"}
            </p>
          </div>
        </div>

        {/* Full week list */}
        <ul className="divide-y divide-[var(--border-subtle)]/70">
          {WEEKDAYS.map((day) => {
            const isEditing = editingDay === day.key;
            const meal = meals[day.key];
            return (
              <li key={day.key} className="py-2 first:pt-0 last:pb-0">
                {isEditing ? (
                  <form onSubmit={saveDayMeal} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
                      {day.label.slice(0, 3)}
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={draftMeal}
                      onChange={(e) => setDraftMeal(e.target.value)}
                      placeholder="Skriv middag…"
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
                      onClick={() => setEditingDay(null)}
                      aria-label="Avbryt"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-16 shrink-0 font-semibold text-[var(--text-secondary)]">
                        {day.label}
                      </span>
                      <span
                        className={`truncate ${
                          meal
                            ? "font-medium text-[var(--text-primary)]"
                            : "italic text-[var(--text-secondary)]/70"
                        }`}
                      >
                        {meal || "—"}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDay(day.key);
                          setDraftMeal(meal ?? "");
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
      </div>
    </Card>
  );
}
