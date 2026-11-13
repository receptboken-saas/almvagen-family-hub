"use client";

import { useState, type FormEvent } from "react";
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

  if (!isOpen) return null;

  const entityCount = Object.keys(entities).length;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    connectWithConfig(urlInput, tokenInput);
    setTokenInput("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ha-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2
              id="ha-modal-title"
              className="text-lg font-semibold text-slate-100"
            >
              Home Assistant-anslutning
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Sparas lokalt i webbläsaren (localStorage) för direkt testning.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span className="font-medium text-slate-200">
              {isConnected
                ? `Ansluten (${entityCount} entiteter)`
                : status === "connecting" || status === "authenticating"
                  ? "Ansluter…"
                  : "Ej ansluten"}
            </span>
          </div>
          {error && (
            <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="ha-ws-url"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
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
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="ha-token"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
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
                className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-3.5 pr-12 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                aria-label={showToken ? "Dölj token" : "Visa token"}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200"
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  <Unplug className="h-4 w-4" />
                  <span>Koppla från</span>
                </button>
              )}
              {hasToken && (
                <button
                  type="button"
                  onClick={clearConfig}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Rensa token</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plug className="h-4 w-4" />
              <span>Spara &amp; anslut</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
