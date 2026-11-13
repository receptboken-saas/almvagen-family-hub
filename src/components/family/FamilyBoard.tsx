"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, ChevronDown, Pin, Plus, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSystemFamilyNote } from "@/lib/supabase/familyMeta";
import type { FamilyNote, Profile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";
import { AvatarBadge } from "@/components/ui/AvatarBadge";

interface FamilyBoardProps {
  propertyId: string | null;
  userId: string;
  authorName: string;
  isAdmin: boolean;
  singleColumnCards?: boolean;
}

const NOTE_ACCENTS = [
  "border-l-4 border-l-[#6B8E6B]",
  "border-l-4 border-l-[#D49A42]",
  "border-l-4 border-l-[#C86D51]",
];

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function FamilyBoard({
  propertyId,
  userId,
  authorName,
  isAdmin,
  singleColumnCards = false,
}: FamilyBoardProps) {
  const [notes, setNotes] = useState<FamilyNote[]>([]);
  const [avatarsByAuthor, setAvatarsByAuthor] = useState<
    Record<string, Pick<Profile, "avatar_url" | "avatar_icon" | "display_name">>
  >({});
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileShowForm, setMobileShowForm] = useState(false);

  const loadNotes = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId) {
      setNotes([]);
      return;
    }

    const [notesRes, profRes] = await Promise.all([
      supabase
        .from("family_notes")
        .select(
          "id, property_id, author_id, author_name, content, is_pinned, is_done, created_at",
        )
        .eq("property_id", propertyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, avatar_url, avatar_icon, display_name"),
    ]);

    if (!notesRes.error && notesRes.data) {
      const humanNotes = (notesRes.data as FamilyNote[]).filter(
        (n) => !isSystemFamilyNote(n.content),
      );
      setNotes(humanNotes);
    }
    if (!profRes.error && profRes.data) {
      const map: Record<
        string,
        Pick<Profile, "avatar_url" | "avatar_icon" | "display_name">
      > = {};
      for (const p of profRes.data as Pick<
        Profile,
        "id" | "avatar_url" | "avatar_icon" | "display_name"
      >[]) {
        map[p.id] = p;
      }
      setAvatarsByAuthor(map);
    }
  }, [propertyId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  if (!propertyId) return null;

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !content.trim() || busy) return;

    setBusy(true);
    const { error } = await supabase.from("family_notes").insert({
      property_id: propertyId,
      author_id: userId,
      author_name: authorName,
      content: content.trim(),
      is_pinned: false,
      is_done: false,
    });
    if (!error) {
      setContent("");
      await loadNotes();
    }
    setBusy(false);
  }

  async function toggleDone(note: FamilyNote) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, is_done: !n.is_done } : n)),
    );
    await supabase
      .from("family_notes")
      .update({ is_done: !note.is_done })
      .eq("id", note.id);
  }

  async function togglePin(note: FamilyNote) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase
      .from("family_notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id);
    await loadNotes();
  }

  async function deleteNote(noteId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await supabase.from("family_notes").delete().eq("id", noteId);
  }

  const activeCount = notes.filter((n) => !n.is_done).length;

  return (
    <section aria-labelledby="family-board-heading" className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          aria-expanded={mobileExpanded}
          className="flex items-center gap-2 text-left sm:pointer-events-none"
        >
          <h2
            id="family-board-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
          >
            Familjens anslagstavla
          </h2>
          <span className="tabular-nums rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            {activeCount}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-transform sm:hidden ${
              mobileExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileExpanded(true);
            setMobileShowForm((prev) => !prev);
          }}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#6B8E6B]/40 bg-[#6B8E6B]/12 px-3 py-1 text-xs font-semibold text-[#6B8E6B] sm:hidden"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Lapp</span>
        </button>

        <span className="tabular-nums hidden text-xs text-[var(--text-secondary)] sm:inline">
          {activeCount} aktiva lappar
        </span>
      </div>

      <Card
        className={`space-y-4 ${
          mobileExpanded ? "block" : "hidden sm:block"
        }`}
      >
        <form
          onSubmit={handleAddNote}
          className={`${
            mobileShowForm ? "flex" : "hidden sm:flex"
          } flex-col gap-2.5 sm:flex-row`}
        >
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Skriv en lapp eller kom-ihåg (t.ex. Träning kl 17:30, Köp mjölk)…"
            className="min-h-11 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none sm:min-h-12"
          />
          <button
            type="submit"
            disabled={busy || !content.trim()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-12"
          >
            <Plus className="h-4 w-4" />
            <span>Sätt upp lapp</span>
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--text-secondary)]">
            Anslagstavlan är tom – skriv en kom-ihåg ovan!
          </p>
        ) : (
          <div
            className={`grid grid-cols-1 gap-3 ${
              singleColumnCards ? "" : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {notes.map((note, idx) => {
              const canDelete = isAdmin || note.author_id === userId;
              const accentClass = note.is_pinned
                ? "border-l-4 border-l-[#C86D51] bg-[#C86D51]/5"
                : NOTE_ACCENTS[idx % NOTE_ACCENTS.length];

              return (
                <div
                  key={note.id}
                  className={`flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/45 p-3.5 transition-all ${accentClass} ${
                    note.is_done ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDone(note)}
                      aria-label={note.is_done ? "Markera som oklar" : "Markera som klar"}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        note.is_done
                          ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                          : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-transparent hover:border-[#6B8E6B]"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <p
                      className={`text-sm leading-snug text-[var(--text-primary)] ${
                        note.is_done ? "line-through text-[var(--text-secondary)]" : ""
                      }`}
                    >
                      {note.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)]/70 pt-2 text-[11px] text-[var(--text-secondary)]">
                    <div className="flex min-w-0 items-center gap-2">
                      <AvatarBadge
                        avatarUrl={
                          note.author_id
                            ? avatarsByAuthor[note.author_id]?.avatar_url
                            : null
                        }
                        avatarIcon={
                          note.author_id
                            ? avatarsByAuthor[note.author_id]?.avatar_icon
                            : null
                        }
                        displayName={note.author_name}
                        sizeClass="h-6 w-6 rounded-lg text-[10px]"
                      />
                      <span className="truncate">
                        <strong className="font-semibold text-[var(--text-primary)]">
                          {note.author_name}
                        </strong>{" "}
                        · {formatShortDate(note.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePin(note)}
                        title={note.is_pinned ? "Lossa lapp" : "Nåla fast"}
                        className={`rounded-lg p-1.5 transition-colors ${
                          note.is_pinned
                            ? "bg-[#C86D51]/15 text-[#C86D51]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          title="Ta bort lapp"
                          className="rounded-lg p-1.5 text-[#C86D51] hover:bg-[#C86D51]/15"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
