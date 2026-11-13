import { Zap, Flame, PlugZap, Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";

const ENERGY_METRICS = [
  {
    id: "tibber-power",
    label: "Tibber Pulse",
    value: "-- W",
    subtitle: "Realtidseffekt",
    icon: Zap,
    accentClass: "text-amber-400 bg-amber-500/10",
  },
  {
    id: "tibber-price",
    label: "Elpris just nu",
    value: "-- öre/kWh",
    subtitle: "Spotpris inkl. moms",
    icon: Coins,
    accentClass: "text-emerald-400 bg-emerald-500/10",
  },
  {
    id: "zaptec",
    label: "Zaptec Laddbox",
    value: "Ej ansluten",
    subtitle: "Elbilsladdning",
    icon: PlugZap,
    accentClass: "text-sky-400 bg-sky-500/10",
  },
  {
    id: "nibe",
    label: "NIBE Värmepump",
    value: "-- °C",
    subtitle: "Värme & varmvatten",
    icon: Flame,
    accentClass: "text-orange-400 bg-orange-500/10",
  },
] as const;

export function EnergyOverview() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ENERGY_METRICS.map((metric) => {
        const Icon = metric.icon;
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
                {metric.value}
              </p>
              <p className="text-xs text-slate-500">{metric.subtitle}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
