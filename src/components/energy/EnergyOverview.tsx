"use client";

import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { DashboardWidget, WidgetCategory } from "@/lib/supabase/types";

interface EnergyOverviewProps {
  widgets: DashboardWidget[];
  isAdmin: boolean;
  compactPills?: boolean;
  onOpenAdmin?: () => void;
}

const CATEGORY_ACCENT: Record<WidgetCategory, string> = {
  energy: "bg-[#D49A42]/15 text-[#D49A42]",
  climate: "bg-[#C86D51]/15 text-[#C86D51]",
  scene: "bg-[#6B8E6B]/15 text-[#6B8E6B]",
  security: "bg-[#6B8E6B]/15 text-[#6B8E6B]",
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

export function EnergyOverview({
  widgets,
  isAdmin,
  compactPills = false,
  onOpenAdmin,
}: EnergyOverviewProps) {
  const { isConnected, getEntity } = useHomeAssistant();

  const visibleWidgets = widgets.filter(
    (w) => w.widget_category !== "scene" && (isAdmin || !w.admin_only),
  );

  if (visibleWidgets.length === 0) {
    if (!isAdmin) return null;
    if (compactPills) return null;
    return (
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenAdmin}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B] hover:text-[#6B8E6B]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Lägg till widget</span>
        </button>
      </div>
    );
  }

  if (compactPills) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleWidgets.map((widget) => {
          const entity = isConnected ? getEntity(widget.ha_entity_id) : undefined;
          const unit =
            widget.unit ?? entity?.attributes.unit_of_measurement ?? null;
          const displayValue = formatWidgetValue(entity?.state, unit);
          const accentClass =
            CATEGORY_ACCENT[widget.widget_category] ??
            "bg-[#6B8E6B]/15 text-[#6B8E6B]";

          return (
            <div
              key={widget.id}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 shadow-sm"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${accentClass}`}
              >
                <DynamicIcon name={widget.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {widget.title}
              </span>
              <span className="tabular-nums text-xs font-bold text-[var(--text-primary)]">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
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
          "bg-[#6B8E6B]/15 text-[#6B8E6B]";

        return (
          <Card
            key={widget.id}
            className="flex items-center gap-4 hover:border-[#6B8E6B]/50"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
            >
              <DynamicIcon name={widget.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {widget.title}
              </p>
              <p className="tabular-nums mt-0.5 truncate text-xl font-bold text-[var(--text-primary)]">
                {displayValue}
              </p>
              {widget.subtitle && (
                <p className="truncate text-xs text-[var(--text-secondary)]">
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
