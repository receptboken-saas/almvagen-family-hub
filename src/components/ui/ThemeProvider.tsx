"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Sun, Moon, Clock } from "lucide-react";

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

const STORAGE_KEY = "almvagen_theme_mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveAutoTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) return "dark";
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "auto") {
        setModeState(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const next: ResolvedTheme =
        mode === "auto" ? resolveAutoTheme() : mode;
      setResolvedTheme(next);
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };

    update();
    if (mode !== "auto") return;

    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : mode === "dark" ? "auto" : "light");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, cycleMode }),
    [mode, resolvedTheme, setMode, cycleMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme måste användas inuti <ThemeProvider>.");
  }
  return ctx;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, cycleMode } = useTheme();

  const label =
    mode === "light"
      ? "Linne"
      : mode === "dark"
        ? "Valnöt"
        : "Auto";

  return (
    <button
      type="button"
      onClick={cycleMode}
      aria-label={`Tema: ${label}. Tryck för att växla`}
      title={`Tema: ${label} (växla mellan Linne, Valnöt och Auto)`}
      className={
        compact
          ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm transition-colors hover:border-[#6B8E6B]"
          : "inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:border-[#6B8E6B]"
      }
    >
      {mode === "light" ? (
        <Sun className="h-4 w-4 text-[#D49A42]" aria-hidden="true" />
      ) : mode === "dark" ? (
        <Moon className="h-4 w-4 text-[#D49A42]" aria-hidden="true" />
      ) : (
        <Clock className="h-4 w-4 text-[#6B8E6B]" aria-hidden="true" />
      )}
      {!compact && <span>{label}</span>}
    </button>
  );
}
