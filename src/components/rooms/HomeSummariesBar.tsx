"use client";

import { useMemo, useState } from "react";
import {
  Flame,
  Lightbulb,
  PowerOff,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type {
  DashboardWidget,
  Room,
  RoomDevice,
  WeeklyEvent,
} from "@/lib/supabase/types";
import {
  bulkToggleRoomDevices,
  getRoomNumericTemperature,
  isLightType,
  isSecurityDevice,
} from "./roomHelpers";

interface HomeSummariesBarProps {
  rooms: Room[];
  roomDevices: RoomDevice[];
  widgets: DashboardWidget[];
  weeklyEvents?: WeeklyEvent[];
  isAdmin: boolean;
  showEnergy: boolean;
  onSelectEnergyView?: () => void;
  onSelectFamilyView?: () => void;
}

function diffDaysFromToday(dateStr: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type ActiveSummaryModal = "lights" | "climate" | "security" | null;

/**
 * Clickable whole-home summary pills inspired by Home Assistant Sections/Areas,
 * hidden in child Zero Noise mode.
 */
export function HomeSummariesBar({
  rooms,
  roomDevices,
  widgets,
  weeklyEvents = [],
  isAdmin,
  showEnergy,
  onSelectEnergyView,
  onSelectFamilyView,
}: HomeSummariesBarProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [openModal, setOpenModal] = useState<ActiveSummaryModal>(null);
  const [busy, setBusy] = useState(false);

  const roomById = useMemo(
    () => new Map(rooms.map((r) => [r.id, r])),
    [rooms],
  );

  const devicesByRoom = useMemo(() => {
    const map = new Map<string, RoomDevice[]>();
    for (const d of roomDevices) {
      if (!roomById.has(d.room_id)) continue;
      const list = map.get(d.room_id) ?? [];
      list.push(d);
      map.set(d.room_id, list);
    }
    return map;
  }, [roomDevices, roomById]);

  // 1. Lights summary
  const litByRoom = useMemo(() => {
    if (!isConnected) return [];
    const result: { room: Room; litDevices: RoomDevice[] }[] = [];
    for (const room of rooms) {
      const devs = devicesByRoom.get(room.id) ?? [];
      const lit = devs.filter(
        (d) => isLightType(d.widget_type) && getEntity(d.ha_entity_id)?.state === "on",
      );
      if (lit.length > 0) {
        result.push({ room, litDevices: lit });
      }
    }
    return result;
  }, [rooms, devicesByRoom, isConnected, getEntity]);

  const totalLitCount = litByRoom.reduce(
    (sum, item) => sum + item.litDevices.length,
    0,
  );

  // 2. Climate summary
  const climateRooms = useMemo(() => {
    if (!isConnected) return [];
    const list: {
      room: Room;
      temp: number;
      targetTemp: number | null;
      isHeating: boolean;
    }[] = [];
    for (const room of rooms) {
      const devs = devicesByRoom.get(room.id) ?? [];
      const temp = getRoomNumericTemperature(devs, isConnected, getEntity);
      if (temp === null) continue;

      let targetTemp: number | null = null;
      let isHeating = false;
      for (const d of devs) {
        if (d.widget_type !== "climate") continue;
        const entity = getEntity(d.ha_entity_id);
        if (typeof entity?.attributes.temperature === "number") {
          targetTemp = entity.attributes.temperature;
        }
        if (entity?.attributes.hvac_action === "heating") {
          isHeating = true;
        }
      }
      list.push({ room, temp, targetTemp, isHeating });
    }
    return list;
  }, [rooms, devicesByRoom, isConnected, getEntity]);

  const avgTemp =
    climateRooms.length > 0
      ? climateRooms.reduce((sum, r) => sum + r.temp, 0) / climateRooms.length
      : null;

  // 3. Security summary
  const activeSecurity = useMemo(() => {
    if (!isConnected) return [];
    const alerts: { roomName: string; device: RoomDevice; state: string }[] = [];
    for (const room of rooms) {
      const devs = devicesByRoom.get(room.id) ?? [];
      for (const d of devs) {
        const entity = getEntity(d.ha_entity_id);
        if (!isSecurityDevice(d, entity) || !entity) continue;
        if (
          entity.state === "on" ||
          entity.state === "open" ||
          entity.state === "unlocked"
        ) {
          alerts.push({ roomName: room.name, device: d, state: entity.state });
        }
      }
    }
    return alerts;
  }, [rooms, devicesByRoom, isConnected, getEntity]);

  const hasSecurityDevices = useMemo(
    () =>
      roomDevices.some(
        (d) =>
          roomById.has(d.room_id) &&
          isSecurityDevice(d, getEntity(d.ha_entity_id)),
      ),
    [roomDevices, roomById, getEntity],
  );

  // 4. Energy widget summary
  const powerWidget = useMemo(() => {
    if (!showEnergy) return null;
    const candidates = widgets.filter(
      (w) => w.widget_category === "energy" && (isAdmin || !w.admin_only),
    );
    return (
      candidates.find(
        (w) =>
          w.icon === "sys_tibber_pulse" ||
          w.unit?.toUpperCase() === "W" ||
          w.unit?.toLowerCase() === "kw",
      ) ??
      candidates[0] ??
      null
    );
  }, [widgets, isAdmin, showEnergy]);

  const powerEntity =
    isConnected && powerWidget ? getEntity(powerWidget.ha_entity_id) : undefined;
  const powerText =
    powerEntity &&
    powerEntity.state !== "unavailable" &&
    powerEntity.state !== "unknown"
      ? `${powerEntity.state} ${
          powerWidget?.unit ?? powerEntity.attributes.unit_of_measurement ?? "W"
        }`
      : null;

  const urgentWaste = useMemo(() => {
    const candidates = weeklyEvents
      .filter((ev) => ev.category === "waste")
      .map((ev) => ({
        event: ev,
        diffDays: diffDaysFromToday(ev.start_date),
      }))
      .filter((item) => item.diffDays >= 0 && item.diffDays <= 2)
      .sort((a, b) => a.diffDays - b.diffDays);
    return candidates[0] ?? null;
  }, [weeklyEvents]);

  async function turnOffAllLit() {
    if (!isConnected || totalLitCount === 0 || busy) return;
    setBusy(true);
    try {
      const allLit = litByRoom.flatMap((entry) => entry.litDevices);
      await bulkToggleRoomDevices(allLit, false, callService);
      setOpenModal(null);
    } finally {
      setBusy(false);
    }
  }

  async function turnOffRoomLights(devices: RoomDevice[]) {
    if (!isConnected || busy) return;
    setBusy(true);
    try {
      await bulkToggleRoomDevices(devices, false, callService);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        aria-label="Hus-sammanfattningar"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        <button
          type="button"
          onClick={() => setOpenModal("lights")}
          className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            totalLitCount > 0
              ? "border-[#D49A42]/50 bg-[#D49A42]/18 text-[#D49A42] hover:bg-[#D49A42]/28"
              : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[#6B8E6B]"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tabular-nums">Lampor: {totalLitCount} på</span>
        </button>

        {avgTemp !== null && (
          <button
            type="button"
            onClick={() => setOpenModal("climate")}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#C86D51]/35 bg-[#C86D51]/12 px-3.5 py-1.5 text-xs font-semibold text-[#C86D51] transition-colors hover:bg-[#C86D51]/20"
          >
            <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              Klimat: {avgTemp.toFixed(1)}° snitt
            </span>
          </button>
        )}

        {(hasSecurityDevices || activeSecurity.length > 0) && (
          <button
            type="button"
            onClick={() => setOpenModal("security")}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeSecurity.length > 0
                ? "border-[#C86D51]/50 bg-[#C86D51]/15 text-[#C86D51]"
                : "border-[#6B8E6B]/40 bg-[#6B8E6B]/12 text-[#6B8E6B]"
            }`}
          >
            {activeSecurity.length > 0 ? (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="tabular-nums">
              Säkerhet:{" "}
              {activeSecurity.length > 0
                ? `${activeSecurity.length} öppna`
                : "Tryggt"}
            </span>
          </button>
        )}

        {powerWidget && (
          <button
            type="button"
            onClick={onSelectEnergyView}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
          >
            <Zap className="h-3.5 w-3.5 text-[#D49A42]" aria-hidden="true" />
            <span className="tabular-nums">
              Energi: {powerText ?? "--"}
            </span>
          </button>
        )}

        {urgentWaste && (
          <button
            type="button"
            onClick={onSelectFamilyView}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              urgentWaste.diffDays <= 1
                ? "border-[#C86D51]/55 bg-[#C86D51]/15 text-[#C86D51] hover:bg-[#C86D51]/25"
                : "border-[#D49A42]/55 bg-[#D49A42]/15 text-[#D49A42] hover:bg-[#D49A42]/25"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {urgentWaste.diffDays === 0
                ? `Idag: ${urgentWaste.event.title}`
                : urgentWaste.diffDays === 1
                  ? `Imorgon: ${urgentWaste.event.title}`
                  : `Om 2 dagar: ${urgentWaste.event.title}`}
            </span>
          </button>
        )}
      </div>

      {openModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Hussammanfattning"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-[var(--text-primary)] shadow-2xl sm:rounded-3xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="font-display text-lg font-semibold">
                {openModal === "lights"
                  ? `Tända lampor (${totalLitCount})`
                  : openModal === "climate"
                    ? "Klimat i hemmet"
                    : "Säkerhet & Sensorer"}
              </h3>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                aria-label="Stäng"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-2.5 overflow-y-auto">
              {openModal === "lights" && (
                <>
                  {litByRoom.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                      Alla lampor är släckta just nu.
                    </p>
                  ) : (
                    <>
                      {litByRoom.map(({ room, litDevices }) => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {room.name}
                            </p>
                            <p className="truncate text-xs text-[var(--text-secondary)]">
                              {litDevices.map((d) => d.display_name).join(", ")}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => turnOffRoomLights(litDevices)}
                            className="min-h-9 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[#C86D51] hover:text-[#C86D51] disabled:opacity-40"
                          >
                            Släck
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        disabled={busy}
                        onClick={turnOffAllLit}
                        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#D49A42] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-45"
                      >
                        <PowerOff className="h-4 w-4" />
                        <span>Släck alla tända ({totalLitCount})</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {openModal === "climate" && (
                <>
                  {climateRooms.map(({ room, temp, targetTemp, isHeating }) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {room.name}
                        </span>
                        {isHeating && (
                          <Flame className="h-3.5 w-3.5 text-[#C86D51]" />
                        )}
                      </div>
                      <div className="tabular-nums text-right">
                        <span className="text-sm font-bold text-[#C86D51]">
                          {temp.toFixed(1)}°
                        </span>
                        {targetTemp !== null && (
                          <span className="ml-2 text-xs text-[var(--text-secondary)]">
                            (mål {targetTemp.toFixed(1)}°)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {openModal === "security" && (
                <>
                  {activeSecurity.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#6B8E6B]">
                      Allt lugnt — inga öppna dörrar, fönster eller rörelser.
                    </p>
                  ) : (
                    activeSecurity.map(({ roomName, device, state }) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {device.display_name}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {roomName}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#C86D51] px-2.5 py-0.5 text-xs font-semibold text-white">
                          {state}
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
