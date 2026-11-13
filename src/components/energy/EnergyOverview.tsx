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
  energy: "bg-[#F59E0B]/15 text-[#F59E0B]",
  climate: "bg-[#38BDF8]/15 text-[#38BDF8]",
  scene: "bg-[#38BDF8]/15 text-[#38BDF8]",
  security: "bg-[#22C55E]/15 text-[#22C55E]",
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

  const visibleWidgets = widgets.filter(
    (w) => w.widget_category !== "scene" && (isAdmin || !w.admin_only),
  );

  if (visibleWidgets.length === 0) {
    return (
      <Card className="flex items-center justify-center border-dashed border-slate-800 bg-[#131A26]/50 text-center text-sm text-slate-400">
        Inga översikts-widgets konfigurerade ännu.
        {isAdmin && " Öppna 'Redigera hemmet' för att lägga till."}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visibleWidgets.map((widget) => {
        const entity = isConnected ? getEntity(widget.ha_entity_id) : undefined;
        const unit =
          widget.unit ?? entity?.attributes.unit_of_measurement ?? null;
        const displayValue = formatWidgetValue(entity?.state, unit);
        const accentClass =
          CATEGORY_ACCENT[widget.widget_category] ??
          "bg-[#38BDF8]/15 text-[#38BDF8]";

        return (
          <Card
            key={widget.id}
            className="flex items-center gap-4 hover:border-slate-700"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
            >
              <DynamicIcon name={widget.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-400">
                {widget.title}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold text-slate-50">
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
