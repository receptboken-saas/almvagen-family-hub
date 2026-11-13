"use client";

import { useState } from "react";
import { Lightbulb, Power, Thermometer, Video, Zap } from "lucide-react";
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

  const lightDevices = devices.filter(
    (d) => d.widget_type === "light" || d.widget_type === "dimmer",
  );
  const activeLights = isConnected
    ? lightDevices.filter((d) => getEntity(d.ha_entity_id)?.state === "on").length
    : 0;

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

  return (
    <Card className="flex flex-col justify-between gap-4 hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 text-sky-400">
            <DynamicIcon name={room.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {floorName && (
              <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-400">
                {floorName}
              </p>
            )}
            <h3 className="truncate text-lg font-semibold text-slate-100">
              {room.name}
            </h3>
          </div>
        </div>

        {lightDevices.length > 0 && (
          <span
            className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium ${
              activeLights > 0
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-800/90 text-slate-400"
            }`}
          >
            {isConnected
              ? `${activeLights}/${lightDevices.length} tända`
              : `${devices.length} enheter`}
          </span>
        )}
      </div>

      {devices.length === 0 ? (
        <p className="border-t border-slate-800/80 pt-3 text-xs text-slate-500">
          Inga enheter tillagda i detta rum ännu.
        </p>
      ) : (
        <div className="space-y-2 border-t border-slate-800/80 pt-3">
          {devices.map((device) => {
            const entity = isConnected
              ? getEntity(device.ha_entity_id)
              : undefined;
            const rawState = entity?.state;
            const unit = entity?.attributes.unit_of_measurement;
            const isOn = rawState === "on";
            const toggleable = isToggleableType(device.widget_type);

            if (toggleable) {
              return (
                <button
                  key={device.id}
                  type="button"
                  disabled={!isConnected || Boolean(busyIds[device.id])}
                  onClick={() => toggleDevice(device)}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isOn
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {device.widget_type === "switch" ? (
                      <Power className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Lightbulb
                        className={`h-4 w-4 shrink-0 ${isOn ? "text-amber-400" : "text-slate-500"}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate font-medium">
                      {device.display_name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">
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
                className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {device.widget_type === "climate" ||
                  device.widget_type === "sensor" ? (
                    <Thermometer
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  ) : device.widget_type === "camera" ? (
                    <Video
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  ) : (
                    <Zap
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{device.display_name}</span>
                </span>
                <span className="shrink-0 font-medium text-slate-100">
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
