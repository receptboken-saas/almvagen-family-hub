import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { HAConnectionStatus } from "@/lib/ha/types";

interface StatusBadgeProps {
  status: HAConnectionStatus;
}

const STATUS_CONFIG: Record<
  HAConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  disconnected: {
    label: "Ej ansluten till HA",
    dotClass: "bg-rose-400",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
  connecting: {
    label: "Ansluter till HA…",
    dotClass: "bg-amber-400",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  authenticating: {
    label: "Autentiserar…",
    dotClass: "bg-amber-400",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  connected: {
    label: "Ansluten till HA",
    dotClass: "bg-emerald-400",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  error: {
    label: "Anslutningsfel (HA)",
    dotClass: "bg-rose-500",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-200",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isPending = status === "connecting" || status === "authenticating";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium ${config.badgeClass}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
      {status === "connected" ? (
        <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : isPending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{config.label}</span>
    </div>
  );
}
