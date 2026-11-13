"use client";

import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { DashboardWidget, WidgetCategory } from "@/lib/supabase/types";

interface EnergyOverviewProps {
  widgets: DashboardWidget[];
  isAdmin: boolean;
}

const CATEGORY_ACCENT: Record<WidgetCategory, string> = {
  energy: "bg-amber-500/10 text-amber-400",
  climate: "bg-orange-500/10 text-orange-400",
  scene: "bg-sky-500/10 text-sky-400",
  security: "bg-emerald-500/10 text-emerald-400",
};

function formatWidgetValue(
  state: string | undefined,
  unit: string | null | undefined,
): string {
  if (!state || state === "unavailable" || state === "unknown") {
    return unit ? `-- ${unit}` : "--";
  }
  return unit ? `${state} ${unit}` : state;
}

export function EnergyOverview({ widgets, isAdmin }: EnergyOverviewProps) {
  const { isConnected, getEntity } = useHomeAssistant();

  const visibleWidgets = widgets.filter((w) => isAdmin || !w.admin_only);

  if (visibleWidgets.length === 0) {
    return (
      <Card className="border-dashed border-slate-800 bg-slate-900/40 text-center text-sm text-slate-400">
        Inga översikts-widgets konfigurerade ännu.
        {isAdmin && " Öppna 'Redigera hemmet' för att lägga till."}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visibleWidgets.map((widget) => {
        const entity = isConnected ? getEntity(widget.ha_entity_id) : undefined;
        const unit =
          widget.unit ?? entity?.attributes.unit_of_measurement ?? null;
        const displayValue = formatWidgetValue(entity?.state, unit);
        const accentClass =
          CATEGORY_ACCENT[widget.widget_category] ??
          "bg-sky-500/10 text-sky-400";

        return (
          <Card key={widget.id} className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
            >
              <DynamicIcon name={widget.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-400">
                {widget.title}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold text-slate-100">
                {displayValue}
              </p>
              {widget.subtitle && (
                <p className="truncate text-xs text-slate-500">
                  {widget.subtitle}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
