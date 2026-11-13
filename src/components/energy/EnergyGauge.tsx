"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";

interface EnergyGaugeProps {
  liveWatts: number;
  totalPricePerKwh: number;
  hasPrice?: boolean;
  fuseMaxWatts?: number;
  isConnected?: boolean;
  title?: string;
}

const DEFAULT_MAX_WATTS = 12000;
const RADIUS = 74;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_SPAN = CIRCUMFERENCE * 0.75; // 270 degree gauge

function getLoadColor(watts: number): string {
  if (watts < 2500) return "#6B8E6B"; // Salviagrön
  if (watts < 6500) return "#D49A42"; // Ockra / Honungsguld
  return "#C86D51"; // Varm Terrakotta
}

export function EnergyGauge({
  liveWatts,
  totalPricePerKwh,
  hasPrice = false,
  fuseMaxWatts = DEFAULT_MAX_WATTS,
  isConnected = false,
  title = "Realtidspuls",
}: EnergyGaugeProps) {
  const [history, setHistory] = useState<number[]>([]);
  const watts = Number.isFinite(liveWatts) ? Math.max(0, liveWatts) : 0;
  const maxWatts = fuseMaxWatts > 0 ? fuseMaxWatts : DEFAULT_MAX_WATTS;

  useEffect(() => {
    if (!isConnected && watts === 0) return;
    setHistory((prev) => [...prev.slice(-19), watts]);
  }, [watts, isConnected]);

  const sparklinePoints = useMemo(() => {
    if (history.length < 2) return "";
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    return history
      .map((val, idx) => {
        const x = (idx / (history.length - 1)) * 120;
        const y = 26 - ((val - min) / range) * 22;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [history]);

  const clampedWatts = Math.max(0, Math.min(watts, maxWatts));
  const ratio = clampedWatts / maxWatts;
  const strokeDashoffset = ARC_SPAN * (1 - ratio);
  const arcColor =
    isConnected || watts > 0 ? getLoadColor(watts) : "var(--border-subtle)";

  return (
    <Card className="flex h-full flex-col items-center justify-between gap-4 p-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D49A42]/15 text-[#D49A42]">
            <DynamicIcon name="sys_tibber_pulse" className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {title}
          </span>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected || watts > 0 ? "bg-[#6B8E6B]" : "bg-[var(--border-subtle)]"
          }`}
          title={isConnected ? "Ansluten till Home Assistant" : "Ej ansluten"}
        />
      </div>

      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-[225deg]">
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke="var(--bg-subtle)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${ARC_SPAN} ${CIRCUMFERENCE}`}
          />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke={arcColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${ARC_SPAN} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular-nums text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {isConnected || watts > 0
              ? Math.round(watts).toLocaleString("sv-SE")
              : "--"}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Watt
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
        {sparklinePoints ? (
          <svg
            viewBox="0 0 120 30"
            className="h-7 w-32 overflow-visible"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke={arcColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints}
              opacity="0.9"
            />
          </svg>
        ) : (
          <div className="flex h-7 items-center text-[11px] text-[var(--text-secondary)]">
            {isConnected ? "Samlar realtidsdata…" : "Väntar på Home Assistant"}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-subtle)] px-3.5 py-1 text-xs">
          <span className="text-[var(--text-secondary)]">Elpris just nu:</span>
          <span className="tabular-nums font-semibold text-[#6B8E6B]">
            {hasPrice || totalPricePerKwh > 0
              ? `${totalPricePerKwh.toFixed(2)} kr/kWh`
              : "-- kr/kWh"}
          </span>
        </div>
      </div>
    </Card>
  );
}
