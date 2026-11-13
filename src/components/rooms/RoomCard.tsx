"use client";

import { useState } from "react";
import {
  ChevronRight,
  Flame,
  Lightbulb,
  Music,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";
import {
  bulkToggleRoomDevices,
  getRoomCapabilities,
  isControllableType,
} from "./roomHelpers";

interface RoomCardProps {
  room: Room;
  devices: RoomDevice[];
  isAdmin?: boolean;
  onSelect: () => void;
  onOpenAdmin?: () => void;
}

/**
 * Compact 3-second multi-function room card rendering only active capability pills
 * and tactile Tänd/Släck controls when controllable devices exist.
 */
export function RoomCard({
  room,
  devices,
  isAdmin = false,
  onSelect,
  onOpenAdmin,
}: RoomCardProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [bulkBusy, setBulkBusy] = useState(false);

  const controllableDevices = devices.filter((d) =>
    isControllableType(d.widget_type),
  );
  const caps = getRoomCapabilities(devices, isConnected, getEntity);

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

  const hasActiveLights = caps.activeControllableCount > 0;
  const activeCountLabel =
    caps.activeLightsCount > 0
      ? caps.activeLightsCount
      : caps.activeControllableCount;

  const hasAnyPill =
    Boolean(caps.temperatureDisplay) ||
    hasActiveLights ||
    caps.hasOpenSecurity ||
    caps.hasActiveMedia;

  return (
    <Card
      className={`group flex flex-col justify-between gap-3 p-4 transition-all ${
        hasActiveLights
          ? "border-[#D49A42]/60 bg-[#D49A42]/[0.04] ring-1 ring-[#D49A42]/20"
          : "hover:border-[#6B8E6B]/60"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="-m-1.5 flex flex-col gap-2.5 rounded-2xl p-1.5 text-left transition-colors hover:bg-[var(--bg-subtle)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E6B]"
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                hasActiveLights
                  ? "bg-[#D49A42]/20 text-[#D49A42]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-primary)] group-hover:bg-[#6B8E6B]/15 group-hover:text-[#6B8E6B]"
              }`}
            >
              <DynamicIcon name={room.icon} className="h-5 w-5" />
            </div>
            <h3 className="font-display truncate text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
              {room.name}
            </h3>
          </div>

          <ChevronRight
            className="h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#6B8E6B]"
            aria-hidden="true"
          />
        </div>

        {hasAnyPill && (
          <div className="flex flex-wrap items-center gap-1.5">
            {caps.temperatureDisplay && (
              <span className="tabular-nums inline-flex items-center gap-1 rounded-full bg-[#C86D51]/12 px-2.5 py-0.5 text-xs font-semibold text-[#C86D51]">
                <span>{caps.temperatureDisplay}</span>
                {caps.isHeating && (
                  <Flame className="h-3 w-3 text-[#C86D51]" aria-label="Värmer" />
                )}
              </span>
            )}

            {hasActiveLights && (
              <span className="tabular-nums inline-flex items-center gap-1 rounded-full bg-[#D49A42]/18 px-2.5 py-0.5 text-xs font-semibold text-[#D49A42]">
                <Lightbulb className="h-3 w-3" aria-hidden="true" />
                <span>{activeCountLabel} på</span>
              </span>
            )}

            {caps.hasOpenSecurity && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C86D51]/15 px-2.5 py-0.5 text-xs font-semibold text-[#C86D51]">
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                <span>Öppet</span>
              </span>
            )}

            {caps.hasActiveMedia && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#6B8E6B]/15 px-2.5 py-0.5 text-xs font-semibold text-[#6B8E6B]">
                <Music className="h-3 w-3" aria-hidden="true" />
                <span>Spelar</span>
              </span>
            )}
          </div>
        )}
      </button>

      {devices.length === 0 && isAdmin && onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-dashed border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B] hover:text-[#6B8E6B]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Koppla enheter</span>
        </button>
      )}

      {controllableDevices.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isConnected || bulkBusy}
            onClick={() => handleBulk(true)}
            className="min-h-11 rounded-xl bg-[#D49A42]/18 px-3 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/28 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tänd
          </button>
          <button
            type="button"
            disabled={!isConnected || bulkBusy}
            onClick={() => handleBulk(false)}
            className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Släck
          </button>
        </div>
      )}
    </Card>
  );
}
