import { Lightbulb, Thermometer } from "lucide-react";
import type { RoomConfig } from "@/config/rooms.config";
import { Card } from "@/components/ui/Card";

interface RoomCardProps {
  room: RoomConfig;
}

export function RoomCard({ room }: RoomCardProps) {
  const lightCount = room.entities.lights?.length ?? 0;

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
          <span>-- °C</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span>Väntar på HA</span>
        </span>
      </div>
    </Card>
  );
}
