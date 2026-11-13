"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Delete,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Settings2,
  UserCog,
  Wifi,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Property } from "@/lib/supabase/types";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { AvatarBadge } from "@/components/ui/AvatarBadge";

interface ProfileQuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  profile: Profile | null;
  userEmail?: string | null;
  isAdmin: boolean;
  properties: Property[];
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
  onOpenSwitcher: () => void;
  onOpenProfileSetup: () => void;
  onOpenAdmin: () => void;
  onOpenHAConfig: () => void;
  onSignOut: () => Promise<void> | void;
}

function getRoleLabel(role: Profile["role"] | undefined): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "tablet":
      return "Väggplatta";
    case "child":
      return "Familjemedlem";
    default:
      return "Konto";
  }
}

/**
 * Responsive quick menu triggered from the header profile pill:
 * renders as an anchored popover on tablet/desktop (>= 640px) and
 * a bottom-sheet on mobile (< 640px).
 */
export function ProfileQuickMenu({
  isOpen,
  onClose,
  triggerRef,
  profile,
  userEmail,
  isAdmin,
  properties,
  selectedPropertyId,
  onSelectProperty,
  onOpenSwitcher,
  onOpenProfileSetup,
  onOpenAdmin,
  onOpenHAConfig,
  onSignOut,
}: ProfileQuickMenuProps) {
  const { status, isConnected, entities, wsUrl } = useHomeAssistant();
  const menuRef = useRef<HTMLDivElement>(null);

  const [pinStep, setPinStep] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [noAdminPinConfigured, setNoAdminPinConfigured] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPinStep(false);
      setPin("");
      setPinError(null);
      setCheckingPin(false);
      setNoAdminPinConfigured(false);
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const displayName = profile?.display_name || userEmail || "Familjemedlem";
  const entityCount = Object.keys(entities).length;
  const isPending = status === "connecting" || status === "authenticating";

  async function verifyAdminPinAndSignOut(candidatePin: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      await onSignOut();
      return;
    }

    setCheckingPin(true);
    setPinError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, quick_pin")
      .eq("role", "admin");

    setCheckingPin(false);

    if (error) {
      setPinError("Kunde inte verifiera Admin-PIN just nu.");
      setPin("");
      return;
    }

    const adminPins = (data ?? [])
      .map((row) => row.quick_pin as string | null)
      .filter((p): p is string => Boolean(p && p.length > 0));

    if (adminPins.length === 0) {
      setNoAdminPinConfigured(true);
      setPin("");
      return;
    }

    if (adminPins.includes(candidatePin)) {
      onClose();
      await onSignOut();
    } else {
      setPinError("Fel Admin-PIN. Försök igen.");
      setPin("");
    }
  }

  function handlePinDigit(digit: string) {
    if (checkingPin || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setPinError(null);
    if (next.length === 4) {
      void verifyAdminPinAndSignOut(next);
    }
  }

  async function handleSignOutClick() {
    if (profile?.role === "tablet") {
      setPinStep(true);
      setPin("");
      setPinError(null);
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select("quick_pin")
          .eq("role", "admin");
        const hasAnyPin = (data ?? []).some((r) => Boolean(r.quick_pin));
        setNoAdminPinConfigured(!hasAnyPin);
      }
      return;
    }
    onClose();
    await onSignOut();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:static sm:inset-auto sm:z-auto sm:block sm:bg-transparent sm:backdrop-blur-none">
      <div
        ref={menuRef}
        role="menu"
        aria-label="Profilmeny"
        style={{ boxShadow: "var(--card-shadow)" }}
        className="w-full max-w-lg rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-[var(--text-primary)] shadow-2xl sm:absolute sm:right-0 sm:top-full sm:z-50 sm:mt-2 sm:w-80 sm:rounded-2xl sm:p-3"
      >
        {/* Mobile bottom-sheet handle */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        {/* Profile summary header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarBadge
              avatarUrl={profile?.avatar_url}
              avatarIcon={profile?.avatar_icon}
              displayName={displayName}
              sizeClass="h-10 w-10 rounded-xl"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {displayName}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {getRoleLabel(profile?.role)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng meny"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {properties.length > 1 && !pinStep && (
          <div className="border-b border-[var(--border-subtle)] py-2.5">
            <label
              htmlFor="quick-menu-property"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              Aktivt hus
            </label>
            <select
              id="quick-menu-property"
              value={selectedPropertyId ?? ""}
              onChange={(e) => {
                onSelectProperty(e.target.value);
                onClose();
              }}
              className="mt-1.5 min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm font-medium text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {pinStep ? (
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Lock className="h-4 w-4 text-[#C86D51]" />
                <span>Admin-PIN krävs för utloggning</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinStep(false);
                  setPin("");
                  setPinError(null);
                }}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Avbryt
              </button>
            </div>

            {noAdminPinConfigured ? (
              <div className="space-y-3 rounded-xl border border-[#C86D51]/35 bg-[#C86D51]/10 p-3 text-xs text-[var(--text-primary)]">
                <p>
                  Ingen Admin-PIN är konfigurerad ännu. Vill du ändå logga ut
                  väggplattan?
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    await onSignOut();
                  }}
                  className="min-h-11 w-full rounded-xl bg-[#C86D51] px-4 text-xs font-semibold text-white hover:opacity-90"
                >
                  Bekräfta utloggning
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-3 py-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                        pin.length > idx
                          ? "border-[#C86D51] bg-[#C86D51]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                      }`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-[#C86D51]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                )}

                {checkingPin ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#6B8E6B]" />
                    <span>Verifierar…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handlePinDigit(d)}
                        className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
                      >
                        {d}
                      </button>
                    ))}
                    <div />
                    <button
                      type="button"
                      onClick={() => handlePinDigit("0")}
                      className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setPin((prev) => prev.slice(0, -1))}
                      aria-label="Sudda siffra"
                      className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onOpenSwitcher();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-[#D49A42]" />
              <span>Byt profil / panel</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onOpenProfileSetup();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <UserCog className="h-4 w-4 shrink-0 text-[#6B8E6B]" />
              <span>Min profil &amp; avatar</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <Settings2 className="h-4 w-4 shrink-0 text-[#6B8E6B]" />
                  <span>Redigera hemmet</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    onOpenHAConfig();
                  }}
                  className="flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <Wifi
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isConnected
                        ? "text-[#6B8E6B]"
                        : isPending
                          ? "text-[#D49A42]"
                          : "text-[#C86D51]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        HA-anslutning &amp; status
                      </span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isConnected
                            ? "bg-[#6B8E6B]"
                            : isPending
                              ? "bg-[#D49A42]"
                              : "bg-[#C86D51]"
                        }`}
                      />
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-secondary)]">
                      {isConnected
                        ? `Ansluten (${entityCount} entiteter)`
                        : isPending
                          ? "Ansluter till HA…"
                          : "Ej ansluten"}{" "}
                      · {wsUrl.replace(/^wss?:\/\//, "")}
                    </p>
                  </div>
                </button>
              </>
            )}

            <hr className="my-1 border-[var(--border-subtle)]" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOutClick}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#C86D51] transition-colors hover:bg-[#C86D51]/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logga ut</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
