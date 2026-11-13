"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { DashboardWidget } from "@/lib/supabase/types";

interface EnergyGaugeProps {
  widgets: DashboardWidget[];
  isAdmin: boolean;
}

const MAX_WATTS = 12000;
const RADIUS = 74;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_SPAN = CIRCUMFERENCE * 0.75; // 270 degree gauge

function getLoadColor(watts: number): string {
  if (watts < 2500) return "#6B8E6B"; // Salviagrön
  if (watts < 6500) return "#D49A42"; // Ockra / Honungsguld
  return "#C86D51"; // Varm Terrakotta
}

function parseNumericState(
  rawState: string | undefined,
  unit: string | null | undefined,
): number | null {
  if (!rawState || rawState === "unavailable" || rawState === "unknown") {
    return null;
  }
  const num = Number.parseFloat(rawState);
  if (Number.isNaN(num)) return null;
  if (unit?.toLowerCase() === "kw") {
    return Math.round(num * 1000);
  }
  return num;
}

export function EnergyGauge({ widgets, isAdmin }: EnergyGaugeProps) {
  const { isConnected, getEntity } = useHomeAssistant();
  const [history, setHistory] = useState<number[]>([]);

  const energyWidgets = useMemo(
    () =>
      widgets.filter(
        (w) => w.widget_category === "energy" && (isAdmin || !w.admin_only),
      ),
    [widgets, isAdmin],
  );

  const powerWidget = useMemo(() => {
    return (
      energyWidgets.find(
        (w) =>
          w.icon === "sys_tibber_pulse" ||
          w.unit?.toUpperCase() === "W" ||
          w.unit?.toLowerCase() === "kw",
      ) ??
      energyWidgets.find(
        (w) =>
          w.icon !== "sys_elpris" &&
          !w.unit?.toLowerCase().includes("kr") &&
          !w.unit?.toLowerCase().includes("öre"),
      )
    );
  }, [energyWidgets]);

  const priceWidget = useMemo(() => {
    return energyWidgets.find(
      (w) =>
        w.id !== powerWidget?.id &&
        (w.icon === "sys_elpris" ||
          w.unit?.toLowerCase().includes("kr") ||
          w.unit?.toLowerCase().includes("öre")),
    );
  }, [energyWidgets, powerWidget?.id]);

  const powerEntity =
    isConnected && powerWidget ? getEntity(powerWidget.ha_entity_id) : undefined;
  const priceEntity =
    isConnected && priceWidget ? getEntity(priceWidget.ha_entity_id) : undefined;

  const powerUnit =
    powerWidget?.unit ?? powerEntity?.attributes.unit_of_measurement ?? "W";
  const watts = parseNumericState(powerEntity?.state, powerUnit);

  useEffect(() => {
    if (watts === null) return;
    setHistory((prev) => [...prev.slice(-19), watts]);
  }, [watts]);

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

  if (!powerWidget) {
    return null;
  }

  const clampedWatts = watts !== null ? Math.max(0, Math.min(watts, MAX_WATTS)) : 0;
  const ratio = watts !== null ? clampedWatts / MAX_WATTS : 0;
  const strokeDashoffset = ARC_SPAN * (1 - ratio);
  const arcColor = watts !== null ? getLoadColor(watts) : "var(--border-subtle)";

  const priceUnit =
    priceWidget?.unit ?? priceEntity?.attributes.unit_of_measurement ?? "kr/kWh";
  const priceText =
    priceEntity &&
    priceEntity.state !== "unavailable" &&
    priceEntity.state !== "unknown"
      ? `${priceEntity.state} ${priceUnit}`
      : priceWidget
        ? `-- ${priceUnit}`
        : null;

  return (
    <Card className="flex flex-col items-center justify-between gap-4 p-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D49A42]/15 text-[#D49A42]">
            <DynamicIcon name={powerWidget.icon ?? "sys_tibber_pulse"} className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {powerWidget.title}
          </span>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected && watts !== null ? "bg-[#6B8E6B]" : "bg-[var(--border-subtle)]"
          }`}
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
            {watts !== null ? Math.round(watts).toLocaleString("sv-SE") : "--"}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Watt
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
        {sparklinePoints ? (
          <svg viewBox="0 0 120 30" className="h-7 w-32 overflow-visible" aria-hidden="true">
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

        {priceText && (
          <div className="flex items-center gap-2 rounded-full bg-[var(--bg-subtle)] px-3.5 py-1 text-xs">
            <span className="text-[var(--text-secondary)]">
              {priceWidget?.title ?? "Elpris"}:
            </span>
            <span className="tabular-nums font-semibold text-[#6B8E6B]">
              {priceText}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
