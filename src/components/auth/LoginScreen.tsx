"use client";

import { useState, type FormEvent } from "react";
import { Lock, Mail, Loader2, AlertCircle, Delete, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/supabase/useAuth";
import { CustomSvgIcon } from "@/components/icons/CustomIcons";
import { ThemeToggle } from "@/components/ui/ThemeProvider";

export function LoginScreen() {
  const {
    user,
    signIn,
    signOut,
    unlockWithPin,
    isConfigured,
    isPinLocked,
    isTrustedDevice,
  } = useAuth();

  const [mode, setMode] = useState<"pin" | "password">(
    isPinLocked || (isTrustedDevice && Boolean(user)) ? "pin" : "password",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handlePinDigit(digit: string) {
    if (isSubmitting || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      setIsSubmitting(true);
      const result = await unlockWithPin(nextPin);
      if (result.error) {
        setError(result.error);
        setPin("");
      }
      setIsSubmitting(false);
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
            {!user && (
              <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 p-3 text-center text-xs text-[var(--text-secondary)]">
                Logga in med e-post &amp; lösenord första gången på denna enhet
                för att auktorisera Snabb-PIN.
              </p>
            )}

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
