"use client";

import { useState, type FormEvent } from "react";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/supabase/useAuth";
import { CustomSvgIcon } from "@/components/icons/CustomIcons";
import { ThemeToggle } from "@/components/ui/ThemeProvider";

export function LoginScreen() {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
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
            Logga in med ditt familjekonto för att styra hemmet
          </p>
        </div>

        {!isConfigured && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#D49A42]/40 bg-[#D49A42]/10 p-3.5 text-xs text-[var(--text-primary)]">
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
      </div>
    </main>
  );
}
