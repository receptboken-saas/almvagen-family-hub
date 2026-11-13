"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "./client";
import type {
  DashboardWidget,
  Floor,
  HomeDataState,
  Property,
  Room,
  RoomDevice,
} from "./types";

const EMPTY_DATA: HomeDataState = {
  properties: [],
  floors: [],
  rooms: [],
  roomDevices: [],
  dashboardWidgets: [],
};

export function useHomeData(userId: string | undefined) {
  const [data, setData] = useState<HomeDataState>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) {
      setData(EMPTY_DATA);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [propRes, floorRes, roomRes, deviceRes, widgetRes] =
        await Promise.all([
          supabase
            .from("properties")
            .select("id, name, address, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("floors")
            .select("id, property_id, name, icon, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("rooms")
            .select("id, floor_id, name, icon, is_common_area, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("room_devices")
            .select(
              "id, room_id, ha_entity_id, display_name, widget_type, sort_order",
            )
            .order("sort_order", { ascending: true }),
          supabase
            .from("dashboard_widgets")
            .select(
              "id, property_id, title, subtitle, ha_entity_id, unit, icon, widget_category, admin_only, sort_order",
            )
            .order("sort_order", { ascending: true }),
        ]);

      const firstError =
        propRes.error ||
        floorRes.error ||
        roomRes.error ||
        deviceRes.error ||
        widgetRes.error;

      if (firstError) {
        setError(firstError.message);
      } else {
        setData({
          properties: (propRes.data ?? []) as Property[],
          floors: (floorRes.data ?? []) as Floor[],
          rooms: (roomRes.data ?? []) as Room[],
          roomDevices: (deviceRes.data ?? []) as RoomDevice[],
          dashboardWidgets: (widgetRes.data ?? []) as DashboardWidget[],
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunde inte hämta hemdata.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
