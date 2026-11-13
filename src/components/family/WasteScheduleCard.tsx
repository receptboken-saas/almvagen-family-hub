"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchStructuredNotes } from "@/lib/supabase/familyMeta";
import type { FamilyNote } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface WasteScheduleCardProps {
  propertyId: string | null;
  userId: string;
  authorName: string;
  isAdmin: boolean;
}

interface WastePayload {
  label: string;
  nextDate: string; // YYYY-MM-DD
}

interface ParsedWasteNote {
  noteId: string;
  payload: WastePayload;
  daysLeft: number;
}

const WASTE_PREFIX = "[WASTE:";

function diffDaysFromToday(dateStr: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function parseWasteNote(note: FamilyNote): ParsedWasteNote | null {
  if (!note.content.startsWith(WASTE_PREFIX)) return null;
  const jsonPart = note.content.slice(WASTE_PREFIX.length, -1);
  try {
    const parsed = JSON.parse(jsonPart) as Partial<WastePayload>;
    if (!parsed.label || !parsed.nextDate) return null;
    return {
      noteId: note.id,
      payload: { label: parsed.label, nextDate: parsed.nextDate },
      daysLeft: diffDaysFromToday(parsed.nextDate),
    };
  } catch {
    return null;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("sv-SE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Waste collection reminder card highlighting pickups happening today or tomorrow
 * (the evening before), configured dynamically via Supabase family_notes.
 */
export function WasteScheduleCard({
  propertyId,
  userId,
  authorName,
  isAdmin,
}: WasteScheduleCardProps) {
  const [items, setItems] = useState<ParsedWasteNote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [dateInput, setDateInput] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  const loadWaste = useCallback(async () => {
    if (!propertyId) {
      setItems([]);
      return;
    }
    const raw = await fetchStructuredNotes(propertyId, WASTE_PREFIX);
    const parsed = raw
      .map(parseWasteNote)
      .filter((item): item is ParsedWasteNote => item !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    setItems(parsed);
  }, [propertyId]);

  useEffect(() => {
    void loadWaste();
  }, [loadWaste]);

  if (!propertyId) return null;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !labelInput.trim() || !dateInput || busy) {
      return;
    }
    setBusy(true);
    const payload: WastePayload = {
      label: labelInput.trim(),
      nextDate: dateInput,
    };
    const { error } = await supabase.from("family_notes").insert({
      property_id: propertyId,
      author_id: userId,
      author_name: authorName,
      content: `${WASTE_PREFIX}${JSON.stringify(payload)}]`,
      is_pinned: false,
      is_done: false,
    });
    if (!error) {
      setLabelInput("");
      setShowForm(false);
      await loadWaste();
    }
    setBusy(false);
  }

  async function handleDelete(noteId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setItems((prev) => prev.filter((item) => item.noteId !== noteId));
    await supabase.from("family_notes").delete().eq("id", noteId);
  }

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
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
                Påminnelse kvällen före tömning
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kärl</span>
            </button>
          )}
        </div>

        {showForm && isAdmin && (
          <form
            onSubmit={handleAdd}
            className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3"
          >
            <input
              type="text"
              required
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="T.ex. Kärl 1 (Rest & Matavfall)"
              className="min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="date"
                required
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="min-h-10 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !labelInput.trim()}
                className="min-h-10 rounded-lg bg-[#6B8E6B] px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-45"
              >
                Spara
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-5 text-center text-xs text-[var(--text-secondary)]">
            Inget tömningsschema inlagt ännu.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isTomorrow = item.daysLeft === 1;
              const isToday = item.daysLeft === 0;
              const isUrgent = isTomorrow || isToday;

              const badgeText = isToday
                ? "Tömning idag!"
                : isTomorrow
                  ? "Ställ ut ikväll!"
                  : item.daysLeft > 1
                    ? `Om ${item.daysLeft} dagar`
                    : "Passerad";

              return (
                <li
                  key={item.noteId}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    isUrgent
                      ? "border-[#C86D51]/50 bg-[#C86D51]/12"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {item.payload.label}
                    </p>
                    <p className="tabular-nums text-[11px] text-[var(--text-secondary)]">
                      {formatShortDate(item.payload.nextDate)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`tabular-nums rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isUrgent
                          ? "bg-[#C86D51] text-white"
                          : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      {badgeText}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.noteId)}
                        aria-label={`Ta bort ${item.payload.label}`}
                        className="rounded-lg p-1.5 text-[#C86D51] hover:bg-[#C86D51]/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
