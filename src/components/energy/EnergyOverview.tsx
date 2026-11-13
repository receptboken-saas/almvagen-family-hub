"use client";

import { Zap, Flame, PlugZap, Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";

interface EnergyMetricDefinition {
  id: string;
  label: string;
  entityIds: string[];
  fallbackValue: string;
  unitFallback: string;
  subtitle: string;
  icon: typeof Zap;
  accentClass: string;
}

const ENERGY_METRICS: EnergyMetricDefinition[] = [
  {
    id: "tibber-power",
    label: "Tibber Pulse",
    entityIds: ["sensor.tibber_pulse_power", "sensor.power_almvagen_1"],
    fallbackValue: "-- W",
    unitFallback: "W",
    subtitle: "Realtidseffekt",
    icon: Zap,
    accentClass: "text-amber-400 bg-amber-500/10",
  },
  {
    id: "tibber-price",
    label: "Elpris just nu",
    entityIds: ["sensor.electricity_price_almvagen_1", "sensor.tibber_price"],
    fallbackValue: "-- öre/kWh",
    unitFallback: "kr/kWh",
    subtitle: "Spotpris inkl. moms",
    icon: Coins,
    accentClass: "text-emerald-400 bg-emerald-500/10",
  },
  {
    id: "zaptec",
    label: "Zaptec Laddbox",
    entityIds: ["sensor.zaptec_charger_status", "sensor.zaptec_status"],
    fallbackValue: "--",
    unitFallback: "",
    subtitle: "Elbilsladdning",
    icon: PlugZap,
    accentClass: "text-sky-400 bg-sky-500/10",
  },
  {
    id: "nibe",
    label: "NIBE Värmepump",
    entityIds: ["sensor.nibe_indoor_temp", "sensor.nibe_outdoor_temp"],
    fallbackValue: "-- °C",
    unitFallback: "°C",
    subtitle: "Värme & varmvatten",
    icon: Flame,
    accentClass: "text-orange-400 bg-orange-500/10",
  },
];

function formatEntityValue(
  state: string | undefined,
  unit: string | undefined,
  fallback: string,
): string {
  if (!state || state === "unavailable" || state === "unknown") {
    return fallback;
  }
  return unit ? `${state} ${unit}` : state;
}

export function EnergyOverview() {
  const { isConnected, getEntity } = useHomeAssistant();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ENERGY_METRICS.map((metric) => {
        const Icon = metric.icon;
        const matchedEntity = isConnected
          ? metric.entityIds.map((id) => getEntity(id)).find(Boolean)
          : undefined;

        const displayValue = matchedEntity
          ? formatEntityValue(
              matchedEntity.state,
              matchedEntity.attributes.unit_of_measurement ??
                metric.unitFallback,
              metric.fallbackValue,
            )
          : isConnected
            ? metric.fallbackValue
            : metric.id === "zaptec"
              ? "Ej ansluten"
              : metric.fallbackValue;

        return (
          <Card key={metric.id} className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${metric.accentClass}`}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {metric.label}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold text-slate-100">
                {displayValue}
              </p>
              <p className="text-xs text-slate-500">{metric.subtitle}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
