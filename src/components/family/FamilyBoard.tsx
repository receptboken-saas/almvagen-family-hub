"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSystemFamilyNote } from "@/lib/supabase/familyMeta";
import { useAuth } from "@/lib/supabase/useAuth";
import type { FamilyNote, NoteColor, Profile } from "@/lib/supabase/types";
import { AvatarBadge } from "@/components/ui/AvatarBadge";

interface FamilyBoardProps {
  propertyId: string | null;
  userId: string;
  authorName: string;
  isAdmin: boolean;
  singleColumnCards?: boolean;
  onDataChanged?: () => Promise<void> | void;
}

type RosterProfile = Pick<
  Profile,
  "id" | "avatar_url" | "avatar_icon" | "display_name" | "role"
>;

const NOTE_COLORS: NoteColor[] = ["ochre", "sage", "terracotta", "linen"];

const NOTE_COLOR_STYLES: Record<
  NoteColor,
  { label: string; dot: string; card: string; badge: string; pin: string }
> = {
  ochre: {
    label: "Honungsgul",
    dot: "bg-[#F2D07D] border-[#D49A42]",
    card: "bg-[#FDF3D7] border-[#E7C97A] dark:bg-[#3A301D] dark:border-[#6A552A]",
    badge: "bg-[#D49A42]/18 text-[#8C6118] dark:text-[#F2CF88]",
    pin: "bg-[#D49A42]",
  },
  sage: {
    label: "Salviagrön",
    dot: "bg-[#A5C4A5] border-[#6B8E6B]",
    card: "bg-[#EBF3E8] border-[#B8D1B5] dark:bg-[#233124] dark:border-[#415C43]",
    badge: "bg-[#6B8E6B]/18 text-[#3F613F] dark:text-[#A9CCA9]",
    pin: "bg-[#6B8E6B]",
  },
  terracotta: {
    label: "Terrakotta",
    dot: "bg-[#E6A38E] border-[#C86D51]",
    card: "bg-[#FCEBE4] border-[#E4B8A7] dark:bg-[#3A241E] dark:border-[#6D4136]",
    badge: "bg-[#C86D51]/18 text-[#96452C] dark:text-[#F0AA93]",
    pin: "bg-[#C86D51]",
  },
  linen: {
    label: "Linnevit",
    dot: "bg-[#FAF6EF] border-[#C9BFAF]",
    card: "bg-[#FAF7F0] border-[#DFD6C7] dark:bg-[#2B2520] dark:border-[#493F37]",
    badge: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
    pin: "bg-[#8E8276]",
  },
};

const NOTE_TILTS = [
  "rotate-[-0.8deg]",
  "rotate-[0.6deg]",
  "rotate-[-0.5deg]",
  "rotate-[0.7deg]",
];

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
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
  onDataChanged,
}: FamilyBoardProps) {
  const { profile: activeProfile } = useAuth();
  const isChildView = activeProfile?.role === "child";

  const [notes, setNotes] = useState<FamilyNote[]>([]);
  const [roster, setRoster] = useState<RosterProfile[]>([]);
  const [content, setContent] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("ochre");
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(isChildView);
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
          "id, property_id, author_id, author_name, content, is_pinned, is_done, note_color, target_profile_id, target_name, created_at",
        )
        .eq("property_id", propertyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, avatar_url, avatar_icon, display_name, role")
        .order("display_name", { ascending: true }),
    ]);

    if (!notesRes.error && notesRes.data) {
      const humanNotes = (notesRes.data as FamilyNote[]).filter(
        (n) => !isSystemFamilyNote(n.content),
      );
      setNotes(humanNotes);
    }
    if (!profRes.error && profRes.data) {
      setRoster(profRes.data as RosterProfile[]);
    }
  }, [propertyId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (isChildView) {
      setMobileExpanded(true);
    }
  }, [isChildView]);

  const avatarsByAuthor = useMemo(() => {
    const map: Record<string, RosterProfile> = {};
    for (const p of roster) {
      map[p.id] = p;
    }
    return map;
  }, [roster]);

  const recipientProfiles = useMemo(
    () => roster.filter((p) => p.role !== "tablet" && Boolean(p.display_name)),
    [roster],
  );

  const sortedNotes = useMemo(() => {
    if (!isChildView || !activeProfile?.id) return notes;
    return [...notes].sort((a, b) => {
      const aForChild =
        a.target_profile_id === activeProfile.id || !a.target_profile_id ? 1 : 0;
      const bForChild =
        b.target_profile_id === activeProfile.id || !b.target_profile_id ? 1 : 0;
      return bForChild - aForChild;
    });
  }, [notes, isChildView, activeProfile?.id]);

  if (!propertyId) return null;

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const text = content.trim();
    if (!supabase || !propertyId || !text || busy) return;

    setBusy(true);
    const targetProfile = targetProfileId
      ? recipientProfiles.find((p) => p.id === targetProfileId) ?? null
      : null;

    const { error } = await supabase.from("family_notes").insert({
      property_id: propertyId,
      author_id: userId,
      author_name: authorName,
      content: text,
      is_pinned: false,
      is_done: false,
      note_color: noteColor,
      target_profile_id: targetProfile ? targetProfile.id : null,
      target_name: targetProfile ? targetProfile.display_name : null,
    });

    if (!error) {
      setContent("");
      setTargetProfileId(null);
      await loadNotes();
      if (onDataChanged) await onDataChanged();
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

  async function deleteNote(noteId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await supabase.from("family_notes").delete().eq("id", noteId);
  }

  const activeCount = notes.filter((n) => !n.is_done).length;

  return (
    <section
      aria-labelledby="family-board-heading"
      className="space-y-3 sm:space-y-4"
    >
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

      {/* Warm cork/linen framed board */}
      <div
        style={{ boxShadow: "var(--card-shadow)" }}
        className={`space-y-4 rounded-3xl border-2 border-[#D8CEBE] bg-[#F1EAE0]/80 p-4 sm:p-5 dark:border-[#3E352D] dark:bg-[#211C18]/90 ${
          mobileExpanded ? "block" : "hidden sm:block"
        }`}
      >
        <form
          onSubmit={handleAddNote}
          className={`${
            mobileShowForm ? "flex" : "hidden sm:flex"
          } flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 p-3.5`}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Skriv en kom-ihåg-lapp..."
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/65 focus:border-[#6B8E6B] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              <span>{busy ? "Sätter upp…" : "Sätt upp"}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Color picker dots */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Färg:
              </span>
              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((colorKey) => {
                  const cfg = NOTE_COLOR_STYLES[colorKey];
                  const selected = noteColor === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setNoteColor(colorKey)}
                      aria-label={cfg.label}
                      aria-pressed={selected}
                      title={cfg.label}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${cfg.dot} ${
                        selected
                          ? "scale-110 ring-2 ring-[#292421]/40 ring-offset-1 dark:ring-[#F4EFEA]/50"
                          : "opacity-80 hover:scale-105 hover:opacity-100"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Recipient pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Till:
              </span>
              <button
                type="button"
                onClick={() => setTargetProfileId(null)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  targetProfileId === null
                    ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                    : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Alla
              </button>
              {recipientProfiles.map((person) => {
                const selected = targetProfileId === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setTargetProfileId(person.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                        : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {person.display_name}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {sortedNotes.length === 0 ? (
          <p className="py-5 text-center text-xs text-[var(--text-secondary)]">
            Anslagstavlan är tom – sätt upp en Post-it-lapp ovan!
          </p>
        ) : (
          <div
            className={`grid grid-cols-2 gap-3.5 ${
              singleColumnCards ? "" : "lg:grid-cols-3"
            }`}
          >
            {sortedNotes.map((note, idx) => {
              const colorKey: NoteColor =
                note.note_color && note.note_color in NOTE_COLOR_STYLES
                  ? note.note_color
                  : "ochre";
              const palette = NOTE_COLOR_STYLES[colorKey];
              const tiltClass = NOTE_TILTS[idx % NOTE_TILTS.length];
              const canDelete = isAdmin || note.author_id === userId;
              const isTargetedToActive =
                Boolean(activeProfile?.id) &&
                (note.target_profile_id === activeProfile?.id ||
                  !note.target_profile_id);
              const highlightForChild = isChildView && isTargetedToActive;

              return (
                <article
                  key={note.id}
                  className={`relative flex min-h-36 flex-col justify-between gap-3 rounded-xl border p-3.5 pt-5 shadow-sm transition-all hover:rotate-0 hover:shadow-md ${palette.card} ${tiltClass} ${
                    note.is_done ? "opacity-55" : ""
                  } ${
                    highlightForChild
                      ? "ring-2 ring-[#6B8E6B]/60 ring-offset-1 ring-offset-transparent"
                      : ""
                  }`}
                >
                  {/* Subtle pushpin detail at top center */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow-sm ring-2 ring-white/70 dark:ring-black/30 ${palette.pin}`}
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${palette.badge}`}
                      >
                        {note.target_name ? `Till: ${note.target_name}` : "Till: Alla"}
                      </span>
                    </div>

                    <p
                      className={`text-sm leading-snug text-[var(--text-primary)] ${
                        note.is_done
                          ? "line-through text-[var(--text-secondary)]"
                          : ""
                      }`}
                    >
                      {note.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 border-t border-black/10 pt-2 text-[11px] text-[var(--text-secondary)] dark:border-white/10">
                    <div className="flex min-w-0 items-center gap-1.5">
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
                        sizeClass="h-5 w-5 rounded-md text-[9px]"
                      />
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {note.author_name}
                      </span>
                      <span className="hidden shrink-0 text-[10px] sm:inline">
                        · {formatShortDate(note.created_at)}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleDone(note)}
                        aria-label={
                          note.is_done
                            ? "Markera som oklar"
                            : "Markera som klar"
                        }
                        title={note.is_done ? "Oklar" : "Klar"}
                        className={`inline-flex h-6 items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-semibold transition-colors ${
                          note.is_done
                            ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                            : "border-black/15 bg-white/60 text-[var(--text-primary)] hover:border-[#6B8E6B] hover:bg-[#6B8E6B]/15 dark:border-white/15 dark:bg-black/20"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                        <span className="hidden sm:inline">Klar</span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          aria-label="Ta bort lapp"
                          title="Ta bort lapp"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#C86D51] hover:bg-[#C86D51]/15"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
