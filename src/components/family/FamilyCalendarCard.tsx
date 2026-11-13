"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Plus, Sparkles, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchStructuredNotes } from "@/lib/supabase/familyMeta";
import type { FamilyNote } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface FamilyCalendarCardProps {
  propertyId: string | null;
  userId: string;
  authorName: string;
  isAdmin: boolean;
}

interface CalendarItemPayload {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "event" | "holiday";
}

interface ParsedCalendarNote {
  noteId: string;
  payload: CalendarItemPayload;
}

const CALENDAR_PREFIX = "[CALENDAR:";

function parseCalendarNote(note: FamilyNote): ParsedCalendarNote | null {
  if (!note.content.startsWith(CALENDAR_PREFIX)) return null;
  const jsonPart = note.content.slice(CALENDAR_PREFIX.length, -1);
  try {
    const parsed = JSON.parse(jsonPart) as Partial<CalendarItemPayload>;
    if (!parsed.date || !parsed.title) return null;
    return {
      noteId: note.id,
      payload: {
        date: parsed.date,
        title: parsed.title,
        kind: parsed.kind === "holiday" ? "holiday" : "event",
      },
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

/**
 * Modular family calendar & school holiday card backed by Supabase family_notes,
 * ready for future Google Calendar / .ics feed integration.
 */
export function FamilyCalendarCard({
  propertyId,
  userId,
  authorName,
  isAdmin,
}: FamilyCalendarCardProps) {
  const [items, setItems] = useState<ParsedCalendarNote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [dateInput, setDateInput] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [titleInput, setTitleInput] = useState("");
  const [kindInput, setKindInput] = useState<"event" | "holiday">("event");
  const [busy, setBusy] = useState(false);

  const loadItems = useCallback(async () => {
    if (!propertyId) {
      setItems([]);
      return;
    }
    const raw = await fetchStructuredNotes(propertyId, CALENDAR_PREFIX);
    const today = new Date().toISOString().slice(0, 10);
    const parsed = raw
      .map(parseCalendarNote)
      .filter((item): item is ParsedCalendarNote => item !== null)
      .filter((item) => item.payload.date >= today)
      .sort((a, b) => a.payload.date.localeCompare(b.payload.date));
    setItems(parsed);
  }, [propertyId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  if (!propertyId) return null;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !titleInput.trim() || !dateInput || busy) {
      return;
    }
    setBusy(true);
    const payload: CalendarItemPayload = {
      date: dateInput,
      title: titleInput.trim(),
      kind: kindInput,
    };
    const { error } = await supabase.from("family_notes").insert({
      property_id: propertyId,
      author_id: userId,
      author_name: authorName,
      content: `${CALENDAR_PREFIX}${JSON.stringify(payload)}]`,
      is_pinned: false,
      is_done: false,
    });
    if (!error) {
      setTitleInput("");
      setShowForm(false);
      await loadItems();
    }
    setBusy(false);
  }

  async function handleDelete(noteId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setItems((prev) => prev.filter((item) => item.noteId !== noteId));
    await supabase.from("family_notes").delete().eq("id", noteId);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Familjekalender &amp; Lovdagar
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Redo för Google Kalender / .ics-flöde
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Händelse</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                required
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
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
                Spara
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-5 text-center text-xs text-[var(--text-secondary)]">
            Inga kommande händelser eller lovdagar inlagda ännu.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 6).map((item) => {
              const isToday = item.payload.date === todayStr;
              const isHoliday = item.payload.kind === "holiday";
              return (
                <li
                  key={item.noteId}
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
                        {isToday ? "Idag" : formatSwedishDate(item.payload.date)}
                      </span>
                      {isHoliday && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D49A42]/20 px-2 py-0.5 text-[10px] font-semibold text-[#D49A42]">
                          <Sparkles className="h-2.5 w-2.5" />
                          Lovdag
                        </span>
                      )}
                    </div>
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {item.payload.title}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.noteId)}
                      aria-label={`Ta bort ${item.payload.title}`}
                      className="rounded-lg p-1.5 text-[#C86D51] hover:bg-[#C86D51]/15"
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
