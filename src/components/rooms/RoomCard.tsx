"use client";

import { useState } from "react";
import { Power, Video, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";

interface RoomCardProps {
  room: Room;
  floorName?: string;
  devices: RoomDevice[];
}

function isToggleableType(type: RoomDevice["widget_type"]): boolean {
  return type === "light" || type === "dimmer" || type === "switch";
}

function getServiceDomain(entityId: string, type: RoomDevice["widget_type"]): string {
  const prefix = entityId.split(".")[0];
  if (prefix) return prefix;
  return type === "switch" ? "switch" : "light";
}

export function RoomCard({ room, floorName, devices }: RoomCardProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const lightDevices = devices.filter(
    (d) => d.widget_type === "light" || d.widget_type === "dimmer",
  );
  const lightEntityIds = lightDevices.map((d) => d.ha_entity_id);
  const activeLights = isConnected
    ? lightDevices.filter((d) => getEntity(d.ha_entity_id)?.state === "on").length
    : 0;

  const tempDevice = devices.find((d) => {
    if (d.widget_type !== "climate" && d.widget_type !== "sensor") return false;
    const entity = isConnected ? getEntity(d.ha_entity_id) : undefined;
    const unit = entity?.attributes.unit_of_measurement ?? "";
    const devClass = entity?.attributes.device_class ?? "";
    return (
      devClass === "temperature" ||
      unit.includes("°C") ||
      d.ha_entity_id.includes("temp") ||
      d.display_name.toLowerCase().includes("temp")
    );
  });
  const tempEntity =
    isConnected && tempDevice ? getEntity(tempDevice.ha_entity_id) : undefined;
  const tempDisplay =
    tempEntity &&
    tempEntity.state !== "unavailable" &&
    tempEntity.state !== "unknown"
      ? `${tempEntity.state} ${tempEntity.attributes.unit_of_measurement ?? "°C"}`
      : null;

  async function toggleDevice(device: RoomDevice) {
    if (!isConnected || busyIds[device.id]) return;
    const entity = getEntity(device.ha_entity_id);
    const isOn = entity?.state === "on";
    const domain = getServiceDomain(device.ha_entity_id, device.widget_type);

    setBusyIds((prev) => ({ ...prev, [device.id]: true }));
    try {
      await callService(domain, isOn ? "turn_off" : "turn_on", {
        entity_id: device.ha_entity_id,
      });
    } catch {
      // Ignore transient service errors
    } finally {
      setBusyIds((prev) => ({ ...prev, [device.id]: false }));
    }
  }

  async function handleBulkLights(turnOn: boolean) {
    if (!isConnected || lightEntityIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await callService("light", turnOn ? "turn_on" : "turn_off", {
        entity_id: lightEntityIds,
      });
    } catch {
      // Ignore transient errors
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <Card
      className={`flex flex-col justify-between gap-4 transition-all ${
        activeLights > 0
          ? "border-[#D49A42]/60 ring-1 ring-[#D49A42]/20"
          : "hover:border-[#6B8E6B]/50"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                activeLights > 0
                  ? "bg-[#D49A42]/20 text-[#D49A42]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
              }`}
            >
              <DynamicIcon name={room.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {floorName && (
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {floorName}
                </p>
              )}
              <h3 className="font-display truncate text-xl font-semibold text-[var(--text-primary)]">
                {room.name}
              </h3>
            </div>
          </div>

          {tempDisplay && (
            <span className="tabular-nums inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#C86D51]/12 px-2.5 py-1.5 text-xs font-semibold text-[#C86D51]">
              <DynamicIcon name="ctrl_temp" className="h-3.5 w-3.5" />
              <span>{tempDisplay}</span>
            </span>
          )}
        </div>

        {lightDevices.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/80 px-3 py-2">
            <span
              className={`tabular-nums text-xs font-semibold ${
                activeLights > 0
                  ? "text-[#D49A42]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {isConnected
                ? `${activeLights} av ${lightDevices.length} tända`
                : `${lightDevices.length} lampor`}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulkLights(true)}
                className="min-h-8 rounded-lg bg-[#D49A42]/20 px-2.5 py-1 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tänd alla
              </button>
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulkLights(false)}
                className="min-h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Släck alla
              </button>
            </div>
          </div>
        )}
      </div>

      {devices.length === 0 ? (
        <p className="border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
          Inga enheter tillagda i detta rum ännu.
        </p>
      ) : (
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          {devices.map((device) => {
            const entity = isConnected
              ? getEntity(device.ha_entity_id)
              : undefined;
            const rawState = entity?.state;
            const unit = entity?.attributes.unit_of_measurement;
            const isOn = rawState === "on";
            const toggleable = isToggleableType(device.widget_type);

            if (toggleable) {
              const isLight =
                device.widget_type === "light" ||
                device.widget_type === "dimmer";
              return (
                <button
                  key={device.id}
                  type="button"
                  disabled={!isConnected || Boolean(busyIds[device.id])}
                  onClick={() => toggleDevice(device)}
                  className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${
                    isOn
                      ? isLight
                        ? "border-[#D49A42]/60 bg-[#D49A42]/15 text-[var(--text-primary)] hover:bg-[#D49A42]/25"
                        : "border-[#6B8E6B]/60 bg-[#6B8E6B]/15 text-[var(--text-primary)] hover:bg-[#6B8E6B]/25"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 text-[var(--text-secondary)] hover:border-[#6B8E6B]/50 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {device.widget_type === "switch" ? (
                      <Power
                        className={`h-4 w-4 shrink-0 ${
                          isOn
                            ? "text-[#6B8E6B]"
                            : "text-[var(--text-secondary)]"
                        }`}
                        aria-hidden="true"
                      />
                    ) : (
                      <DynamicIcon
                        name={
                          device.widget_type === "dimmer"
                            ? "light_dimmer"
                            : "light_hue"
                        }
                        className={`h-4 w-4 shrink-0 ${
                          isOn
                            ? "text-[#D49A42]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      />
                    )}
                    <span className="truncate font-medium">
                      {device.display_name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      !isConnected
                        ? "text-[var(--text-secondary)]"
                        : isOn
                          ? isLight
                            ? "bg-[#D49A42]/20 text-[#D49A42]"
                            : "bg-[#6B8E6B]/20 text-[#6B8E6B]"
                          : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {!isConnected ? "--" : isOn ? "På" : "Av"}
                  </span>
                </button>
              );
            }

            const valueText =
              !rawState || rawState === "unavailable" || rawState === "unknown"
                ? "--"
                : unit
                  ? `${rawState} ${unit}`
                  : rawState;

            return (
              <div
                key={device.id}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-3.5 py-2 text-sm text-[var(--text-secondary)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {device.widget_type === "climate" ||
                  device.widget_type === "sensor" ? (
                    <DynamicIcon
                      name="ctrl_temp"
                      className="h-4 w-4 shrink-0 text-[#C86D51]"
                    />
                  ) : device.widget_type === "camera" ? (
                    <Video
                      className="h-4 w-4 shrink-0 text-[#6B8E6B]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Zap
                      className="h-4 w-4 shrink-0 text-[#D49A42]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{device.display_name}</span>
                </span>
                <span className="tabular-nums shrink-0 font-semibold text-[var(--text-primary)]">
                  {valueText}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
