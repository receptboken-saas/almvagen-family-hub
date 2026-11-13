"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Delete,
  KeyRound,
  Loader2,
  Lock,
  Monitor,
  Shield,
  User,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { PROFILE_SELECT_COLUMNS, type Profile, type ProfileRole } from "@/lib/supabase/types";
import { useAuth } from "@/lib/supabase/useAuth";
import { AvatarBadge } from "@/components/ui/AvatarBadge";

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "tablet":
      return "Väggplatta";
    case "child":
      return "Familjemedlem";
  }
}

function RoleIcon({ role }: { role: ProfileRole }) {
  switch (role) {
    case "admin":
      return <Shield className="h-3.5 w-3.5 text-[#6B8E6B]" />;
    case "tablet":
      return <Monitor className="h-3.5 w-3.5 text-[#D49A42]" />;
    case "child":
      return <User className="h-3.5 w-3.5 text-[#C86D51]" />;
  }
}

/**
 * Modal for switching active family profile or wall tablet panel,
 * enforcing quick_pin verification when configured on the target profile.
 */
export function ProfileSwitcherModal({
  isOpen,
  onClose,
}: ProfileSwitcherModalProps) {
  const { profile: activeProfile, switchProfile, lockWithPin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTarget(null);
      setPin("");
      setError(null);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoading(true);
    supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .order("display_name", { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (fetchErr) {
          setError(fetchErr.message);
        } else if (data) {
          setProfiles(data as Profile[]);
        }
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSelectProfile(target: Profile) {
    setError(null);
    if (!target.quick_pin) {
      setBusy(true);
      const res = await switchProfile(target);
      setBusy(false);
      if (res.error) {
        setError(res.error);
      } else {
        onClose();
      }
      return;
    }
    setSelectedTarget(target);
    setPin("");
  }

  async function handlePinDigit(digit: string) {
    if (!selectedTarget || busy || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      setBusy(true);
      const res = await switchProfile(selectedTarget, nextPin);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        setPin("");
      } else {
        onClose();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Välj panel eller profil"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                Välj panel / profil
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Anpassar rum, widgets och moduler direkt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-3.5 py-2.5 text-xs text-[#C86D51]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedTarget ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <AvatarBadge
                  avatarUrl={selectedTarget.avatar_url}
                  avatarIcon={selectedTarget.avatar_icon}
                  displayName={selectedTarget.display_name}
                  sizeClass="h-14 w-14"
                />
                <div>
                  <p className="font-serif text-base font-semibold text-[var(--text-primary)]">
                    {selectedTarget.display_name || "Profil"}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ange 4-siffrig Snabb-PIN för att aktivera
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-semibold ${
                      pin.length > idx
                        ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[#6B8E6B]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {pin.length > idx ? "•" : ""}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePinDigit(digit)}
                    className="min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-lg font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTarget(null);
                    setPin("");
                    setError(null);
                  }}
                  className="min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Tillbaka
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePinDigit("0")}
                  className="min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-lg font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPin((prev) => prev.slice(0, -1))}
                  aria-label="Sudda"
                  className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin text-[#6B8E6B]" />
              <span>Hämtar profiler…</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {profiles.map((p) => {
                const isActive = activeProfile?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleSelectProfile(p)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                      isActive
                        ? "border-[#6B8E6B] bg-[#6B8E6B]/12"
                        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 hover:border-[#6B8E6B]/60"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarBadge
                        avatarUrl={p.avatar_url}
                        avatarIcon={p.avatar_icon}
                        displayName={p.display_name}
                        sizeClass="h-11 w-11"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-serif text-sm font-semibold text-[var(--text-primary)]">
                          {p.display_name || "Namnlös profil"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <RoleIcon role={p.role} />
                          <span>{getRoleLabel(p.role)}</span>
                          {isActive && (
                            <span className="ml-1 rounded-md bg-[#6B8E6B]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#6B8E6B]">
                              Aktiv
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {p.quick_pin && (
                      <span
                        title="Skyddad med Snabb-PIN"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card)] text-[#D49A42]"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    lockWithPin();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Lock className="h-3.5 w-3.5 text-[#D49A42]" />
                  <span>Lås skärmen med PIN-kod</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
