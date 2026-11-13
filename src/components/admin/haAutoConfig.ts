import type { CustomIconId } from "@/components/icons/CustomIcons";
import type { HAEntityState } from "@/lib/ha/types";
import type { WidgetCategory, WidgetType } from "@/lib/supabase/types";

export interface InferredHAConfig {
  displayName: string;
  widgetType: WidgetType;
  widgetCategory: WidgetCategory;
  icon: CustomIconId;
  unit: string;
}

function cleanFriendlyName(rawName: string, roomName?: string): string {
  const trimmed = rawName.trim();
  if (!roomName) return trimmed;
  const escapedRoom = roomName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escapedRoom) return trimmed;
  const regex = new RegExp(`^${escapedRoom}[\\s\\-:]+`, "i");
  const stripped = trimmed.replace(regex, "").trim();
  return stripped || trimmed;
}

function fallbackNameFromEntityId(entityId: string): string {
  const objectId = entityId.includes(".")
    ? entityId.split(".").slice(1).join(".")
    : entityId;
  const readable = objectId.replace(/_/g, " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : entityId;
}

/**
 * Infers display name, widget type, widget category, icon, and unit from
 * a Home Assistant entity_id and its state attributes.
 */
export function inferHAConfig(
  entityId: string,
  entity?: HAEntityState,
  roomName?: string,
): InferredHAConfig {
  const domain = entityId.split(".")[0]?.toLowerCase() ?? "";
  const rawName = entity?.attributes.friendly_name || fallbackNameFromEntityId(entityId);
  const displayName = cleanFriendlyName(rawName, roomName);
  const unit = entity?.attributes.unit_of_measurement ?? "";
  const deviceClass = (entity?.attributes.device_class ?? "").toLowerCase();
  const colorModes = entity?.attributes.supported_color_modes;

  let widgetType: WidgetType = "sensor";
  let widgetCategory: WidgetCategory = "energy";
  let icon: CustomIconId = "sys_tibber_pulse";

  if (domain === "light") {
    const supportsBrightness =
      typeof entity?.attributes.brightness === "number" ||
      (Array.isArray(colorModes) &&
        colorModes.some((m) =>
          ["brightness", "color_temp", "hs", "rgb", "rgbw", "xy"].includes(m),
        ));
    widgetType = supportsBrightness ? "dimmer" : "light";
    widgetCategory = "scene";
    icon = supportsBrightness ? "light_dimmer" : "light_hue";
  } else if (domain === "switch") {
    widgetType = "switch";
    widgetCategory = "scene";
    icon = "light_vitvaror";
  } else if (domain === "climate") {
    widgetType = "climate";
    widgetCategory = "climate";
    icon = "ctrl_netatmo";
  } else if (domain === "camera") {
    widgetType = "camera";
    widgetCategory = "security";
    icon = "ctrl_kamera";
  } else if (
    domain === "binary_sensor" ||
    domain === "lock" ||
    domain === "alarm_control_panel"
  ) {
    widgetType = "sensor";
    widgetCategory = "security";
    icon = "ctrl_rorelse";
  } else if (domain === "scene" || domain === "script") {
    widgetType = "switch";
    widgetCategory = "scene";
    icon = "light_led";
  } else if (domain === "sensor") {
    const isPowerOrEnergy =
      deviceClass === "power" ||
      deviceClass === "energy" ||
      ["W", "kW", "kWh", "Wh"].includes(unit);

    if (isPowerOrEnergy) {
      widgetType = "energy";
      widgetCategory = "energy";
      icon = "sys_tibber_pulse";
    } else if (deviceClass === "temperature" || unit.includes("°C")) {
      widgetType = "sensor";
      widgetCategory = "climate";
      icon = "ctrl_temp";
    } else if (deviceClass === "humidity" || unit === "%") {
      widgetType = "sensor";
      widgetCategory = "climate";
      icon = "ctrl_fukt";
    } else {
      widgetType = "sensor";
      widgetCategory = "energy";
      icon = "ctrl_temp";
    }
  }

  return {
    displayName,
    widgetType,
    widgetCategory,
    icon,
    unit,
  };
}
