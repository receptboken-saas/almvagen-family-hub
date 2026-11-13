"use client";

import { useState } from "react";
import { Lightbulb, Thermometer } from "lucide-react";
import type { RoomConfig } from "@/config/rooms.config";
import { Card } from "@/components/ui/Card";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";

interface RoomCardProps {
  room: RoomConfig;
}

export function RoomCard({ room }: RoomCardProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [isToggling, setIsToggling] = useState(false);

  const lightIds = room.entities.lights ?? [];
  const lightCount = lightIds.length;

  const tempEntity =
    isConnected && room.entities.temperatureSensor
      ? getEntity(room.entities.temperatureSensor)
      : undefined;

  const tempDisplay =
    tempEntity &&
    tempEntity.state !== "unavailable" &&
    tempEntity.state !== "unknown"
      ? `${tempEntity.state} ${tempEntity.attributes.unit_of_measurement ?? "°C"}`
      : "-- °C";

  const activeLights = isConnected
    ? lightIds.filter((id) => getEntity(id)?.state === "on").length
    : 0;
  const anyLightOn = activeLights > 0;

  async function handleToggleLights() {
    if (!isConnected || lightCount === 0 || isToggling) return;
    setIsToggling(true);
    try {
      await callService("light", anyLightOn ? "turn_off" : "turn_on", {
        entity_id: lightIds,
      });
    } catch {
      // Service error is handled silently; state remains unchanged
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <Card className="flex flex-col justify-between gap-4 hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {room.floor}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">
            {room.name}
          </h3>
        </div>
        <span className="rounded-xl bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-300">
          {lightCount} {lightCount === 1 ? "lampa" : "lampor"}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-sm text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Thermometer className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span>{tempDisplay}</span>
        </span>

        {isConnected && lightCount > 0 ? (
          <button
            type="button"
            onClick={handleToggleLights}
            disabled={isToggling}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              anyLightOn
                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {anyLightOn ? `${activeLights}/${lightCount} tända` : "Släckt"}
            </span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>{isConnected ? "Inga lampor" : "Väntar på HA"}</span>
          </span>
        )}
      </div>
    </Card>
  );
}
