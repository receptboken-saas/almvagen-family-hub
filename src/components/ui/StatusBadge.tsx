"use client";

import { useState } from "react";
import { WifiOff, Loader2 } from "lucide-react";
import type { HAConnectionStatus } from "@/lib/ha/types";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { HAConfigModal } from "@/components/ui/HAConfigModal";
import { CustomSvgIcon } from "@/components/icons/CustomIcons";

const STATUS_CONFIG: Record<
  HAConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  disconnected: {
    label: "Ej ansluten till HA",
    dotClass: "bg-[#C86D51]",
    badgeClass:
      "border-[#C86D51]/40 bg-[#C86D51]/10 text-[var(--text-primary)] hover:bg-[#C86D51]/20",
  },
  connecting: {
    label: "Ansluter till HA…",
    dotClass: "bg-[#D49A42]",
    badgeClass:
      "border-[#D49A42]/40 bg-[#D49A42]/10 text-[var(--text-primary)] hover:bg-[#D49A42]/20",
  },
  authenticating: {
    label: "Autentiserar…",
    dotClass: "bg-[#D49A42]",
    badgeClass:
      "border-[#D49A42]/40 bg-[#D49A42]/10 text-[var(--text-primary)] hover:bg-[#D49A42]/20",
  },
  connected: {
    label: "Ansluten till HA",
    dotClass: "bg-[#6B8E6B]",
    badgeClass:
      "border-[#6B8E6B]/45 bg-[#6B8E6B]/15 text-[var(--text-primary)] hover:bg-[#6B8E6B]/25",
  },
  error: {
    label: "Anslutningsfel (HA)",
    dotClass: "bg-[#C86D51]",
    badgeClass:
      "border-[#C86D51]/50 bg-[#C86D51]/15 text-[var(--text-primary)] hover:bg-[#C86D51]/25",
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
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${config.badgeClass}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
        {status === "connected" ? (
          <CustomSvgIcon id="ui_ha_status" className="h-4 w-4 shrink-0" />
        ) : isPending ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-[#D49A42]"
            aria-hidden="true"
          />
        ) : (
          <WifiOff
            className="h-4 w-4 shrink-0 text-[#C86D51]"
            aria-hidden="true"
          />
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
