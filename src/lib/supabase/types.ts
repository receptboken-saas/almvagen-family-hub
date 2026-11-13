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
}
