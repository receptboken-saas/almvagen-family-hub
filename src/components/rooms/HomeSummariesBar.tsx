"use client";

import { useMemo, useState } from "react";
import {
  BatteryWarning,
  Flame,
  Lightbulb,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  PlusCircle,
  PowerOff,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Thermometer,
  Trash2,
  Volume2,
  WifiOff,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { HassEntity } from "@/lib/ha/types";
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
  onOpenAdmin?: () => void;
}

function diffDaysFromToday(dateStr: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type ActiveSummaryModal =
  | "lights"
  | "climate"
  | "security"
  | "media"
  | "maintenance"
  | "discovered"
  | null;

const MOBILE_BATTERY_EXCLUSIONS = [
  "iphone",
  "ipad",
  "pixel",
  "galaxy",
  "oneplus",
  "mobile_app",
  "telefon",
  "watch",
  "klocka",
];

const DISCOVERABLE_DOMAINS = new Set([
  "light",
  "climate",
  "switch",
  "media_player",
  "cover",
  "lock",
]);

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
  onOpenAdmin,
}: HomeSummariesBarProps) {
  const { isConnected, entities, getEntity, callService } = useHomeAssistant();
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
      climateDevice: RoomDevice | null;
      minTemp: number;
      maxTemp: number;
    }[] = [];
    for (const room of rooms) {
      const devs = devicesByRoom.get(room.id) ?? [];
      const temp = getRoomNumericTemperature(devs, isConnected, getEntity);
      if (temp === null) continue;

      let targetTemp: number | null = null;
      let isHeating = false;
      let climateDevice: RoomDevice | null = null;
      let minTemp = 5;
      let maxTemp = 30;
      for (const d of devs) {
        if (d.widget_type !== "climate" && !d.ha_entity_id.startsWith("climate.")) {
          continue;
        }
        const entity = getEntity(d.ha_entity_id);
        if (!climateDevice && d.ha_entity_id.startsWith("climate.")) {
          climateDevice = d;
        }
        if (typeof entity?.attributes.temperature === "number") {
          targetTemp = entity.attributes.temperature;
        }
        if (typeof entity?.attributes.min_temp === "number") {
          minTemp = entity.attributes.min_temp;
        }
        if (typeof entity?.attributes.max_temp === "number") {
          maxTemp = entity.attributes.max_temp;
        }
        if (entity?.attributes.hvac_action === "heating") {
          isHeating = true;
        }
      }
      list.push({
        room,
        temp,
        targetTemp,
        isHeating,
        climateDevice,
        minTemp,
        maxTemp,
      });
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

  // 5. Today's energy (kWh) summary
  const dailyEnergyText = useMemo(() => {
    if (!showEnergy || !isConnected) return null;
    const isExcluded = (txt: string) =>
      txt.includes("cost") ||
      txt.includes("kostnad") ||
      txt.includes("month") ||
      txt.includes("manad") ||
      txt.includes("year") ||
      txt.includes("week") ||
      txt.includes("maxtimme") ||
      txt.includes("peak");

    const isDailyMatch = (txt: string) =>
      txt.includes("accumulated_consumption") ||
      txt.includes("ackumulerad") ||
      txt.includes("today") ||
      txt.includes("daily") ||
      txt.includes("dagens") ||
      txt.includes("idag");

    const widgetMatch = widgets.find((w) => {
      if (w.widget_category !== "energy" || (!isAdmin && w.admin_only)) {
        return false;
      }
      const ent = getEntity(w.ha_entity_id);
      const unit = (
        w.unit ??
        ent?.attributes.unit_of_measurement ??
        ""
      ).toLowerCase();
      if (unit !== "kwh" && ent?.attributes.device_class !== "energy") {
        return false;
      }
      const txt = `${w.ha_entity_id} ${w.title}`.toLowerCase();
      return isDailyMatch(txt) && !isExcluded(txt);
    });

    let targetEntity: HassEntity | undefined = widgetMatch
      ? getEntity(widgetMatch.ha_entity_id)
      : undefined;

    if (!targetEntity) {
      targetEntity = Object.values(entities).find((ent) => {
        if (
          !ent.entity_id.startsWith("sensor.") ||
          ent.state === "unavailable" ||
          ent.state === "unknown"
        ) {
          return false;
        }
        const unit = (ent.attributes.unit_of_measurement ?? "").toLowerCase();
        const isEnergy =
          ent.attributes.device_class === "energy" || unit === "kwh";
        if (!isEnergy) return false;
        const txt = `${ent.entity_id} ${ent.attributes.friendly_name ?? ""}`.toLowerCase();
        return isDailyMatch(txt) && !isExcluded(txt);
      });
    }

    if (
      !targetEntity ||
      targetEntity.state === "unavailable" ||
      targetEntity.state === "unknown"
    ) {
      return null;
    }
    const num = Number.parseFloat(targetEntity.state);
    if (!Number.isFinite(num)) return null;
    const formatted =
      num < 10
        ? num.toFixed(2).replace(".", ",")
        : num.toFixed(1).replace(".", ",");
    return `${formatted} kWh`;
  }, [showEnergy, isConnected, widgets, isAdmin, getEntity, entities]);

  // 6. Active media players (only playing or paused)
  const activeMediaPlayers = useMemo(() => {
    if (!isConnected) return [];
    return Object.values(entities)
      .filter(
        (ent) =>
          ent.entity_id.startsWith("media_player.") &&
          (ent.state === "playing" || ent.state === "paused"),
      )
      .sort((a, b) => {
        if (a.state === "playing" && b.state !== "playing") return -1;
        if (a.state !== "playing" && b.state === "playing") return 1;
        return a.entity_id.localeCompare(b.entity_id);
      });
  }, [isConnected, entities]);

  // 7. Maintenance (Admin only: low batteries < 20% excluding phones + unavailable room devices)
  const lowBatteries = useMemo(() => {
    if (!isAdmin || !isConnected) return [];
    return Object.values(entities)
      .filter((ent) => {
        if (!ent.entity_id.startsWith("sensor.")) return false;
        if (ent.attributes.device_class !== "battery") return false;
        const txt = `${ent.entity_id} ${ent.attributes.friendly_name ?? ""}`.toLowerCase();
        if (MOBILE_BATTERY_EXCLUSIONS.some((ex) => txt.includes(ex))) {
          return false;
        }
        const level = Number.parseFloat(ent.state);
        return Number.isFinite(level) && level >= 0 && level < 20;
      })
      .map((ent) => ({
        entity: ent,
        level: Number.parseFloat(ent.state),
      }))
      .sort((a, b) => a.level - b.level);
  }, [isAdmin, isConnected, entities]);

  const unavailableDevices = useMemo(() => {
    if (!isAdmin || !isConnected) return [];
    const list: { roomName: string; device: RoomDevice }[] = [];
    for (const room of rooms) {
      const devs = devicesByRoom.get(room.id) ?? [];
      for (const d of devs) {
        if (getEntity(d.ha_entity_id)?.state === "unavailable") {
          list.push({ roomName: room.name, device: d });
        }
      }
    }
    return list;
  }, [isAdmin, isConnected, rooms, devicesByRoom, getEntity]);

  const maintenanceCount = lowBatteries.length + unavailableDevices.length;

  // 8. Discovered unmapped controllable HA entities (Admin only)
  const discoveredEntities = useMemo(() => {
    if (!isAdmin || !isConnected) return [];
    const mappedIds = new Set<string>([
      ...roomDevices.map((d) => d.ha_entity_id),
      ...widgets.map((w) => w.ha_entity_id),
    ]);
    return Object.values(entities)
      .filter((ent) => {
        const domain = ent.entity_id.split(".")[0];
        if (!DISCOVERABLE_DOMAINS.has(domain)) return false;
        if (ent.state === "unavailable" || ent.state === "unknown") return false;
        return !mappedIds.has(ent.entity_id);
      })
      .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  }, [isAdmin, isConnected, entities, roomDevices, widgets]);

  async function adjustRoomTargetTemp(
    device: RoomDevice,
    currentTarget: number,
    delta: number,
    minTemp: number,
    maxTemp: number,
  ) {
    if (!isConnected || !isAdmin || busy) return;
    const next = Math.min(
      maxTemp,
      Math.max(minTemp, Math.round((currentTarget + delta) * 2) / 2),
    );
    setBusy(true);
    try {
      await callService("climate", "set_temperature", {
        entity_id: device.ha_entity_id,
        temperature: next,
      });
    } finally {
      setBusy(false);
    }
  }

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

        {showEnergy && (powerWidget || dailyEnergyText) && (
          <button
            type="button"
            onClick={onSelectEnergyView}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B]"
          >
            <Zap className="h-3.5 w-3.5 text-[#D49A42]" aria-hidden="true" />
            <span className="tabular-nums">
              Energi:{" "}
              {[powerText, dailyEnergyText].filter(Boolean).join(" · ") || "--"}
            </span>
          </button>
        )}

        {activeMediaPlayers.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenModal("media")}
            className="inline-flex min-h-10 max-w-[240px] shrink-0 items-center gap-2 rounded-full border border-[#6B8E6B]/45 bg-[#6B8E6B]/14 px-3.5 py-1.5 text-xs font-semibold text-[#6B8E6B] transition-colors hover:bg-[#6B8E6B]/22"
          >
            <Music className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {activeMediaPlayers.length === 1
                ? `Media: ${
                    (activeMediaPlayers[0].attributes.media_title as
                      | string
                      | undefined) ??
                    activeMediaPlayers[0].attributes.friendly_name ??
                    "Spelar"
                  }`
                : `Media: ${activeMediaPlayers.length} aktiva`}
            </span>
          </button>
        )}

        {isAdmin && maintenanceCount > 0 && (
          <button
            type="button"
            onClick={() => setOpenModal("maintenance")}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#C86D51]/45 bg-[#C86D51]/14 px-3.5 py-1.5 text-xs font-semibold text-[#C86D51] transition-colors hover:bg-[#C86D51]/22"
          >
            <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              Underhåll: {maintenanceCount}
            </span>
          </button>
        )}

        {isAdmin && discoveredEntities.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenModal("discovered")}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#D49A42]/45 bg-[#D49A42]/14 px-3.5 py-1.5 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/22"
          >
            <PlusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              Upptäckta: {discoveredEntities.length}
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
                    : openModal === "security"
                      ? "Säkerhet & Sensorer"
                      : openModal === "media"
                        ? "Mediaspelare"
                        : openModal === "maintenance"
                          ? `Underhåll (${maintenanceCount})`
                          : `Upptäckta enheter (${discoveredEntities.length})`}
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
                  {climateRooms.map(
                    ({
                      room,
                      temp,
                      targetTemp,
                      isHeating,
                      climateDevice,
                      minTemp,
                      maxTemp,
                    }) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {room.name}
                          </span>
                          {isHeating && (
                            <Flame className="h-3.5 w-3.5 shrink-0 text-[#C86D51]" />
                          )}
                        </div>
                        <div className="tabular-nums flex shrink-0 items-center gap-2 text-right">
                          <span className="text-sm font-bold text-[#C86D51]">
                            {temp.toFixed(1)}°
                          </span>
                          {targetTemp !== null && isAdmin && climateDevice ? (
                            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5">
                              <button
                                type="button"
                                disabled={busy || targetTemp <= minTemp}
                                onClick={() =>
                                  adjustRoomTargetTemp(
                                    climateDevice,
                                    targetTemp,
                                    -0.5,
                                    minTemp,
                                    maxTemp,
                                  )
                                }
                                aria-label={`Sänk måltemperatur i ${room.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[3.2rem] text-center text-xs font-semibold text-[var(--text-primary)]">
                                {targetTemp.toFixed(1)}°
                              </span>
                              <button
                                type="button"
                                disabled={busy || targetTemp >= maxTemp}
                                onClick={() =>
                                  adjustRoomTargetTemp(
                                    climateDevice,
                                    targetTemp,
                                    0.5,
                                    minTemp,
                                    maxTemp,
                                  )
                                }
                                aria-label={`Höj måltemperatur i ${room.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            targetTemp !== null && (
                              <span className="text-xs text-[var(--text-secondary)]">
                                (mål {targetTemp.toFixed(1)}°)
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    ),
                  )}
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

              {openModal === "media" && (
                <>
                  {activeMediaPlayers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                      Ingen media spelas upp just nu.
                    </p>
                  ) : (
                    activeMediaPlayers.map((player) => {
                      const title =
                        (player.attributes.media_title as string | undefined) ??
                        (player.state === "playing" ? "Spelar" : "Pausad");
                      const artist = player.attributes.media_artist as
                        | string
                        | undefined;
                      const vol =
                        typeof player.attributes.volume_level === "number"
                          ? player.attributes.volume_level
                          : null;
                      const isPlaying = player.state === "playing";
                      return (
                        <div
                          key={player.entity_id}
                          className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                {player.attributes.friendly_name ??
                                  player.entity_id}
                              </p>
                              <p className="truncate text-sm font-semibold">
                                {title}
                              </p>
                              {artist && (
                                <p className="truncate text-xs text-[var(--text-secondary)]">
                                  {artist}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  void callService(
                                    "media_player",
                                    "media_play_pause",
                                    { entity_id: player.entity_id },
                                  )
                                }
                                aria-label={isPlaying ? "Pausa" : "Spela"}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B8E6B] text-white hover:opacity-90"
                              >
                                {isPlaying ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void callService(
                                    "media_player",
                                    "media_next_track",
                                    { entity_id: player.entity_id },
                                  )
                                }
                                aria-label="Nästa spår"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[#6B8E6B]"
                              >
                                <SkipForward className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {vol !== null && (
                            <div className="flex items-center gap-2.5">
                              <Volume2 className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(vol * 100)}
                                aria-label={`Volym för ${player.attributes.friendly_name ?? player.entity_id}`}
                                onChange={(e) =>
                                  void callService(
                                    "media_player",
                                    "volume_set",
                                    {
                                      entity_id: player.entity_id,
                                      volume_level:
                                        Number(e.target.value) / 100,
                                    },
                                  )
                                }
                                className="h-1.5 w-full accent-[#6B8E6B]"
                              />
                              <span className="tabular-nums w-9 text-right text-xs text-[var(--text-secondary)]">
                                {Math.round(vol * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {openModal === "maintenance" && (
                <div className="space-y-4">
                  {lowBatteries.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        <BatteryWarning className="h-3.5 w-3.5 text-[#D49A42]" />
                        <span>Låga batterier ({lowBatteries.length})</span>
                      </p>
                      {lowBatteries.map(({ entity, level }) => (
                        <div
                          key={entity.entity_id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[#D49A42]/35 bg-[#D49A42]/10 px-4 py-2.5"
                        >
                          <span className="truncate text-sm font-medium">
                            {entity.attributes.friendly_name ??
                              entity.entity_id}
                          </span>
                          <span className="tabular-nums shrink-0 rounded-full bg-[#D49A42] px-2.5 py-0.5 text-xs font-semibold text-white">
                            {Math.round(level)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {unavailableDevices.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        <WifiOff className="h-3.5 w-3.5 text-[#C86D51]" />
                        <span>
                          Otillgängliga enheter ({unavailableDevices.length})
                        </span>
                      </p>
                      {unavailableDevices.map(({ roomName, device }) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[#C86D51]/35 bg-[#C86D51]/10 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {device.display_name}
                            </p>
                            <p className="truncate text-xs text-[var(--text-secondary)]">
                              {roomName}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#C86D51] px-2.5 py-0.5 text-xs font-semibold text-white">
                            Ej nåbar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openModal === "discovered" && (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Aktiva styrbara enheter i Home Assistant som ännu inte är
                    kopplade till något rum i Almvägen Hub.
                  </p>
                  <div className="space-y-2">
                    {discoveredEntities.slice(0, 20).map((ent) => (
                      <div
                        key={ent.entity_id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {ent.attributes.friendly_name ?? ent.entity_id}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {ent.entity_id}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                          {ent.state}
                        </span>
                      </div>
                    ))}
                    {discoveredEntities.length > 20 && (
                      <p className="text-center text-xs text-[var(--text-secondary)]">
                        + {discoveredEntities.length - 20} till i Admin
                      </p>
                    )}
                  </div>
                  {onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenModal(null);
                        onOpenAdmin();
                      }}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Öppna Admin för att lägga till</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
