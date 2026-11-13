"use client";

import { useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { HAConnectionStatus } from "@/lib/ha/types";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { HAConfigModal } from "@/components/ui/HAConfigModal";

const STATUS_CONFIG: Record<
  HAConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  disconnected: {
    label: "Ej ansluten till HA",
    dotClass: "bg-rose-400",
    badgeClass:
      "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  },
  connecting: {
    label: "Ansluter till HA…",
    dotClass: "bg-amber-400",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  },
  authenticating: {
    label: "Autentiserar…",
    dotClass: "bg-amber-400",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  },
  connected: {
    label: "Ansluten till HA",
    dotClass: "bg-emerald-400",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  },
  error: {
    label: "Anslutningsfel (HA)",
    dotClass: "bg-rose-500",
    badgeClass:
      "border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
  },
};

export function StatusBadge() {
  const { status } = useHomeAssistant();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const config = STATUS_CONFIG[status];
  const isPending = status === "connecting" || status === "authenticating";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        role="status"
        aria-live="polite"
        title="Konfigurera Home Assistant-anslutning"
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${config.badgeClass}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
        {status === "connected" ? (
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : isPending ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{config.label}</span>
      </button>

      <HAConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
