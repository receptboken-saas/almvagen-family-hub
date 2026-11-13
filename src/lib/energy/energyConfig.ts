import type { HassEntities, HassEntity } from "@/lib/ha/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DashboardWidget, RoomDevice } from "@/lib/supabase/types";

export type EnergyCategory =
  | "lighting"
  | "heating"
  | "appliances"
  | "ev_charging"
  | "other";

export type EnergyPeriod = "now" | "today" | "7d" | "30d";

export interface EnergyCategoryMeta {
  id: EnergyCategory;
  label: string;
  color: string;
  bgTint: string;
}

export const ENERGY_CATEGORY_META: Record<EnergyCategory, EnergyCategoryMeta> = {
  lighting: {
    id: "lighting",
    label: "Belysning",
    color: "#D49A42",
    bgTint: "bg-[#D49A42]/15 text-[#D49A42]",
  },
  heating: {
    id: "heating",
    label: "Uppvärmning & Klimat",
    color: "#C86D51",
    bgTint: "bg-[#C86D51]/15 text-[#C86D51]",
  },
  appliances: {
    id: "appliances",
    label: "Vitvaror & Tvätt",
    color: "#6B8E6B",
    bgTint: "bg-[#6B8E6B]/15 text-[#6B8E6B]",
  },
  ev_charging: {
    id: "ev_charging",
    label: "Elbilsladdning",
    color: "#6B8E6B",
    bgTint: "bg-[#6B8E6B]/15 text-[#6B8E6B]",
  },
  other: {
    id: "other",
    label: "Övrig drift & Baslast",
    color: "#6E635B",
    bgTint: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  },
};

export const ENERGY_CATEGORIES_ORDER: EnergyCategory[] = [
  "heating",
  "ev_charging",
  "appliances",
  "lighting",
  "other",
];

export interface DeviceEnergyOverride {
  energyCategory?: EnergyCategory;
  powerEntityId?: string | null;
  energyEntityId?: string | null;
  ratedWatts?: number | null;
}

export interface TrackedHAEnergyDevice {
  haDeviceId: string;
  name: string;
  category: EnergyCategory;
  powerEntityId: string | null;
  energyEntityId: string | null;
  statusEntityId: string | null;
  areaName: string | null;
}

export interface EnergyHouseholdConfig {
  mainPowerEntityId: string | null;
  mainEnergyEntityId: string | null;
  priceEntityId: string | null;
  gridOperator: string | null;
  municipality: string | null;
  gridTariffSummary: string | null;
  gridFeePerKwh: number;
  mainFuseAmps: number;
  deviceOverrides: Record<string, DeviceEnergyOverride>;
  trackedDevices: TrackedHAEnergyDevice[];
}

export interface EnergyAiAnalysisCache {
  summary: string;
  tips: string[];
  estimatedMonthlySavingKr: string | null;
  generatedAt: string;
  period: EnergyPeriod;
}

export const DEFAULT_ENERGY_CONFIG: EnergyHouseholdConfig = {
  mainPowerEntityId: null,
  mainEnergyEntityId: null,
  priceEntityId: null,
  gridOperator: null,
  municipality: null,
  gridTariffSummary: null,
  gridFeePerKwh: 1.1,
  mainFuseAmps: 20,
  deviceOverrides: {},
  trackedDevices: [],
};

const LOCAL_CFG_PREFIX = "almvagen_energy_cfg_";
const LOCAL_AI_PREFIX = "almvagen_energy_ai_";

export function getLocalEnergyConfig(
  propertyId: string,
): EnergyHouseholdConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_CFG_PREFIX}${propertyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EnergyHouseholdConfig>;
    return {
      ...DEFAULT_ENERGY_CONFIG,
      ...parsed,
      deviceOverrides: parsed.deviceOverrides ?? {},
      trackedDevices: parsed.trackedDevices ?? [],
    };
  } catch {
    return null;
  }
}

function setLocalEnergyConfig(
  propertyId: string,
  config: EnergyHouseholdConfig,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_CFG_PREFIX}${propertyId}`,
      JSON.stringify(config),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchEnergyConfig(
  propertyId: string,
): Promise<EnergyHouseholdConfig> {
  const local = getLocalEnergyConfig(propertyId);
  const supabase = getSupabaseClient();
  if (!supabase) return local ?? DEFAULT_ENERGY_CONFIG;

  const prefix = `[ENERGY_CFG:${propertyId}]`;
  const { data, error } = await supabase
    .from("family_notes")
    .select("content")
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const rawJson = (data[0].content as string).slice(prefix.length).trim();
    try {
      const parsed = JSON.parse(rawJson) as Partial<EnergyHouseholdConfig>;
      const merged: EnergyHouseholdConfig = {
        ...DEFAULT_ENERGY_CONFIG,
        ...parsed,
        deviceOverrides: parsed.deviceOverrides ?? {},
        trackedDevices: parsed.trackedDevices ?? [],
      };
      setLocalEnergyConfig(propertyId, merged);
      return merged;
    } catch {
      // Fallback to local
    }
  }
  return local ?? DEFAULT_ENERGY_CONFIG;
}

export async function saveEnergyConfig(
  propertyId: string,
  config: EnergyHouseholdConfig,
): Promise<void> {
  setLocalEnergyConfig(propertyId, config);
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const prefix = `[ENERGY_CFG:${propertyId}]`;
  await supabase
    .from("family_notes")
    .delete()
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`);

  await supabase.from("family_notes").insert({
    property_id: propertyId,
    author_id: null,
    author_name: "System",
    content: `${prefix} ${JSON.stringify(config)}`,
    is_pinned: false,
    is_done: false,
  });
}

export async function fetchEnergyAiCache(
  propertyId: string,
): Promise<EnergyAiAnalysisCache | null> {
  let local: EnergyAiAnalysisCache | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(`${LOCAL_AI_PREFIX}${propertyId}`);
      if (raw) local = JSON.parse(raw) as EnergyAiAnalysisCache;
    } catch {
      // Ignore
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return local;

  const prefix = `[ENERGY_AI:${propertyId}]`;
  const { data, error } = await supabase
    .from("family_notes")
    .select("content")
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const rawJson = (data[0].content as string).slice(prefix.length).trim();
    try {
      const parsed = JSON.parse(rawJson) as EnergyAiAnalysisCache;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `${LOCAL_AI_PREFIX}${propertyId}`,
          JSON.stringify(parsed),
        );
      }
      return parsed;
    } catch {
      // Ignore
    }
  }
  return local;
}

export async function saveEnergyAiCache(
  propertyId: string,
  cache: EnergyAiAnalysisCache,
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        `${LOCAL_AI_PREFIX}${propertyId}`,
        JSON.stringify(cache),
      );
    } catch {
      // Ignore
    }
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const prefix = `[ENERGY_AI:${propertyId}]`;
  await supabase
    .from("family_notes")
    .delete()
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`);

  await supabase.from("family_notes").insert({
    property_id: propertyId,
    author_id: null,
    author_name: "System",
    content: `${prefix} ${JSON.stringify(cache)}`,
    is_pinned: false,
    is_done: false,
  });
}

/**
 * Infers default energy category for a device based on its widget_type and name.
 * Zero hardcoding of entity_ids — relies purely on Supabase metadata and entity attributes.
 */
export function inferDeviceCategory(
  device: Pick<RoomDevice, "widget_type" | "display_name" | "ha_entity_id">,
  override?: DeviceEnergyOverride,
): EnergyCategory {
  if (override?.energyCategory) return override.energyCategory;

  if (device.widget_type === "light" || device.widget_type === "dimmer") {
    return "lighting";
  }
  if (device.widget_type === "climate") {
    return "heating";
  }

  const text = `${device.display_name} ${device.ha_entity_id}`.toLowerCase();
  if (
    text.includes("elbil") ||
    text.includes("laddbox") ||
    text.includes("laddare") ||
    text.includes("zaptec") ||
    text.includes("easee") ||
    text.includes("wallbox") ||
    /\bev\b/.test(text) ||
    /\bcharger\b/.test(text)
  ) {
    return "ev_charging";
  }
  if (
    text.includes("tvätt") ||
    text.includes("tork") ||
    text.includes("disk") ||
    text.includes("ugn") ||
    text.includes("spis") ||
    text.includes("kyl") ||
    text.includes("frys")
  ) {
    return "appliances";
  }
  if (
    text.includes("värme") ||
    text.includes("nibe") ||
    text.includes("panna") ||
    text.includes("element") ||
    text.includes("golvvärme") ||
    text.includes("termostat")
  ) {
    return "heating";
  }
  if (text.includes("lampa") || text.includes("belys") || text.includes("spot")) {
    return "lighting";
  }
  return "other";
}

function isPowerUnit(unit?: string | null): boolean {
  const u = (unit ?? "").trim().toLowerCase();
  return u === "w" || u === "kw";
}

function isEnergyUnit(unit?: string | null): boolean {
  const u = (unit ?? "").trim().toLowerCase();
  return u === "kwh" || u === "wh";
}

function isPriceUnit(unit?: string | null): boolean {
  const u = (unit ?? "").trim().toLowerCase();
  return u.includes("kr") || u.includes("sek") || u.includes("öre");
}

/**
 * Resolves effective main meter and price entity IDs using explicit config first,
 * falling back to configured dashboard_widgets, then matching HA sensor attributes.
 */
export function resolveMainEnergyEntities(
  config: EnergyHouseholdConfig,
  widgets: DashboardWidget[],
  entities: HassEntities,
): {
  mainPowerEntityId: string | null;
  mainEnergyEntityId: string | null;
  priceEntityId: string | null;
} {
  const energyWidgets = widgets.filter((w) => w.widget_category === "energy");

  let mainPowerEntityId = config.mainPowerEntityId;
  if (!mainPowerEntityId) {
    const widgetMatch = energyWidgets.find((w) => {
      const ent = entities[w.ha_entity_id];
      const unit = w.unit ?? ent?.attributes.unit_of_measurement;
      return isPowerUnit(unit) || ent?.attributes.device_class === "power";
    });
    mainPowerEntityId = widgetMatch?.ha_entity_id ?? null;
  }

  let mainEnergyEntityId = config.mainEnergyEntityId;
  if (!mainEnergyEntityId) {
    const widgetMatch = energyWidgets.find((w) => {
      const ent = entities[w.ha_entity_id];
      const unit = w.unit ?? ent?.attributes.unit_of_measurement;
      return isEnergyUnit(unit) || ent?.attributes.device_class === "energy";
    });
    if (widgetMatch) {
      mainEnergyEntityId = widgetMatch.ha_entity_id;
    } else {
      // Fallback: look for accumulated consumption / energy sensor in HA entities
      const allSensors = Object.values(entities);
      const candidate = allSensors.find((ent: HassEntity) => {
        const dc = (ent.attributes.device_class ?? "").toLowerCase();
        const u = ent.attributes.unit_of_measurement;
        const name = (ent.attributes.friendly_name ?? ent.entity_id).toLowerCase();
        return (
          (dc === "energy" || isEnergyUnit(u)) &&
          (name.includes("ackumulerad") ||
            name.includes("pulse") ||
            name.includes("total") ||
            name.includes("elnät"))
        );
      });
      mainEnergyEntityId = candidate?.entity_id ?? null;
    }
  }

  let priceEntityId = config.priceEntityId;
  if (!priceEntityId) {
    const widgetMatch = energyWidgets.find((w) => {
      const ent = entities[w.ha_entity_id];
      const unit = w.unit ?? ent?.attributes.unit_of_measurement;
      return isPriceUnit(unit);
    });
    if (widgetMatch) {
      priceEntityId = widgetMatch.ha_entity_id;
    } else {
      const candidate = Object.values(entities).find((ent: HassEntity) => {
        const u = ent.attributes.unit_of_measurement;
        const name = (ent.attributes.friendly_name ?? ent.entity_id).toLowerCase();
        return (
          isPriceUnit(u) &&
          (name.includes("pris") || name.includes("price") || name.includes("tibber"))
        );
      });
      priceEntityId = candidate?.entity_id ?? null;
    }
  }

  return { mainPowerEntityId, mainEnergyEntityId, priceEntityId };
}
