"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X, Eye, EyeOff, Plug, Unplug, Trash2 } from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";

interface HAConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HAConfigModal({ isOpen, onClose }: HAConfigModalProps) {
  const {
    status,
    isConnected,
    error,
    entities,
    wsUrl,
    hasToken,
    connectWithConfig,
    disconnect,
    clearConfig,
  } = useHomeAssistant();

  const [urlInput, setUrlInput] = useState(wsUrl);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(wsUrl);
  }, [wsUrl]);

  if (!isOpen) return null;

  const entityCount = Object.keys(entities).length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tokenInput.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const result = await connectWithConfig(urlInput, tokenInput);
    setIsSaving(false);
    if (result.error) {
      setSaveError(`Kunde inte spara i molnet: ${result.error}`);
    } else {
      setTokenInput("");
    }
  }

  async function handleClear() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const result = await clearConfig();
    setIsSaving(false);
    if (result.error) {
      setSaveError(`Kunde inte rensa från molnet: ${result.error}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ha-modal-title"
    >
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h2
              id="ha-modal-title"
              className="font-display text-xl font-semibold text-[var(--text-primary)]"
            >
              Home Assistant-anslutning
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Sparas i molnet (Supabase) så att alla familjens enheter ansluter automatiskt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 p-3.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Status</span>
            <span className="tabular-nums font-semibold text-[var(--text-primary)]">
              {isConnected
                ? `Ansluten (${entityCount} entiteter)`
                : status === "connecting" || status === "authenticating"
                  ? "Ansluter…"
                  : "Ej ansluten"}
            </span>
          </div>
          {(error || saveError) && (
            <p className="mt-2 rounded-lg bg-[#C86D51]/15 px-3 py-2 text-xs text-[#C86D51]">
              {saveError ?? error}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="ha-ws-url"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              WebSocket URL
            </label>
            <input
              id="ha-ws-url"
              type="url"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="wss://almvagen.sidequestlabs.se/api/websocket"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="ha-token"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              Long-Lived Access Token
            </label>
            <div className="relative mt-1.5">
              <input
                id="ha-token"
                type={showToken ? "text" : "password"}
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={
                  hasToken
                    ? "Token finns sparad – klistra in ny för att ersätta"
                    : "Klistra in din HA Long-Lived Access Token"
                }
                className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-2.5 pl-3.5 pr-12 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                aria-label={showToken ? "Dölj token" : "Visa token"}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {isConnected && (
                <button
                  type="button"
                  onClick={disconnect}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
                >
                  <Unplug className="h-4 w-4" />
                  <span>Koppla från</span>
                </button>
              )}
              {hasToken && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-4 py-2 text-sm font-medium text-[#C86D51] hover:bg-[#C86D51]/20 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Rensa token</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!tokenInput.trim() || isSaving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6B8E6B] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plug className="h-4 w-4" />
              <span>{isSaving ? "Sparar…" : "Spara & anslut"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
