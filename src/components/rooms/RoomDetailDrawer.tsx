"use client";

import { useEffect, useState } from "react";
import { Thermometer, X } from "lucide-react";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";
import { RoomDeviceControls } from "./RoomDeviceControls";
import {
  bulkToggleRoomDevices,
  getRoomTemperatureDisplay,
  isControllableType,
} from "./roomHelpers";

interface RoomDetailDrawerProps {
  room: Room | null;
  floorName?: string;
  devices: RoomDevice[];
  onClose: () => void;
}

/**
 * Responsive detail drawer (right slide-over on tablet/desktop, bottom-sheet on mobile)
 * displaying all devices in a room grouped by category with dimmer sliders and toggles.
 */
export function RoomDetailDrawer({
  room,
  floorName,
  devices,
  onClose,
}: RoomDetailDrawerProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!room) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [room, onClose]);

  if (!room) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-stretch sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Detaljvy för ${room.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl sm:h-full sm:max-h-none sm:max-w-lg sm:rounded-l-3xl sm:rounded-tr-none">
        {/* Header */}
        <div className="space-y-4 border-b border-[var(--border-subtle)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
                <DynamicIcon name={room.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                {floorName && (
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {floorName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display truncate text-2xl font-semibold text-[var(--text-primary)]">
                    {room.name}
                  </h2>
                  {tempDisplay && (
                    <span className="tabular-nums inline-flex items-center gap-1 rounded-xl bg-[#C86D51]/12 px-2.5 py-1 text-xs font-semibold text-[#C86D51]">
                      <Thermometer className="h-3.5 w-3.5" />
                      <span>{tempDisplay}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Stäng rumsdetaljer"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {controllableDevices.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(true)}
                className="min-h-11 rounded-xl bg-[#D49A42]/20 px-4 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tänd alla
              </button>
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(false)}
                className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Släck alla
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <RoomDeviceControls roomName={room.name} devices={devices} />
        </div>
      </div>
    </div>
  );
}
