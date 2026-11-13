"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";
import {
  bulkToggleRoomDevices,
  getRoomTemperatureDisplay,
  isControllableType,
  isLightType,
} from "./roomHelpers";

interface RoomCardProps {
  room: Room;
  floorName?: string;
  devices: RoomDevice[];
  onSelect: () => void;
}

/**
 * Calm, 3-second-readable room summary card with quick bulk actions
 * and click-to-open detail drawer.
 */
export function RoomCard({
  room,
  floorName,
  devices,
  onSelect,
}: RoomCardProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [bulkBusy, setBulkBusy] = useState(false);

  const lightDevices = devices.filter((d) => isLightType(d.widget_type));
  const controllableDevices = devices.filter((d) =>
    isControllableType(d.widget_type),
  );
  const activeLights = isConnected
    ? lightDevices.filter((d) => getEntity(d.ha_entity_id)?.state === "on")
        .length
    : 0;
  const activeControllable = isConnected
    ? controllableDevices.filter(
        (d) => getEntity(d.ha_entity_id)?.state === "on",
      ).length
    : 0;

  const tempDisplay = getRoomTemperatureDisplay(
    devices,
    isConnected,
    getEntity,
  );

  async function handleBulk(turnOn: boolean) {
    if (!isConnected || controllableDevices.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await bulkToggleRoomDevices(controllableDevices, turnOn, callService);
    } catch {
      // Ignore transient service errors
    } finally {
      setBulkBusy(false);
    }
  }

  const lightSummary =
    lightDevices.length === 0
      ? controllableDevices.length > 0
        ? isConnected
          ? `${activeControllable} av ${controllableDevices.length} på`
          : `${controllableDevices.length} brytare`
        : `${devices.length} ${devices.length === 1 ? "enhet" : "enheter"}`
      : isConnected
        ? `${activeLights} av ${lightDevices.length} tända`
        : `${lightDevices.length} ${lightDevices.length === 1 ? "lampa" : "lampor"}`;

  return (
    <Card
      className={`group flex flex-col justify-between gap-4 transition-all ${
        activeControllable > 0
          ? "border-[#D49A42]/60 ring-1 ring-[#D49A42]/20"
          : "hover:border-[#6B8E6B]/60"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="-m-2 flex flex-col gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[var(--bg-subtle)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E6B]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                activeControllable > 0
                  ? "bg-[#D49A42]/20 text-[#D49A42]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-primary)] group-hover:bg-[#6B8E6B]/15 group-hover:text-[#6B8E6B]"
              }`}
            >
              <DynamicIcon name={room.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              {floorName && (
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {floorName}
                </p>
              )}
              <h3 className="font-display truncate text-xl font-semibold text-[var(--text-primary)] lg:text-2xl">
                {room.name}
              </h3>
            </div>
          </div>

          <ChevronRight
            className="mt-1 h-5 w-5 shrink-0 text-[var(--text-secondary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#6B8E6B]"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tempDisplay && (
            <span className="tabular-nums inline-flex items-center gap-1 rounded-xl bg-[#C86D51]/12 px-2.5 py-1 text-xs font-semibold text-[#C86D51]">
              <DynamicIcon name="ctrl_temp" className="h-3.5 w-3.5" />
              <span>{tempDisplay}</span>
            </span>
          )}
          <span
            className={`tabular-nums inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-semibold ${
              activeControllable > 0
                ? "bg-[#D49A42]/15 text-[#D49A42]"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {lightSummary}
          </span>
        </div>
      </button>

      {controllableDevices.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            disabled={!isConnected || bulkBusy}
            onClick={() => handleBulk(true)}
            className="min-h-12 rounded-xl bg-[#D49A42]/18 px-3 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/28 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11"
          >
            Tänd alla
          </button>
          <button
            type="button"
            disabled={!isConnected || bulkBusy}
            onClick={() => handleBulk(false)}
            className="min-h-12 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11"
          >
            Släck alla
          </button>
        </div>
      )}
    </Card>
  );
}
