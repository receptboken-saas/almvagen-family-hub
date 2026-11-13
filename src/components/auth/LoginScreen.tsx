"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Delete,
  KeyRound,
  Shield,
  Monitor,
  User,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/useAuth";
import { ACTIVE_PROFILE_KEY } from "@/lib/supabase/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/supabase/types";
import { CustomSvgIcon } from "@/components/icons/CustomIcons";
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { AvatarBadge } from "@/components/ui/AvatarBadge";

interface PinProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_icon: string | null;
  role: ProfileRole;
  has_pin: boolean;
}

interface PinLoginResponse {
  token_hash?: string;
  email?: string;
  error?: string;
}

function isFunctionNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as {
    message?: string;
    context?: { status?: number };
  };
  if (record.context?.status === 404) return true;
  const msg = record.message?.toLowerCase() ?? "";
  return msg.includes("404") || msg.includes("not found");
}

async function extractFunctionErrorMessage(err: unknown): Promise<string> {
  if (!err || typeof err !== "object") {
    return "Felaktig PIN-kod. Försök igen.";
  }
  const record = err as {
    message?: string;
    context?: Response;
  };
  if (record.context && typeof record.context.json === "function") {
    try {
      const payload = (await record.context.clone().json()) as {
        error?: string;
        message?: string;
      };
      if (payload.error) return payload.error;
      if (payload.message) return payload.message;
    } catch {
      // Ignore JSON parse errors
    }
  }
  return record.message || "Felaktig PIN-kod. Försök igen.";
}

function getRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "tablet":
      return "Väggplatta";
    default:
      return "Familjemedlem";
  }
}

function RoleIcon({ role }: { role: ProfileRole }) {
  switch (role) {
    case "admin":
      return <Shield className="h-3 w-3 text-[#C86D51]" />;
    case "tablet":
      return <Monitor className="h-3 w-3 text-[#6B8E6B]" />;
    default:
      return <User className="h-3 w-3 text-[#D49A42]" />;
  }
}

export function LoginScreen() {
  const {
    user,
    signIn,
    signOut,
    isConfigured,
  } = useAuth();

  const [mode, setMode] = useState<"pin" | "password">("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [pinProfiles, setPinProfiles] = useState<PinProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PinProfile | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setPinProfiles([]);
      setIsLoadingProfiles(false);
      return;
    }

    let cancelled = false;
    setIsLoadingProfiles(true);
    supabase.rpc("get_pin_profiles").then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) {
        setError("Kunde inte hämta familjeprofiler just nu.");
        setPinProfiles([]);
      } else if (Array.isArray(data)) {
        const sorted = [...(data as PinProfile[])].sort((a, b) => {
          if (a.has_pin !== b.has_pin) return a.has_pin ? -1 : 1;
          return (a.display_name ?? "").localeCompare(
            b.display_name ?? "",
            "sv",
          );
        });
        setPinProfiles(sorted);
      }
      setIsLoadingProfiles(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
    }
    setIsSubmitting(false);
  }

  function handleSelectProfile(member: PinProfile) {
    setPin("");
    if (!member.has_pin) {
      setError(
        `${member.display_name || "Denna profil"} saknar Snabb-PIN. Be admin sätta en 4-siffrig PIN under Familj & Surfplattor.`,
      );
      return;
    }
    setError(null);
    setSelectedProfile(member);
  }

  async function submitPinLogin(cleanPin: string) {
    if (!selectedProfile || cleanPin.length !== 4 || isSubmitting) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase är inte konfigurerat.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      profile_id: selectedProfile.id,
      pin: cleanPin,
    };

    let response = await supabase.functions.invoke<PinLoginResponse>(
      "pin-login",
      { body: payload },
    );

    if (response.error && isFunctionNotFoundError(response.error)) {
      response = await supabase.functions.invoke<PinLoginResponse>(
        "bright-responder",
        { body: payload },
      );
    }

    if (response.error) {
      const msg = await extractFunctionErrorMessage(response.error);
      setError(msg);
      setPin("");
      setIsSubmitting(false);
      return;
    }

    const tokenHash = response.data?.token_hash;
    if (!tokenHash) {
      setError(
        response.data?.error ??
          "Kunde inte verifiera PIN-inloggningen. Försök igen.",
      );
      setPin("");
      setIsSubmitting(false);
      return;
    }

    try {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, selectedProfile.id);
      window.localStorage.setItem("active_profile_id", selectedProfile.id);
    } catch {
      // Ignore storage errors
    }

    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (otpError) {
      if (!user) {
        try {
          window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
          window.localStorage.removeItem("active_profile_id");
        } catch {
          // Ignore
        }
      }
      setError(otpError.message);
      setPin("");
    }
    setIsSubmitting(false);
  }

  async function handlePinDigit(digit: string) {
    if (isSubmitting || pin.length >= 4 || !selectedProfile) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      await submitPinLogin(nextPin);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div
        style={{ boxShadow: "var(--card-shadow)" }}
        className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-7 sm:p-9"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B] ring-1 ring-[#6B8E6B]/30">
            <CustomSvgIcon id="ui_ha_status" className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Almvägen Family Hub
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {mode === "pin"
              ? "Ange din 4-siffriga familje-PIN för att växla läge"
              : "Logga in med ditt familjekonto för att styra hemmet"}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("pin");
              setError(null);
            }}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              mode === "pin"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Snabb-PIN</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              mode === "password"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>E-post &amp; lösenord</span>
          </button>
        </div>

        {!isConfigured && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#D49A42]/40 bg-[#D49A42]/10 p-3.5 text-xs text-[var(--text-primary)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D49A42]" />
            <span>
              Supabase-miljövariabler (<code>NEXT_PUBLIC_SUPABASE_URL</code> och{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) saknas i detta bygge.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 p-3.5 text-sm text-[#C86D51]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === "pin" ? (
          <div className="mt-6 space-y-5">
            {!selectedProfile ? (
              <div className="space-y-3">
                <p className="text-center text-xs font-medium text-[var(--text-secondary)]">
                  Välj vem du är för att logga in med Snabb-PIN
                </p>
                {isLoadingProfiles ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-5 text-xs text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#6B8E6B]" />
                    <span>Hämtar familjeprofiler...</span>
                  </div>
                ) : pinProfiles.length === 0 ? (
                  <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4 text-center text-xs text-[var(--text-secondary)]">
                    Inga familjeprofiler hittades ännu. Logga in med e-post &amp;
                    lösenord för att konfigurera profiler.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {pinProfiles.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSelectProfile(member)}
                        className={`group flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-all active:scale-[0.98] disabled:opacity-50 ${
                          member.has_pin
                            ? "border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[#6B8E6B] hover:bg-[#6B8E6B]/10"
                            : "border-[var(--border-subtle)]/70 bg-[var(--bg-subtle)]/50 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <AvatarBadge
                          avatarUrl={member.avatar_url}
                          avatarIcon={member.avatar_icon}
                          displayName={member.display_name}
                          sizeClass="h-12 w-12"
                        />
                        <div className="min-w-0 w-full">
                          <div className="flex items-center justify-center gap-1">
                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {member.display_name || "Profil"}
                            </span>
                            {member.has_pin && (
                              <Lock className="h-3 w-3 shrink-0 text-[#6B8E6B]" />
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              <RoleIcon role={member.role} />
                              {getRoleLabel(member.role)}
                            </span>
                            {!member.has_pin && (
                              <span className="rounded-full border border-[#D49A42]/40 bg-[#D49A42]/10 px-2 py-0.5 text-[10px] font-medium text-[#D49A42]">
                                Saknar PIN
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#6B8E6B]/40 bg-[#6B8E6B]/10 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarBadge
                      avatarUrl={selectedProfile.avatar_url}
                      avatarIcon={selectedProfile.avatar_icon}
                      displayName={selectedProfile.display_name}
                      sizeClass="h-9 w-9"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {selectedProfile.display_name || "Profil"}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Ange 4-siffrig Snabb-PIN
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfile(null);
                      setPin("");
                      setError(null);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Byt person
                  </button>
                </div>

                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map((slot) => (
                    <div
                      key={slot}
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-bold transition-all ${
                        pin.length > slot
                          ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[#6B8E6B]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {pin.length > slot ? "•" : ""}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handlePinDigit(digit)}
                      className="tabular-nums min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-lg font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] hover:bg-[#6B8E6B]/10 active:scale-95 disabled:opacity-50"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isSubmitting || pin.length === 0}
                    onClick={() => {
                      setPin("");
                      setError(null);
                    }}
                    className="min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    Rensa
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePinDigit("0")}
                    className="tabular-nums min-h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-lg font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] hover:bg-[#6B8E6B]/10 active:scale-95 disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || pin.length === 0}
                    onClick={() => setPin((prev) => prev.slice(0, -1))}
                    aria-label="Sudda"
                    className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || pin.length !== 4}
                  onClick={() => submitPinLogin(pin)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5B7D5B] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loggar in...</span>
                    </>
                  ) : (
                    <span>
                      Logga in som {selectedProfile.display_name || "Profil"}
                    </span>
                  )}
                </button>
              </div>
            )}

            {user && (
              <button
                type="button"
                onClick={signOut}
                className="w-full text-center text-xs font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
              >
                Logga ut helt från denna enhet
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                E-postadress
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="namn@exempel.se"
                  className="min-h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Lösenord
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isConfigured}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loggar in…</span>
                </>
              ) : (
                <span>Logga in</span>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
