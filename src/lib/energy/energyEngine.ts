import {
  computeHourlyWeightedCost,
  estimateBaseloadWatts,
  extractTopPeaks,
  findCheapestPriceWindows,
  sumKwhFromStatistics,
  type HAStatisticsMap,
  type PowerPeak,
  type PriceWindow,
} from "@/lib/ha/energyStats";
import type { HassEntities, HassEntity } from "@/lib/ha/types";
import type {
  DashboardWidget,
  Floor,
  Room,
  RoomDevice,
} from "@/lib/supabase/types";
import {
  ENERGY_CATEGORIES_ORDER,
  ENERGY_CATEGORY_META,
  inferDeviceCategory,
  resolveMainEnergyEntities,
  type EnergyCategory,
  type EnergyHouseholdConfig,
  type EnergyPeriod,
} from "./energyConfig";

export type MeasurementSource = "measured" | "estimated" | "none";

export interface DeviceEnergyReading {
  id: string;
  name: string;
  haEntityId: string;
  roomId: string | null;
  roomName: string;
  floorId: string | null;
  floorName: string;
  category: EnergyCategory;
  liveWatts: number;
  kwh: number;
  costKr: number;
  source: MeasurementSource;
  isOn: boolean;
  powerEntityId: string | null;
  energyEntityId: string | null;
  ratedWatts: number | null;
  statusText?: string | null;
}

export interface FloorSubBreakdown {
  floorId: string;
  floorName: string;
  liveWatts: number;
  kwh: number;
  costKr: number;
  deviceCount: number;
}

export interface CategoryEnergyBreakdown {
  category: EnergyCategory;
  label: string;
  color: string;
  bgTint: string;
  liveWatts: number;
  kwh: number;
  costKr: number;
  sharePct: number;
  deviceCount: number;
  floorBreakdown: FloorSubBreakdown[];
}

export interface RoomEnergyBreakdown {
  roomId: string;
  roomName: string;
  floorId: string;
  floorName: string;
  liveWatts: number;
  kwh: number;
  costKr: number;
  deviceCount: number;
}

export interface FloorEnergyBreakdown {
  floorId: string;
  floorName: string;
  liveWatts: number;
  kwh: number;
  costKr: number;
  rooms: RoomEnergyBreakdown[];
}

export interface EnergyDashboardSummary {
  period: EnergyPeriod;
  hasMainPower: boolean;
  hasMainEnergy: boolean;
  hasPrice: boolean;
  mainPowerEntityId: string | null;
  mainEnergyEntityId: string | null;
  priceEntityId: string | null;
  liveTotalWatts: number;
  fuseMaxWatts: number;
  fuseLoadPct: number;
  spotPriceKr: number | null;
  totalPricePerKwh: number;
  totalKwh: number;
  totalCostKr: number;
  measuredKwh: number;
  unmeasuredKwh: number;
  unmeasuredLiveWatts: number;
  categories: CategoryEnergyBreakdown[];
  floors: FloorEnergyBreakdown[];
  devices: DeviceEnergyReading[];
  topPeaks: PowerPeak[];
  baseloadWatts: number | null;
  cheapestWindows: PriceWindow[];
}

function parseEntityWatts(entity: HassEntity | undefined): number | null {
  if (!entity || entity.state === "unavailable" || entity.state === "unknown") {
    return null;
  }
  const num = Number.parseFloat(entity.state);
  if (!Number.isFinite(num)) return null;
  const unit = (entity.attributes.unit_of_measurement ?? "").trim().toLowerCase();
  if (unit === "kw") return Math.max(0, num * 1000);
  if (unit === "w") return Math.max(0, num);
  return null;
}

function parsePriceKr(entity: HassEntity | undefined): number | null {
  if (!entity || entity.state === "unavailable" || entity.state === "unknown") {
    return null;
  }
  const num = Number.parseFloat(entity.state);
  if (!Number.isFinite(num)) return null;
  const unit = (entity.attributes.unit_of_measurement ?? "").trim().toLowerCase();
  if (unit.includes("öre")) return num / 100;
  return num;
}

function getPeriodHours(period: EnergyPeriod): number {
  if (period === "now" || period === "today") {
    const now = new Date();
    return Math.max(0.25, now.getHours() + now.getMinutes() / 60);
  }
  if (period === "7d") return 7 * 24;
  return 30 * 24;
}

function isEntityActive(entity: HassEntity | undefined): boolean {
  if (!entity) return false;
  const s = entity.state.toLowerCase();
  return s === "on" || s === "heat" || s === "heating" || s === "cool" || s === "auto";
}

function estimateDeviceWatts(
  entity: HassEntity | undefined,
  ratedWatts: number | null | undefined,
): number {
  if (!ratedWatts || ratedWatts <= 0 || !entity) return 0;
  if (!isEntityActive(entity)) return 0;
  const brightness = entity.attributes.brightness;
  if (typeof brightness === "number" && Number.isFinite(brightness)) {
    // Scale rated watts smoothly with dimmer brightness (minimum 15% when on)
    const ratio = Math.max(0.15, Math.min(1, brightness / 255));
    return Math.round(ratedWatts * ratio);
  }
  return ratedWatts;
}

function formatStatusBadge(entity: HassEntity | undefined): string | null {
  if (!entity || entity.state === "unavailable" || entity.state === "unknown") {
    return null;
  }
  const s = entity.state.trim();
  const low = s.toLowerCase();
  if (low === "charging") return "Laddar";
  if (low === "connected") return "Inkopplad";
  if (low === "disconnected") return "Ej inkopplad";
  if (low === "heat" || low === "heating") return "Värmer";
  if (low === "idle") return "Viloläge";
  if (low === "running") return "Igång";
  if (low === "off" || low === "standby") return "Av / Standby";
  const unit = entity.attributes.unit_of_measurement;
  return unit ? `${s} ${unit}` : s;
}

export function computeEnergyDashboard(params: {
  period: EnergyPeriod;
  config: EnergyHouseholdConfig;
  floors: Floor[];
  rooms: Room[];
  roomDevices: RoomDevice[];
  dashboardWidgets: DashboardWidget[];
  entities: HassEntities;
  statistics: HAStatisticsMap;
}): EnergyDashboardSummary {
  const {
    period,
    config,
    floors,
    rooms,
    roomDevices,
    dashboardWidgets,
    entities,
    statistics,
  } = params;

  const { mainPowerEntityId, mainEnergyEntityId, priceEntityId } =
    resolveMainEnergyEntities(config, dashboardWidgets, entities);

  const mainPowerEntity = mainPowerEntityId
    ? entities[mainPowerEntityId]
    : undefined;
  const mainEnergyEntity = mainEnergyEntityId
    ? entities[mainEnergyEntityId]
    : undefined;
  const priceEntity = priceEntityId ? entities[priceEntityId] : undefined;

  const spotPriceKr = parsePriceKr(priceEntity);
  const effectivePricePerKwh = (spotPriceKr ?? 0) + (config.gridFeePerKwh ?? 0);

  const liveTotalWattsRaw = parseEntityWatts(mainPowerEntity) ?? 0;
  const fuseMaxWatts = Math.max(1000, (config.mainFuseAmps || 20) * 3 * 230);

  const mainEnergyUnit = mainEnergyEntity?.attributes.unit_of_measurement;
  const mainEnergyStats = mainEnergyEntityId
    ? statistics[mainEnergyEntityId]
    : undefined;
  const mainPowerStats = mainPowerEntityId
    ? statistics[mainPowerEntityId]
    : undefined;
  const priceStats = priceEntityId ? statistics[priceEntityId] : undefined;
  const priceUnit = priceEntity?.attributes.unit_of_measurement;

  let totalKwh = sumKwhFromStatistics(mainEnergyStats, mainEnergyUnit);
  if (totalKwh === 0 && period === "now" && liveTotalWattsRaw > 0) {
    totalKwh = (liveTotalWattsRaw / 1000) * getPeriodHours("today");
  }

  const floorMap = new Map(floors.map((f) => [f.id, f]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const periodHours = getPeriodHours(period);
  const deviceReadings: DeviceEnergyReading[] = [];

  for (const dev of roomDevices) {
    const room = roomMap.get(dev.room_id);
    const floor = room ? floorMap.get(room.floor_id) : undefined;
    const override = config.deviceOverrides[dev.id];
    const category = inferDeviceCategory(dev, override);

    const primaryEntity = entities[dev.ha_entity_id];
    const powerEntityId =
      override?.powerEntityId ??
      (parseEntityWatts(primaryEntity) !== null ? dev.ha_entity_id : null);
    const energyEntityId =
      override?.energyEntityId ??
      (primaryEntity?.attributes.device_class === "energy" ||
      ["kwh", "wh"].includes(
        (primaryEntity?.attributes.unit_of_measurement ?? "").toLowerCase(),
      )
        ? dev.ha_entity_id
        : null);

    const ratedWatts = override?.ratedWatts ?? null;

    // Skip passive sensors/cameras (temp, humidity, motion, etc.) that have no power/energy meter or ratedWatts
    const isPassiveNonEnergy =
      (dev.widget_type === "sensor" || dev.widget_type === "camera") &&
      !powerEntityId &&
      !energyEntityId &&
      !ratedWatts;
    if (isPassiveNonEnergy) continue;

    const powerEntity = powerEntityId ? entities[powerEntityId] : undefined;
    const energyEntity = energyEntityId ? entities[energyEntityId] : undefined;

    const measuredWatts = parseEntityWatts(powerEntity);
    let liveWatts = 0;
    let source: MeasurementSource = "none";

    if (measuredWatts !== null) {
      liveWatts = measuredWatts;
      source = "measured";
    } else if (ratedWatts && ratedWatts > 0) {
      liveWatts = estimateDeviceWatts(primaryEntity, ratedWatts);
      source = "estimated";
    }

    let kwh = 0;
    if (energyEntityId && statistics[energyEntityId]) {
      kwh = sumKwhFromStatistics(
        statistics[energyEntityId],
        energyEntity?.attributes.unit_of_measurement,
      );
      source = "measured";
    } else if (powerEntityId && statistics[powerEntityId]) {
      const pts = statistics[powerEntityId];
      const isKw =
        (powerEntity?.attributes.unit_of_measurement ?? "").toLowerCase() ===
        "kw";
      for (const pt of pts) {
        if (typeof pt.mean === "number" && pt.mean > 0) {
          kwh += isKw ? pt.mean : pt.mean / 1000;
        }
      }
      source = "measured";
    } else if (source === "estimated" && liveWatts > 0) {
      // Conservative estimate for active lights/devices without energy meter
      kwh = (liveWatts / 1000) * Math.min(periodHours, 6);
    }

    const costKr = kwh * effectivePricePerKwh;

    deviceReadings.push({
      id: dev.id,
      name: dev.display_name,
      haEntityId: dev.ha_entity_id,
      roomId: room?.id ?? null,
      roomName: room?.name ?? "Okänt rum",
      floorId: floor?.id ?? null,
      floorName: floor?.name ?? "Övrigt",
      category,
      liveWatts,
      kwh,
      costKr,
      source,
      isOn: isEntityActive(primaryEntity) || liveWatts > 2,
      powerEntityId,
      energyEntityId,
      ratedWatts,
    });
  }

  // Also include property-level energy dashboard widgets that aren't the main meter or price
  for (const widget of dashboardWidgets) {
    if (widget.widget_category !== "energy") continue;
    if (
      widget.ha_entity_id === mainPowerEntityId ||
      widget.ha_entity_id === mainEnergyEntityId ||
      widget.ha_entity_id === priceEntityId
    ) {
      continue;
    }
    const alreadyInRoom = deviceReadings.some(
      (d) =>
        d.haEntityId === widget.ha_entity_id ||
        d.powerEntityId === widget.ha_entity_id ||
        d.energyEntityId === widget.ha_entity_id,
    );
    if (alreadyInRoom) continue;

    const override = config.deviceOverrides[widget.id];
    const ent = entities[widget.ha_entity_id];
    const measuredW = parseEntityWatts(ent) ?? 0;
    const isEnergy =
      ent?.attributes.device_class === "energy" ||
      ["kwh", "wh"].includes(
        (widget.unit ?? ent?.attributes.unit_of_measurement ?? "").toLowerCase(),
      );
    const kwh =
      isEnergy && statistics[widget.ha_entity_id]
        ? sumKwhFromStatistics(
            statistics[widget.ha_entity_id],
            widget.unit ?? ent?.attributes.unit_of_measurement,
          )
        : 0;
    const category = inferDeviceCategory(
      {
        widget_type: "energy",
        display_name: widget.title,
        ha_entity_id: widget.ha_entity_id,
      },
      override,
    );

    deviceReadings.push({
      id: widget.id,
      name: widget.title,
      haEntityId: widget.ha_entity_id,
      roomId: null,
      roomName: "Hela huset",
      floorId: null,
      floorName: "Hela huset",
      category,
      liveWatts: measuredW,
      kwh,
      costKr: kwh * effectivePricePerKwh,
      source: measuredW > 0 || kwh > 0 ? "measured" : "none",
      isOn: measuredW > 2,
      powerEntityId: isEnergy ? null : widget.ha_entity_id,
      energyEntityId: isEnergy ? widget.ha_entity_id : null,
      ratedWatts: override?.ratedWatts ?? null,
    });
  }

  // Include 1-click scanned / tracked HA energy devices
  for (const td of config.trackedDevices ?? []) {
    if (
      (td.powerEntityId && td.powerEntityId === mainPowerEntityId) ||
      (td.energyEntityId && td.energyEntityId === mainEnergyEntityId)
    ) {
      continue;
    }

    const alreadyTracked = deviceReadings.some(
      (d) =>
        (td.powerEntityId &&
          (d.powerEntityId === td.powerEntityId ||
            d.haEntityId === td.powerEntityId)) ||
        (td.energyEntityId &&
          (d.energyEntityId === td.energyEntityId ||
            d.haEntityId === td.energyEntityId)),
    );
    if (alreadyTracked) continue;

    const powerEntity = td.powerEntityId ? entities[td.powerEntityId] : undefined;
    const energyEntity = td.energyEntityId
      ? entities[td.energyEntityId]
      : undefined;
    const statusEntity = td.statusEntityId
      ? entities[td.statusEntityId]
      : undefined;

    const liveWatts = parseEntityWatts(powerEntity) ?? 0;
    let kwh = 0;
    if (td.energyEntityId && statistics[td.energyEntityId]) {
      kwh = sumKwhFromStatistics(
        statistics[td.energyEntityId],
        energyEntity?.attributes.unit_of_measurement,
      );
    } else if (td.powerEntityId && statistics[td.powerEntityId]) {
      const pts = statistics[td.powerEntityId];
      const isKw =
        (powerEntity?.attributes.unit_of_measurement ?? "").toLowerCase() ===
        "kw";
      for (const pt of pts) {
        if (typeof pt.mean === "number" && pt.mean > 0) {
          kwh += isKw ? pt.mean : pt.mean / 1000;
        }
      }
    }

    // Match HA areaName to Supabase room/floor if possible
    const matchedRoom = td.areaName
      ? rooms.find(
          (r) => r.name.toLowerCase() === td.areaName!.trim().toLowerCase(),
        )
      : undefined;
    const matchedFloor = matchedRoom ? floorMap.get(matchedRoom.floor_id) : undefined;

    deviceReadings.push({
      id: `ha_${td.haDeviceId}`,
      name: td.name,
      haEntityId: td.powerEntityId ?? td.energyEntityId ?? td.haDeviceId,
      roomId: matchedRoom?.id ?? null,
      roomName: matchedRoom?.name ?? td.areaName ?? "Hela huset",
      floorId: matchedFloor?.id ?? null,
      floorName: matchedFloor?.name ?? "Övriga prylar",
      category: td.category,
      liveWatts,
      kwh,
      costKr: kwh * effectivePricePerKwh,
      source: liveWatts > 0 || kwh > 0 ? "measured" : "none",
      isOn: liveWatts > 2,
      powerEntityId: td.powerEntityId,
      energyEntityId: td.energyEntityId,
      ratedWatts: null,
      statusText: formatStatusBadge(statusEntity),
    });
  }

  const measuredLiveWatts = deviceReadings.reduce(
    (sum, d) => sum + d.liveWatts,
    0,
  );
  const measuredKwh = deviceReadings.reduce((sum, d) => sum + d.kwh, 0);

  const liveTotalWatts =
    liveTotalWattsRaw > 0 ? liveTotalWattsRaw : measuredLiveWatts;
  const effectiveTotalKwh = totalKwh > 0 ? totalKwh : measuredKwh;
  const unmeasuredKwh = Math.max(0, effectiveTotalKwh - measuredKwh);
  const unmeasuredLiveWatts = Math.max(0, liveTotalWatts - measuredLiveWatts);

  const weightedTotalCost = computeHourlyWeightedCost(
    mainEnergyStats,
    priceStats,
    effectivePricePerKwh,
    config.gridFeePerKwh ?? 0,
    mainEnergyUnit,
    priceUnit,
  );
  const totalCostKr =
    weightedTotalCost !== null
      ? weightedTotalCost
      : effectiveTotalKwh * effectivePricePerKwh;
  const effectiveAvgPricePerKwh =
    effectiveTotalKwh > 0 ? totalCostKr / effectiveTotalKwh : effectivePricePerKwh;

  // Build category breakdown (including per-floor sub-breakdown!)
  const categories: CategoryEnergyBreakdown[] = ENERGY_CATEGORIES_ORDER.map(
    (cat) => {
      const meta = ENERGY_CATEGORY_META[cat];
      const catDevices = deviceReadings.filter((d) => d.category === cat);

      let liveWatts = catDevices.reduce((s, d) => s + d.liveWatts, 0);
      let kwh = catDevices.reduce((s, d) => s + d.kwh, 0);

      if (cat === "other") {
        liveWatts += unmeasuredLiveWatts;
        kwh += unmeasuredKwh;
      }

      const costKr = kwh * effectiveAvgPricePerKwh;
      const sharePct =
        effectiveTotalKwh > 0
          ? Math.min(100, Math.round((kwh / effectiveTotalKwh) * 100))
          : liveTotalWatts > 0
            ? Math.min(100, Math.round((liveWatts / liveTotalWatts) * 100))
            : 0;

      const floorSubMap = new Map<string, FloorSubBreakdown>();
      for (const dev of catDevices) {
        const fKey = dev.floorId ?? "house";
        const fName = dev.floorName;
        const prev = floorSubMap.get(fKey) ?? {
          floorId: fKey,
          floorName: fName,
          liveWatts: 0,
          kwh: 0,
          costKr: 0,
          deviceCount: 0,
        };
        prev.liveWatts += dev.liveWatts;
        prev.kwh += dev.kwh;
        prev.costKr += dev.costKr;
        prev.deviceCount += 1;
        floorSubMap.set(fKey, prev);
      }

      return {
        category: cat,
        label: meta.label,
        color: meta.color,
        bgTint: meta.bgTint,
        liveWatts,
        kwh,
        costKr,
        sharePct,
        deviceCount: catDevices.length,
        floorBreakdown: Array.from(floorSubMap.values()).sort(
          (a, b) => b.kwh - a.kwh || b.liveWatts - a.liveWatts,
        ),
      };
    },
  );

  // Build floor -> room breakdown
  const floorBreakdowns: FloorEnergyBreakdown[] = floors.map((floor) => {
    const floorRooms = rooms.filter((r) => r.floor_id === floor.id);
    const roomBreakdowns: RoomEnergyBreakdown[] = floorRooms.map((room) => {
      const devs = deviceReadings.filter((d) => d.roomId === room.id);
      const liveWatts = devs.reduce((s, d) => s + d.liveWatts, 0);
      const kwh = devs.reduce((s, d) => s + d.kwh, 0);
      return {
        roomId: room.id,
        roomName: room.name,
        floorId: floor.id,
        floorName: floor.name,
        liveWatts,
        kwh,
        costKr: kwh * effectiveAvgPricePerKwh,
        deviceCount: devs.length,
      };
    });

    return {
      floorId: floor.id,
      floorName: floor.name,
      liveWatts: roomBreakdowns.reduce((s, r) => s + r.liveWatts, 0),
      kwh: roomBreakdowns.reduce((s, r) => s + r.kwh, 0),
      costKr: roomBreakdowns.reduce((s, r) => s + r.costKr, 0),
      rooms: roomBreakdowns,
    };
  });

  const topPeaks = extractTopPeaks(
    mainEnergyStats,
    mainPowerStats,
    mainPowerEntity?.attributes.unit_of_measurement,
    3,
  );

  const baseloadWatts = estimateBaseloadWatts(
    mainEnergyStats,
    mainPowerStats,
    mainPowerEntity?.attributes.unit_of_measurement,
  );

  const cheapestWindows = findCheapestPriceWindows(
    priceEntity,
    config.gridFeePerKwh ?? 0,
  );

  return {
    period,
    hasMainPower: Boolean(mainPowerEntityId),
    hasMainEnergy: Boolean(mainEnergyEntityId),
    hasPrice: Boolean(priceEntityId),
    mainPowerEntityId,
    mainEnergyEntityId,
    priceEntityId,
    liveTotalWatts,
    fuseMaxWatts,
    fuseLoadPct: Math.min(100, Math.round((liveTotalWatts / fuseMaxWatts) * 100)),
    spotPriceKr,
    totalPricePerKwh: effectivePricePerKwh,
    totalKwh: effectiveTotalKwh,
    totalCostKr,
    measuredKwh,
    unmeasuredKwh,
    unmeasuredLiveWatts,
    categories,
    floors: floorBreakdowns,
    devices: deviceReadings.sort(
      (a, b) => b.kwh - a.kwh || b.liveWatts - a.liveWatts,
    ),
    topPeaks,
    baseloadWatts,
    cheapestWindows,
  };
}
