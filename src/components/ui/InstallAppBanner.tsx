"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "almvagen_pwa_dismissed";

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIosHint, setIsIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "true") {
        return;
      }
    } catch {
      // Ignore
    }

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|android/.test(ua);

    if (isIos && isSafari) {
      setIsIosHint(true);
      setDismissed(false);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || (!deferredPrompt && !isIosHint)) {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Ignore
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  }

  return (
    <div
      style={{ boxShadow: "var(--card-shadow)" }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#6B8E6B]/40 bg-[var(--bg-card)] px-4 py-3 text-xs"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
          {deferredPrompt ? (
            <Download className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Share className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            Installera Almvägen som app
          </p>
          <p className="text-[var(--text-secondary)]">
            {deferredPrompt
              ? "Få snabb helskärmsåtkomst direkt från telefonens hemskärm."
              : "Tryck på Dela-knappen i Safari och välj \"Lägg till på hemskärmen\"."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-9 rounded-xl bg-[#6B8E6B] px-3.5 py-1.5 font-semibold text-white hover:opacity-90"
          >
            Installera som app
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Stäng"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
