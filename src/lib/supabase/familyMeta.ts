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
  "[HA_CONFIG:",
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

export async function fetchProfileDefaultView(
  profileId: string,
  propertyId: string | null,
): Promise<HubViewId | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !propertyId) return null;

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
      return raw;
    }
  }
  return null;
}

export async function saveProfileDefaultView(
  profileId: string,
  propertyId: string | null,
  view: HubViewId,
): Promise<void> {
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
