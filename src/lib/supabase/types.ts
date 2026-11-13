/**
 * TypeScript types for Supabase authentication and family role permissions (Sprint 2).
 */

export type FamilyRole = "admin" | "adult" | "child" | "tablet_kiosk";

export interface FamilyMemberProfile {
  id: string;
  email: string | null;
  display_name: string;
  role: FamilyRole;
  avatar_url?: string | null;
  created_at: string;
}

export interface PermissionScope {
  canControlClimate: boolean;
  canControlLocks: boolean;
  canControlCharger: boolean;
  canManageSettings: boolean;
}
