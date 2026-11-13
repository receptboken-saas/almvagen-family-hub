import { getSupabaseClient } from "./client";
import type { FamilyNote } from "./types";

export type HubViewId = "home" | "family" | "energy";

export const HUB_VIEW_OPTIONS: { id: HubViewId; label: string }[] = [
  { id: "home", label: "Hem & Styrning" },
  { id: "family", label: "Familjen & Veckan" },
  { id: "energy", label: "Energi & Drift" },
];

export const SYSTEM_NOTE_PREFIXES = [
  "[HUB_PREF:",
  "[DINNER:",
  "[WASTE:",
  "[CALENDAR:",
  "[ENERGY_CFG:",
  "[ENERGY_AI:",
] as const;

export function isSystemFamilyNote(content: string): boolean {
  return SYSTEM_NOTE_PREFIXES.some((prefix) => content.startsWith(prefix));
}

export function isValidHubView(value: string | null | undefined): value is HubViewId {
  return value === "home" || value === "family" || value === "energy";
}

const LOCAL_VIEW_PREFIX = "almvagen_default_view_";

export function getLocalDefaultView(profileId: string): HubViewId | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(`${LOCAL_VIEW_PREFIX}${profileId}`);
    return isValidHubView(val) ? val : null;
  } catch {
    return null;
  }
}

export function setLocalDefaultView(profileId: string, view: HubViewId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LOCAL_VIEW_PREFIX}${profileId}`, view);
  } catch {
    // Ignore storage errors
  }
}

export async function fetchProfileDefaultView(
  profileId: string,
  propertyId: string | null,
): Promise<HubViewId | null> {
  const local = getLocalDefaultView(profileId);
  const supabase = getSupabaseClient();
  if (!supabase || !propertyId) return local;

  const prefix = `[HUB_PREF:default_view:${profileId}]`;
  const { data, error } = await supabase
    .from("family_notes")
    .select("content")
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const raw = (data[0].content as string).slice(prefix.length).trim();
    if (isValidHubView(raw)) {
      setLocalDefaultView(profileId, raw);
      return raw;
    }
  }
  return local;
}

export async function saveProfileDefaultView(
  profileId: string,
  propertyId: string | null,
  view: HubViewId,
): Promise<void> {
  setLocalDefaultView(profileId, view);
  const supabase = getSupabaseClient();
  if (!supabase || !propertyId) return;

  const prefix = `[HUB_PREF:default_view:${profileId}]`;
  await supabase
    .from("family_notes")
    .delete()
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`);

  await supabase.from("family_notes").insert({
    property_id: propertyId,
    author_id: null,
    author_name: "System",
    content: `${prefix} ${view}`,
    is_pinned: false,
    is_done: false,
  });
}

export async function fetchStructuredNotes(
  propertyId: string,
  prefix: string,
): Promise<FamilyNote[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("family_notes")
    .select(
      "id, property_id, author_id, author_name, content, is_pinned, is_done, created_at",
    )
    .eq("property_id", propertyId)
    .like("content", `${prefix}%`)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as FamilyNote[];
}
