import type { HAEntityState } from "@/lib/ha/types";
import type { RoomDevice } from "@/lib/supabase/types";

export type RoomTabId = "lights" | "climate" | "security" | "other";

export function isLightType(type: RoomDevice["widget_type"]): boolean {
  return type === "light" || type === "dimmer";
}

export function isControllableType(type: RoomDevice["widget_type"]): boolean {
  return type === "light" || type === "dimmer" || type === "switch";
}

export function getServiceDomain(
  entityId: string,
  type: RoomDevice["widget_type"],
): string {
  const prefix = entityId.split(".")[0];
  if (prefix) return prefix;
  return type === "switch" ? "switch" : "light";
}

const SECURITY_DEVICE_CLASSES = new Set([
  "door",
  "window",
  "motion",
  "occupancy",
  "opening",
  "garage_door",
  "lock",
  "smoke",
  "moisture",
  "vibration",
  "tamper",
]);

export function isSecurityDevice(
  device: RoomDevice,
  entity?: HAEntityState,
): boolean {
  if (device.widget_type === "camera") return true;
  const domain = device.ha_entity_id.split(".")[0];
  if (
    domain === "binary_sensor" ||
    domain === "lock" ||
    domain === "alarm_control_panel"
  ) {
    return true;
  }
  const devClass = entity?.attributes.device_class;
  return typeof devClass === "string" && SECURITY_DEVICE_CLASSES.has(devClass);
}

export function isTemperatureDevice(
  device: RoomDevice,
  entity?: HAEntityState,
): boolean {
  if (device.widget_type === "climate") return true;
  if (device.widget_type !== "sensor") return false;
  const unit = entity?.attributes.unit_of_measurement ?? "";
  const devClass = entity?.attributes.device_class ?? "";
  return (
    devClass === "temperature" ||
    unit.includes("°C") ||
    device.ha_entity_id.includes("temp") ||
    device.display_name.toLowerCase().includes("temp")
  );
}

export function isClimateTabDevice(
  device: RoomDevice,
  entity?: HAEntityState,
): boolean {
  if (device.widget_type === "climate") return true;
  if (isSecurityDevice(device, entity)) return false;
  if (device.widget_type === "sensor") {
    const devClass = entity?.attributes.device_class ?? "";
    const unit = entity?.attributes.unit_of_measurement ?? "";
    return (
      devClass === "temperature" ||
      devClass === "humidity" ||
      unit.includes("°C") ||
      unit === "%" ||
      device.ha_entity_id.includes("temp") ||
      device.ha_entity_id.includes("humid") ||
      device.ha_entity_id.includes("fukt") ||
      device.display_name.toLowerCase().includes("temp") ||
      device.display_name.toLowerCase().includes("fukt")
    );
  }
  return false;
}

export function groupRoomDevicesByTab(
  devices: RoomDevice[],
  getEntity: (id: string) => HAEntityState | undefined,
): Record<RoomTabId, RoomDevice[]> {
  const lights: RoomDevice[] = [];
  const climate: RoomDevice[] = [];
  const security: RoomDevice[] = [];
  const other: RoomDevice[] = [];

  for (const device of devices) {
    const entity = getEntity(device.ha_entity_id);
    if (isControllableType(device.widget_type)) {
      lights.push(device);
    } else if (isClimateTabDevice(device, entity)) {
      climate.push(device);
    } else if (isSecurityDevice(device, entity)) {
      security.push(device);
    } else {
      other.push(device);
    }
  }

  return { lights, climate, security, other };
}

export function getRoomNumericTemperature(
  devices: RoomDevice[],
  isConnected: boolean,
  getEntity: (id: string) => HAEntityState | undefined,
): number | null {
  if (!isConnected) return null;
  for (const d of devices) {
    if (!isTemperatureDevice(d, getEntity(d.ha_entity_id))) continue;
    const entity = getEntity(d.ha_entity_id);
    if (!entity) continue;

    if (d.widget_type === "climate") {
      const currentTemp = entity.attributes.current_temperature;
      if (typeof currentTemp === "number" && !Number.isNaN(currentTemp)) {
        return currentTemp;
      }
    }

    if (entity.state !== "unavailable" && entity.state !== "unknown") {
      const parsed = Number.parseFloat(entity.state);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

export function getRoomTemperatureDisplay(
  devices: RoomDevice[],
  isConnected: boolean,
  getEntity: (id: string) => HAEntityState | undefined,
): string | null {
  const num = getRoomNumericTemperature(devices, isConnected, getEntity);
  if (num === null) return null;
  return `${num.toFixed(1)}°`;
}

export interface RoomCapabilities {
  temperatureDisplay: string | null;
  isHeating: boolean;
  activeLightsCount: number;
  totalLightsCount: number;
  activeControllableCount: number;
  totalControllableCount: number;
  hasOpenSecurity: boolean;
  hasActiveMedia: boolean;
}

export function getRoomCapabilities(
  devices: RoomDevice[],
  isConnected: boolean,
  getEntity: (id: string) => HAEntityState | undefined,
): RoomCapabilities {
  const lightDevices = devices.filter((d) => isLightType(d.widget_type));
  const controllableDevices = devices.filter((d) =>
    isControllableType(d.widget_type),
  );

  const activeLightsCount = isConnected
    ? lightDevices.filter((d) => getEntity(d.ha_entity_id)?.state === "on")
        .length
    : 0;
  const activeControllableCount = isConnected
    ? controllableDevices.filter(
        (d) => getEntity(d.ha_entity_id)?.state === "on",
      ).length
    : 0;

  let isHeating = false;
  let hasOpenSecurity = false;
  let hasActiveMedia = false;

  if (isConnected) {
    for (const d of devices) {
      const entity = getEntity(d.ha_entity_id);
      if (!entity) continue;

      if (d.widget_type === "climate") {
        const action = entity.attributes.hvac_action;
        if (action === "heating") {
          isHeating = true;
        }
      }

      if (isSecurityDevice(d, entity)) {
        if (
          entity.state === "on" ||
          entity.state === "open" ||
          entity.state === "unlocked"
        ) {
          hasOpenSecurity = true;
        }
      }

      if (
        d.ha_entity_id.startsWith("media_player.") &&
        entity.state === "playing"
      ) {
        hasActiveMedia = true;
      }
    }
  }

  return {
    temperatureDisplay: getRoomTemperatureDisplay(
      devices,
      isConnected,
      getEntity,
    ),
    isHeating,
    activeLightsCount,
    totalLightsCount: lightDevices.length,
    activeControllableCount,
    totalControllableCount: controllableDevices.length,
    hasOpenSecurity,
    hasActiveMedia,
  };
}

export async function bulkToggleRoomDevices(
  devices: RoomDevice[],
  turnOn: boolean,
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<void> {
  const lightIds = devices
    .filter((d) => isLightType(d.widget_type))
    .map((d) => d.ha_entity_id);
  const switchIds = devices
    .filter((d) => d.widget_type === "switch")
    .map((d) => d.ha_entity_id);

  const service = turnOn ? "turn_on" : "turn_off";
  const calls: Promise<unknown>[] = [];

  if (lightIds.length > 0) {
    calls.push(callService("light", service, { entity_id: lightIds }));
  }
  if (switchIds.length > 0) {
    calls.push(callService("switch", service, { entity_id: switchIds }));
  }

  await Promise.all(calls);
}
