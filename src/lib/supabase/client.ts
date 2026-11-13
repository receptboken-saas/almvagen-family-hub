/**
 * Supabase client configuration placeholder for Sprint 2.
 * @supabase/supabase-js will be wired up when auth & profiles are introduced.
 */
export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}
