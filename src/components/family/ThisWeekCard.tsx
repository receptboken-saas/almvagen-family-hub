"use client";

import { useMemo } from "react";
import { CalendarRange, Sparkles, Truck } from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { getCurrentWeekBounds } from "@/lib/supabase/useHomeData";
import type { HouseholdSettings, WeeklyEvent } from "@/lib/supabase/types";
import { Card } from "@/components/ui/Card";

interface ThisWeekCardProps {
  propertyId: string | null;
  weeklyEvents: WeeklyEvent[];
  householdSettings?: HouseholdSettings | null;
  isAdmin?: boolean;
}

/**
 * Minimalist "Denna vecka" widget: filters weekly_events for today..Sunday
 * plus optional HA waste sensor, and hides completely when 0 events exist.
 */
export function ThisWeekCard({
  propertyId,
  weeklyEvents,
  householdSettings,
  isAdmin = false,
}: ThisWeekCardProps) {
  const { isConnected, getEntity } = useHomeAssistant();

  const { activeEvents, haWasteText } = useMemo(() => {
    const { todayStr, sundayStr } = getCurrentWeekBounds();
    const filtered = weeklyEvents.filter(
      (ev) =>
        (!propertyId || ev.property_id === propertyId) &&
        ev.start_date <= sundayStr &&
        ev.end_date >= todayStr,
    );

    let wasteText: string | null = null;
    const wasteEntityId = householdSettings?.waste_ha_entity_id;
    if (isConnected && wasteEntityId) {
      const entity = getEntity(wasteEntityId);
      if (
        entity &&
        entity.state &&
        entity.state !== "unavailable" &&
        entity.state !== "unknown" &&
        entity.state !== "none" &&
        entity.state !== "off"
      ) {
        const label = entity.attributes.friendly_name ?? "Sophämtning";
        wasteText = `${label}: ${entity.state}`;
      }
    }

    return { activeEvents: filtered, haWasteText: wasteText };
  }, [propertyId, weeklyEvents, householdSettings, isConnected, getEntity]);

  const totalItems = activeEvents.length + (haWasteText ? 1 : 0);

  if (totalItems === 0) {
    if (!isAdmin) return null;
    return (
      <p className="text-xs text-[var(--text-secondary)]">
        Denna vecka: inga schemalagda händelser eller lovdagar.
      </p>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-[#6B8E6B]" aria-hidden="true" />
        <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
          Denna vecka
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeEvents.map((ev) => {
          const isWaste = ev.category === "waste";
          const isHoliday = ev.category === "school_off";
          const pillClass = isWaste
            ? "border-[#C86D51]/40 bg-[#C86D51]/12 text-[#C86D51]"
            : isHoliday
              ? "border-[#6B8E6B]/40 bg-[#6B8E6B]/14 text-[#6B8E6B]"
              : "border-[#D49A42]/40 bg-[#D49A42]/14 text-[#D49A42]";

          return (
            <span
              key={ev.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${pillClass}`}
            >
              {isWaste ? (
                <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : isHoliday ? (
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <CalendarRange
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{ev.title}</span>
              {ev.subtitle && (
                <span className="opacity-80">· {ev.subtitle}</span>
              )}
            </span>
          );
        })}

        {haWasteText && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C86D51]/40 bg-[#C86D51]/12 px-3 py-1.5 text-xs font-semibold text-[#C86D51]">
            <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{haWasteText}</span>
          </span>
        )}
      </div>
    </Card>
  );
}
