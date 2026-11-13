import type { HAEntityState } from "@/lib/ha/types";
import type { RoomDevice } from "@/lib/supabase/types";

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

export function getRoomTemperatureDisplay(
  devices: RoomDevice[],
  isConnected: boolean,
  getEntity: (id: string) => HAEntityState | undefined,
): string | null {
  if (!isConnected) return null;
  const tempDevice = devices.find((d) => {
    if (d.widget_type !== "climate" && d.widget_type !== "sensor") return false;
    const entity = getEntity(d.ha_entity_id);
    const unit = entity?.attributes.unit_of_measurement ?? "";
    const devClass = entity?.attributes.device_class ?? "";
    return (
      devClass === "temperature" ||
      unit.includes("°C") ||
      d.ha_entity_id.includes("temp") ||
      d.display_name.toLowerCase().includes("temp")
    );
  });
  if (!tempDevice) return null;
  const entity = getEntity(tempDevice.ha_entity_id);
  if (
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown"
  ) {
    return null;
  }
  return `${entity.state} ${entity.attributes.unit_of_measurement ?? "°C"}`;
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
