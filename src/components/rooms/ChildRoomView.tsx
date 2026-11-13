"use client";

import { useState } from "react";
import { Thermometer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";
import { RoomDeviceControls } from "./RoomDeviceControls";
import {
  bulkToggleRoomDevices,
  getRoomTemperatureDisplay,
  isControllableType,
} from "./roomHelpers";

interface ChildRoomViewProps {
  room: Room;
  floorName?: string;
  devices: RoomDevice[];
}

/**
 * Zero-noise direct room control view for child profiles with a single assigned room.
 */
export function ChildRoomView({
  room,
  floorName,
  devices,
}: ChildRoomViewProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [bulkBusy, setBulkBusy] = useState(false);

  const controllableDevices = devices.filter((d) =>
    isControllableType(d.widget_type),
  );
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
      // Ignore transient errors
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
            <DynamicIcon name={room.icon} className="h-6 w-6" />
          </div>
          <div>
            {floorName && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {floorName}
              </p>
            )}
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              {room.name}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tempDisplay && (
            <span className="tabular-nums inline-flex items-center gap-1 rounded-xl bg-[#C86D51]/12 px-3 py-1.5 text-xs font-semibold text-[#C86D51]">
              <Thermometer className="h-3.5 w-3.5" />
              <span>{tempDisplay}</span>
            </span>
          )}
          {controllableDevices.length > 0 && (
            <>
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(true)}
                className="min-h-11 rounded-xl bg-[#D49A42]/20 px-4 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/30 disabled:opacity-40"
              >
                Tänd alla
              </button>
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(false)}
                className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Släck alla
              </button>
            </>
          )}
        </div>
      </div>

      <RoomDeviceControls roomName={room.name} devices={devices} />
    </Card>
  );
}
