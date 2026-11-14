import { getSupabaseClient } from "@/lib/supabase/client";
import type { HAConnectionConfig } from "./types";

export const HA_CONFIG_NOTE_PREFIX = "[HA_CONFIG:default]";

async function getPrimaryPropertyId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

/**
 * Fetches the shared Home Assistant WebSocket URL and token from Supabase.
 * Accessible to any authenticated family member / tablet in the household.
 */
export async function fetchCloudHaConfig(): Promise<HAConnectionConfig | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("family_notes")
    .select("content")
    .like("content", `${HA_CONFIG_NOTE_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const rawJson = (data[0].content as string)
    .slice(HA_CONFIG_NOTE_PREFIX.length)
    .trim();

  try {
    const parsed = JSON.parse(rawJson) as Partial<HAConnectionConfig>;
    if (!parsed.wsUrl || !parsed.token) return null;
    return {
      wsUrl: parsed.wsUrl,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

/**
 * Saves the Home Assistant WebSocket URL and token to Supabase so all
 * logged-in family members and tablets connect automatically.
 */
export async function saveCloudHaConfig(
  wsUrl: string,
  token: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase är inte konfigurerat." };
  }

  const propertyId = await getPrimaryPropertyId();
  if (!propertyId) {
    return { error: "Kunde inte hitta något hus (properties) i Supabase." };
  }

  const { error: deleteError } = await supabase
    .from("family_notes")
    .delete()
    .like("content", `${HA_CONFIG_NOTE_PREFIX}%`);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const payload: HAConnectionConfig = {
    wsUrl: wsUrl.trim(),
    token: token.trim(),
  };

  const { error: insertError } = await supabase.from("family_notes").insert({
    property_id: propertyId,
    author_id: null,
    author_name: "System",
    content: `${HA_CONFIG_NOTE_PREFIX} ${JSON.stringify(payload)}`,
    is_pinned: false,
    is_done: false,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return { error: null };
}

/**
 * Removes the shared Home Assistant connection config from Supabase.
 */
export async function clearCloudHaConfig(): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: null };

  const { error } = await supabase
    .from("family_notes")
    .delete()
    .like("content", `${HA_CONFIG_NOTE_PREFIX}%`);

  return { error: error ? error.message : null };
}
