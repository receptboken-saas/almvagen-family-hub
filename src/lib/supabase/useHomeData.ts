"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "./client";
import type {
  DashboardWidget,
  DinnerPlan,
  Floor,
  HomeDataState,
  HouseholdSettings,
  Property,
  Room,
  RoomDevice,
  WeeklyEvent,
} from "./types";

const EMPTY_DATA: HomeDataState = {
  properties: [],
  floors: [],
  rooms: [],
  roomDevices: [],
  dashboardWidgets: [],
  householdSettings: [],
  weeklyEvents: [],
  dinnerPlans: [],
};

function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentWeekBounds(): {
  todayStr: string;
  mondayStr: string;
  sundayStr: string;
  nextSundayStr: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jsDay = today.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const nextSunday = new Date(monday);
  nextSunday.setDate(monday.getDate() + 13);

  return {
    todayStr: toLocalISODate(today),
    mondayStr: toLocalISODate(monday),
    sundayStr: toLocalISODate(sunday),
    nextSundayStr: toLocalISODate(nextSunday),
  };
}

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

    const { todayStr, mondayStr, nextSundayStr } = getCurrentWeekBounds();

    try {
      const [
        propRes,
        floorRes,
        roomRes,
        deviceRes,
        widgetRes,
        settingsRes,
        eventsRes,
        dinnerRes,
      ] = await Promise.all([
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
        supabase
          .from("household_settings")
          .select(
            "property_id, municipality, address_area, waste_ha_entity_id, last_ai_sync_at, updated_at",
          ),
        supabase
          .from("weekly_events")
          .select(
            "id, property_id, profile_id, category, title, subtitle, start_date, end_date, source, created_at",
          )
          .gte("end_date", todayStr)
          .order("start_date", { ascending: true }),
        supabase
          .from("dinner_plans")
          .select(
            "id, property_id, meal_date, dish_name, recipe_url, notes, updated_at",
          )
          .gte("meal_date", mondayStr)
          .lte("meal_date", nextSundayStr)
          .order("meal_date", { ascending: true }),
      ]);

      const firstError =
        propRes.error ||
        floorRes.error ||
        roomRes.error ||
        deviceRes.error ||
        widgetRes.error ||
        settingsRes.error ||
        eventsRes.error ||
        dinnerRes.error;

      if (firstError) {
        setError(firstError.message);
      } else {
        setData({
          properties: (propRes.data ?? []) as Property[],
          floors: (floorRes.data ?? []) as Floor[],
          rooms: (roomRes.data ?? []) as Room[],
          roomDevices: (deviceRes.data ?? []) as RoomDevice[],
          dashboardWidgets: (widgetRes.data ?? []) as DashboardWidget[],
          householdSettings: (settingsRes.data ?? []) as HouseholdSettings[],
          weeklyEvents: (eventsRes.data ?? []) as WeeklyEvent[],
          dinnerPlans: (dinnerRes.data ?? []) as DinnerPlan[],
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
