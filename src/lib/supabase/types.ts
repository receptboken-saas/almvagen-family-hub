/**
 * TypeScript types mirroring the Supabase database schema with RLS.
 */

export type ProfileRole = "admin" | "tablet" | "child";

export type WidgetType =
  | "light"
  | "dimmer"
  | "climate"
  | "sensor"
  | "switch"
  | "camera"
  | "energy";

export type WidgetCategory = "energy" | "climate" | "scene" | "security";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: ProfileRole;
  allowed_room_ids: string[] | null;
  allowed_widget_ids: string[] | null;
  show_energy: boolean;
  show_scenes: boolean;
  show_family_board: boolean;
  default_floor_id: string | null;
  quick_pin: string | null;
  avatar_icon: string | null;
  email: string | null;
  school_name: string | null;
  municipality: string | null;
}

export const PROFILE_SELECT_COLUMNS =
  "id, display_name, avatar_url, role, allowed_room_ids, allowed_widget_ids, show_energy, show_scenes, show_family_board, default_floor_id, quick_pin, avatar_icon, email, school_name, municipality";

export interface HouseholdSettings {
  property_id: string;
  municipality: string | null;
  address_area: string | null;
  waste_ha_entity_id: string | null;
  last_ai_sync_at: string | null;
  updated_at: string;
}

export type WeeklyEventCategory =
  | "school_off"
  | "waste"
  | "calendar"
  | "reminder";

export interface WeeklyEvent {
  id: string;
  property_id: string;
  profile_id: string | null;
  category: WeeklyEventCategory;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  source: string | null;
  created_at: string;
}

export interface DinnerPlan {
  id: string;
  property_id: string;
  meal_date: string;
  dish_name: string;
  recipe_url: string | null;
  notes: string | null;
  updated_at: string;
}

export interface FamilyNote {
  id: string;
  property_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  is_pinned: boolean;
  is_done: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  sort_order: number;
}

export interface Floor {
  id: string;
  property_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  icon: string | null;
  is_common_area: boolean;
  sort_order: number;
}

export interface RoomDevice {
  id: string;
  room_id: string;
  ha_entity_id: string;
  display_name: string;
  widget_type: WidgetType;
  sort_order: number;
}

export interface DashboardWidget {
  id: string;
  property_id: string;
  title: string;
  subtitle: string | null;
  ha_entity_id: string;
  unit: string | null;
  icon: string | null;
  widget_category: WidgetCategory;
  admin_only: boolean;
  sort_order: number;
}

export interface HomeDataState {
  properties: Property[];
  floors: Floor[];
  rooms: Room[];
  roomDevices: RoomDevice[];
  dashboardWidgets: DashboardWidget[];
  householdSettings: HouseholdSettings[];
  weeklyEvents: WeeklyEvent[];
  dinnerPlans: DinnerPlan[];
}
