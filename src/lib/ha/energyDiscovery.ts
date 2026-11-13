import type { EnergyCategory } from "@/lib/energy/energyConfig";
import type { HassEntities, HassEntity } from "./types";

interface HADeviceRegistryEntry {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  area_id?: string | null;
}

interface HAEntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string | null;
  name?: string | null;
  original_name?: string | null;
  disabled_by?: string | null;
}

interface HAAreaRegistryEntry {
  area_id: string;
  name: string;
}

export interface DiscoveredHADevice {
  haDeviceId: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  areaName: string | null;
  suggestedCategory: EnergyCategory;
  powerEntityId: string | null;
  energyEntityId: string | null;
  statusEntityId: string | null;
  isMainMeterCandidate: boolean;
}

export interface HADiscoveryResult {
  mainPowerEntityId: string | null;
  mainEnergyEntityId: string | null;
  priceEntityId: string | null;
  devices: DiscoveredHADevice[];
}

function isPowerEntity(ent: HassEntity): boolean {
  const dc = (ent.attributes.device_class ?? "").toLowerCase();
  const unit = (ent.attributes.unit_of_measurement ?? "").trim().toLowerCase();
  return dc === "power" || unit === "w" || unit === "kw";
}

function isEnergyEntity(ent: HassEntity): boolean {
  const dc = (ent.attributes.device_class ?? "").toLowerCase();
  const unit = (ent.attributes.unit_of_measurement ?? "").trim().toLowerCase();
  return dc === "energy" || unit === "kwh" || unit === "wh";
}

function isPriceEntity(ent: HassEntity): boolean {
  const unit = (ent.attributes.unit_of_measurement ?? "").trim().toLowerCase();
  const text = `${ent.entity_id} ${ent.attributes.friendly_name ?? ""}`.toLowerCase();
  return (
    (unit.includes("kr") || unit.includes("sek") || unit.includes("öre")) &&
    (text.includes("pris") ||
      text.includes("price") ||
      text.includes("tibber") ||
      text.includes("nordpool") ||
      text.includes("elpris"))
  );
}

function inferCategoryFromText(text: string): EnergyCategory {
  const t = text.toLowerCase();
  if (
    t.includes("zaptec") ||
    t.includes("easee") ||
    t.includes("wallbox") ||
    t.includes("elbil") ||
    t.includes("laddbox") ||
    t.includes("laddare") ||
    /\bev\b/.test(t) ||
    /\bcharger\b/.test(t)
  ) {
    return "ev_charging";
  }
  if (
    t.includes("tvätt") ||
    t.includes("tork") ||
    t.includes("washer") ||
    t.includes("dryer") ||
    t.includes("disk") ||
    t.includes("dishwasher") ||
    t.includes("ugn") ||
    t.includes("spis") ||
    t.includes("kyl") ||
    t.includes("frys")
  ) {
    return "appliances";
  }
  if (
    t.includes("nibe") ||
    t.includes("värme") ||
    t.includes("heat") ||
    t.includes("panna") ||
    t.includes("klimat") ||
    t.includes("termostat") ||
    t.includes("golvvärme") ||
    t.includes("element") ||
    t.includes("mitsubishi") ||
    t.includes("daikin") ||
    t.includes("ctc")
  ) {
    return "heating";
  }
  if (
    t.includes("lampa") ||
    t.includes("belys") ||
    t.includes("light") ||
    t.includes("hue") ||
    t.includes("spot") ||
    t.includes("dimmer")
  ) {
    return "lighting";
  }
  return "other";
}

function isMainMeterText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("tibber pulse") ||
    t.includes("pulse") ||
    t.includes("huvudmätare") ||
    t.includes("elnät") ||
    t.includes("grid") ||
    t.includes("han-port") ||
    t.includes("han port") ||
    t.includes("p1 meter")
  );
}

function pickBestStatusEntity(
  groupEntities: HassEntity[],
  category: EnergyCategory,
): string | null {
  const candidates = groupEntities.filter((e) => {
    const domain = e.entity_id.split(".")[0];
    if (isPowerEntity(e) || isEnergyEntity(e) || isPriceEntity(e)) return false;
    return (
      domain === "climate" ||
      domain === "sensor" ||
      domain === "binary_sensor"
    );
  });

  if (category === "heating") {
    const climate = candidates.find((e) => e.entity_id.startsWith("climate."));
    if (climate) return climate.entity_id;
  }

  const keywordMatch = candidates.find((e) => {
    const t = `${e.entity_id} ${e.attributes.friendly_name ?? ""}`.toLowerCase();
    return (
      t.includes("status") ||
      t.includes("state") ||
      t.includes("mode") ||
      t.includes("läget") ||
      t.includes("drift") ||
      t.includes("charging") ||
      t.includes("laddar") ||
      t.includes("program") ||
      t.includes("operation") ||
      t.includes("remaining") ||
      t.includes("återstående")
    );
  });

  return keywordMatch?.entity_id ?? null;
}

/**
 * Scans Home Assistant's device, entity, and area registries via WebSocket
 * to automatically group power, energy, price, and status sensors into devices.
 */
export async function scanHomeAssistantEnergyDevices(
  sendCommand: <T = unknown>(
    type: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>,
  entities: HassEntities,
): Promise<HADiscoveryResult> {
  const [devicesRaw, entityRegRaw, areaRegRaw] = await Promise.all([
    sendCommand<HADeviceRegistryEntry[]>("config/device_registry/list").catch(
      () => [] as HADeviceRegistryEntry[],
    ),
    sendCommand<HAEntityRegistryEntry[]>("config/entity_registry/list").catch(
      () => [] as HAEntityRegistryEntry[],
    ),
    sendCommand<HAAreaRegistryEntry[]>("config/area_registry/list").catch(
      () => [] as HAAreaRegistryEntry[],
    ),
  ]);

  const deviceMap = new Map(devicesRaw.map((d) => [d.id, d]));
  const areaMap = new Map(areaRegRaw.map((a) => [a.area_id, a.name]));

  // Group live entities by HA device_id
  const entitiesByDevice = new Map<string, HassEntity[]>();
  const entityToArea = new Map<string, string>();

  for (const reg of entityRegRaw) {
    if (reg.disabled_by) continue;
    const live = entities[reg.entity_id];
    if (!live) continue;

    if (reg.area_id && areaMap.has(reg.area_id)) {
      entityToArea.set(reg.entity_id, areaMap.get(reg.area_id)!);
    }

    const groupKey = reg.device_id || `standalone:${reg.entity_id}`;
    const list = entitiesByDevice.get(groupKey) ?? [];
    list.push(live);
    entitiesByDevice.set(groupKey, list);
  }

  // Fallback if entity_registry was empty
  if (entitiesByDevice.size === 0) {
    for (const live of Object.values(entities)) {
      entitiesByDevice.set(`standalone:${live.entity_id}`, [live]);
    }
  }

  let mainPowerEntityId: string | null = null;
  let mainEnergyEntityId: string | null = null;
  let priceEntityId: string | null = null;
  const discovered: DiscoveredHADevice[] = [];

  for (const [groupKey, groupEntities] of entitiesByDevice.entries()) {
    const powerEnts = groupEntities.filter(isPowerEntity);
    const energyEnts = groupEntities.filter(isEnergyEntity);
    const priceEnt = groupEntities.find(isPriceEntity);

    if (priceEnt && !priceEntityId) {
      priceEntityId = priceEnt.entity_id;
    }

    if (powerEnts.length === 0 && energyEnts.length === 0) {
      continue;
    }

    const haDevice = deviceMap.get(groupKey);
    const deviceName =
      haDevice?.name_by_user ||
      haDevice?.name ||
      powerEnts[0]?.attributes.friendly_name ||
      energyEnts[0]?.attributes.friendly_name ||
      groupKey;

    const areaId = haDevice?.area_id ?? null;
    const areaName =
      (areaId ? areaMap.get(areaId) : null) ??
      entityToArea.get(powerEnts[0]?.entity_id ?? energyEnts[0]?.entity_id ?? "") ??
      null;

    // Pick best power & energy sensor inside the same HA device
    const bestPower =
      powerEnts.find((e) => {
        const t = `${e.entity_id} ${e.attributes.friendly_name ?? ""}`.toLowerCase();
        return !t.includes("min") && !t.includes("max") && !t.includes("avg");
      }) ?? powerEnts[0];

    const bestEnergy =
      energyEnts.find((e) => {
        const t = `${e.entity_id} ${e.attributes.friendly_name ?? ""}`.toLowerCase();
        return (
          t.includes("ackumulerad") ||
          t.includes("total") ||
          t.includes("energy") ||
          t.includes("förbrukning") ||
          t.includes("consumption")
        );
      }) ?? energyEnts[0];

    const combinedText = `${deviceName} ${haDevice?.manufacturer ?? ""} ${haDevice?.model ?? ""} ${bestPower?.entity_id ?? ""} ${bestEnergy?.entity_id ?? ""}`;
    const isMain = isMainMeterText(combinedText);

    if (isMain) {
      if (bestPower && !mainPowerEntityId) mainPowerEntityId = bestPower.entity_id;
      if (bestEnergy && !mainEnergyEntityId) {
        mainEnergyEntityId = bestEnergy.entity_id;
      }
    }

    const suggestedCategory = inferCategoryFromText(combinedText);
    const statusEntityId = pickBestStatusEntity(
      groupEntities,
      suggestedCategory,
    );

    discovered.push({
      haDeviceId: groupKey,
      name: deviceName,
      manufacturer: haDevice?.manufacturer ?? null,
      model: haDevice?.model ?? null,
      areaName,
      suggestedCategory,
      powerEntityId: bestPower?.entity_id ?? null,
      energyEntityId: bestEnergy?.entity_id ?? null,
      statusEntityId,
      isMainMeterCandidate: isMain,
    });
  }

  // Fallback price scan across all entities if not part of a power device
  if (!priceEntityId) {
    const anyPrice = Object.values(entities).find(isPriceEntity);
    priceEntityId = anyPrice?.entity_id ?? null;
  }

  // Sort: non-main devices first, alphabetically
  discovered.sort((a, b) => {
    if (a.isMainMeterCandidate !== b.isMainMeterCandidate) {
      return a.isMainMeterCandidate ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "sv");
  });

  return {
    mainPowerEntityId,
    mainEnergyEntityId,
    priceEntityId,
    devices: discovered,
  };
}
