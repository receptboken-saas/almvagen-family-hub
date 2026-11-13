"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  PROFILE_SELECT_COLUMNS,
  type DashboardWidget,
  type Floor,
  type HomeDataState,
  type Profile,
  type ProfileRole,
  type Room,
  type RoomDevice,
  type WidgetCategory,
  type WidgetType,
} from "@/lib/supabase/types";
import { AvatarBadge } from "@/components/ui/AvatarBadge";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { HAEntityPicker } from "./HAEntityPicker";
import { IconPicker } from "./IconPicker";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: HomeDataState;
  activePropertyId: string | null;
  onDataChanged: () => Promise<void>;
}

type AdminTab = "rooms" | "properties" | "devices" | "widgets" | "family";

const WIDGET_TYPES: WidgetType[] = [
  "light",
  "dimmer",
  "climate",
  "sensor",
  "switch",
  "camera",
  "energy",
];

const WIDGET_CATEGORIES: WidgetCategory[] = [
  "energy",
  "climate",
  "scene",
  "security",
];

const ROLES: ProfileRole[] = ["admin", "tablet", "child"];

const inputClass =
  "min-h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none";

const cardClass =
  "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4";

const listItemClass =
  "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3";

/**
 * Full-featured, theme-aware Admin configurator for properties, floors,
 * hierarchical rooms with inline device creation, widgets, and family profiles.
 */
export function AdminPanel({
  isOpen,
  onClose,
  data,
  activePropertyId,
  onDataChanged,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("rooms");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Property form
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [editingPropName, setEditingPropName] = useState("");

  // Floor form
  const [floorPropId, setFloorPropId] = useState("");
  const [floorName, setFloorName] = useState("");
  const [floorIcon, setFloorIcon] = useState("layers");
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  // Room form & expanded inline state
  const [showNewRoomForm, setShowNewRoomForm] = useState(false);
  const [roomFloorId, setRoomFloorId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomIcon, setRoomIcon] = useState("room_living");
  const [roomCommon, setRoomCommon] = useState(true);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Inline device form inside expanded room
  const [inlineEntityId, setInlineEntityId] = useState("");
  const [inlineDeviceName, setInlineDeviceName] = useState("");
  const [inlineDeviceType, setInlineDeviceType] = useState<WidgetType>("light");

  // Device form (All devices tab)
  const [deviceRoomId, setDeviceRoomId] = useState("");
  const [deviceFilterRoomId, setDeviceFilterRoomId] = useState<string>("all");
  const [deviceEntityId, setDeviceEntityId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<WidgetType>("light");
  const [editingDevice, setEditingDevice] = useState<RoomDevice | null>(null);

  // Widget form
  const [widgetPropId, setWidgetPropId] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetSubtitle, setWidgetSubtitle] = useState("");
  const [widgetEntityId, setWidgetEntityId] = useState("");
  const [widgetUnit, setWidgetUnit] = useState("");
  const [widgetIcon, setWidgetIcon] = useState("sys_tibber_pulse");
  const [widgetCategory, setWidgetCategory] =
    useState<WidgetCategory>("energy");
  const [widgetAdminOnly, setWidgetAdminOnly] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
    null,
  );

  // Family & tablet profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState<ProfileRole>("tablet");
  const [newProfilePin, setNewProfilePin] = useState("");
  const [newProfileIcon, setNewProfileIcon] = useState("room_living");
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(
    null,
  );
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const defaultProp = activePropertyId ?? data.properties[0]?.id ?? "";
    if (!floorPropId && defaultProp) setFloorPropId(defaultProp);
    if (!widgetPropId && defaultProp) setWidgetPropId(defaultProp);
    if (!roomFloorId && data.floors[0]?.id) setRoomFloorId(data.floors[0].id);
    if (!deviceRoomId && data.rooms[0]?.id) setDeviceRoomId(data.rooms[0].id);
  }, [
    activePropertyId,
    data.properties,
    data.floors,
    data.rooms,
    floorPropId,
    widgetPropId,
    roomFloorId,
    deviceRoomId,
  ]);

  const loadProfiles = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setProfilesLoading(true);
    const { data: rows, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .order("display_name", { ascending: true });
    if (error) {
      setFeedback(`Kunde inte hämta familjeprofiler: ${error.message}`);
    } else if (rows) {
      setProfiles(rows as Profile[]);
    }
    setProfilesLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && tab === "family") {
      loadProfiles();
    }
  }, [isOpen, tab, loadProfiles]);

  const floorNameMap = useMemo(
    () => new Map(data.floors.map((f) => [f.id, f.name])),
    [data.floors],
  );
  const roomNameMap = useMemo(
    () => new Map(data.rooms.map((r) => [r.id, r.name])),
    [data.rooms],
  );
  const propNameMap = useMemo(
    () => new Map(data.properties.map((p) => [p.id, p.name])),
    [data.properties],
  );

  const devicesByRoom = useMemo(() => {
    const map = new Map<string, RoomDevice[]>();
    for (const d of data.roomDevices) {
      const list = map.get(d.room_id) ?? [];
      list.push(d);
      map.set(d.room_id, list);
    }
    return map;
  }, [data.roomDevices]);

  const filteredDevices = useMemo(
    () =>
      deviceFilterRoomId === "all"
        ? data.roomDevices
        : data.roomDevices.filter((d) => d.room_id === deviceFilterRoomId),
    [data.roomDevices, deviceFilterRoomId],
  );

  if (!isOpen) return null;

  async function runMutation(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    setFeedback(null);
    const { error } = await action();
    if (error) {
      setFeedback(`Fel: ${error.message}`);
    } else {
      await onDataChanged();
    }
    setBusy(false);
    return !error;
  }

  async function moveSortOrder<T extends { id: string; sort_order: number }>(
    table: "floors" | "rooms" | "room_devices" | "dashboard_widgets",
    items: T[],
    index: number,
    direction: -1 | 1,
  ) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const current = items[index];
    const target = items[targetIndex];
    const sameOrder = current.sort_order === target.sort_order;
    const nextCurrentOrder = sameOrder ? targetIndex : target.sort_order;
    const nextTargetOrder = sameOrder ? index : current.sort_order;

    setBusy(true);
    setFeedback(null);
    const [resA, resB] = await Promise.all([
      supabase
        .from(table)
        .update({ sort_order: nextCurrentOrder })
        .eq("id", current.id),
      supabase
        .from(table)
        .update({ sort_order: nextTargetOrder })
        .eq("id", target.id),
    ]);

    const err = resA.error || resB.error;
    if (err) {
      setFeedback(`Fel vid sortering: ${err.message}`);
    } else {
      await onDataChanged();
    }
    setBusy(false);
  }

  async function handleAddProperty(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propName.trim()) return;
    const ok = await runMutation(() =>
      supabase.from("properties").insert({
        name: propName.trim(),
        address: propAddress.trim() || null,
        sort_order: data.properties.length,
      }),
    );
    if (ok) {
      setPropName("");
      setPropAddress("");
    }
  }

  async function handleSavePropertyName(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase || !editingPropName.trim()) return;
    const ok = await runMutation(() =>
      supabase
        .from("properties")
        .update({ name: editingPropName.trim() })
        .eq("id", id),
    );
    if (ok) {
      setEditingPropId(null);
      setEditingPropName("");
    }
  }

  async function handleAddFloor(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !floorPropId || !floorName.trim()) return;
    const ok = await runMutation(() =>
      supabase.from("floors").insert({
        property_id: floorPropId,
        name: floorName.trim(),
        icon: floorIcon || "layers",
        sort_order: data.floors.length,
      }),
    );
    if (ok) {
      setFloorName("");
    }
  }

  async function handleSaveFloor(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !editingFloor || !editingFloor.name.trim()) return;
    const ok = await runMutation(() =>
      supabase
        .from("floors")
        .update({
          name: editingFloor.name.trim(),
          icon: editingFloor.icon || "layers",
        })
        .eq("id", editingFloor.id),
    );
    if (ok) {
      setEditingFloor(null);
    }
  }

  async function handleAddRoom(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !roomFloorId || !roomName.trim()) return;
    const ok = await runMutation(() =>
      supabase.from("rooms").insert({
        floor_id: roomFloorId,
        name: roomName.trim(),
        icon: roomIcon,
        is_common_area: roomCommon,
        sort_order: data.rooms.length,
      }),
    );
    if (ok) {
      setRoomName("");
      setShowNewRoomForm(false);
    }
  }

  async function handleSaveRoom(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !editingRoom || !editingRoom.name.trim()) return;
    const ok = await runMutation(() =>
      supabase
        .from("rooms")
        .update({
          name: editingRoom.name.trim(),
          floor_id: editingRoom.floor_id,
          is_common_area: editingRoom.is_common_area,
          icon: editingRoom.icon,
        })
        .eq("id", editingRoom.id),
    );
    if (ok) {
      setEditingRoom(null);
    }
  }

  async function handleDuplicateRoom(room: Room) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    setFeedback(null);

    const { data: inserted, error } = await supabase
      .from("rooms")
      .insert({
        floor_id: room.floor_id,
        name: `${room.name} (kopia)`,
        icon: room.icon,
        is_common_area: room.is_common_area,
        sort_order: data.rooms.length,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setFeedback(`Kunde inte duplicera rum: ${error?.message ?? "okänt fel"}`);
      setBusy(false);
      return;
    }

    const sourceDevices = devicesByRoom.get(room.id) ?? [];
    if (sourceDevices.length > 0) {
      const copies = sourceDevices.map((d, idx) => ({
        room_id: inserted.id,
        ha_entity_id: d.ha_entity_id,
        display_name: d.display_name,
        widget_type: d.widget_type,
        sort_order: idx,
      }));
      const { error: devErr } = await supabase
        .from("room_devices")
        .insert(copies);
      if (devErr) {
        setFeedback(`Rum duplicerat men enheter misslyckades: ${devErr.message}`);
      }
    }

    await onDataChanged();
    setExpandedRoomId(inserted.id);
    setBusy(false);
  }

  async function handleAddInlineDevice(e: FormEvent, roomId: string) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !inlineEntityId.trim() || !inlineDeviceName.trim()) {
      return;
    }
    const existingCount = (devicesByRoom.get(roomId) ?? []).length;
    const ok = await runMutation(() =>
      supabase.from("room_devices").insert({
        room_id: roomId,
        ha_entity_id: inlineEntityId.trim(),
        display_name: inlineDeviceName.trim(),
        widget_type: inlineDeviceType,
        sort_order: existingCount,
      }),
    );
    if (ok) {
      setInlineEntityId("");
      setInlineDeviceName("");
    }
  }

  async function handleAddDevice(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (
      !supabase ||
      !deviceRoomId ||
      !deviceEntityId.trim() ||
      !deviceName.trim()
    ) {
      return;
    }
    const ok = await runMutation(() =>
      supabase.from("room_devices").insert({
        room_id: deviceRoomId,
        ha_entity_id: deviceEntityId.trim(),
        display_name: deviceName.trim(),
        widget_type: deviceType,
        sort_order: data.roomDevices.length,
      }),
    );
    if (ok) {
      setDeviceEntityId("");
      setDeviceName("");
    }
  }

  async function handleSaveDevice(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (
      !supabase ||
      !editingDevice ||
      !editingDevice.display_name.trim() ||
      !editingDevice.ha_entity_id.trim()
    ) {
      return;
    }
    const ok = await runMutation(() =>
      supabase
        .from("room_devices")
        .update({
          room_id: editingDevice.room_id,
          ha_entity_id: editingDevice.ha_entity_id.trim(),
          display_name: editingDevice.display_name.trim(),
          widget_type: editingDevice.widget_type,
        })
        .eq("id", editingDevice.id),
    );
    if (ok) {
      setEditingDevice(null);
    }
  }

  async function handleAddWidget(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (
      !supabase ||
      !widgetPropId ||
      !widgetEntityId.trim() ||
      !widgetTitle.trim()
    ) {
      return;
    }
    const ok = await runMutation(() =>
      supabase.from("dashboard_widgets").insert({
        property_id: widgetPropId,
        ha_entity_id: widgetEntityId.trim(),
        title: widgetTitle.trim(),
        subtitle: widgetSubtitle.trim() || null,
        unit: widgetUnit.trim() || null,
        icon: widgetIcon,
        widget_category: widgetCategory,
        admin_only: widgetAdminOnly,
        sort_order: data.dashboardWidgets.length,
      }),
    );
    if (ok) {
      setWidgetEntityId("");
      setWidgetTitle("");
      setWidgetSubtitle("");
      setWidgetUnit("");
    }
  }

  async function handleSaveWidget(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (
      !supabase ||
      !editingWidget ||
      !editingWidget.title.trim() ||
      !editingWidget.ha_entity_id.trim()
    ) {
      return;
    }
    const ok = await runMutation(() =>
      supabase
        .from("dashboard_widgets")
        .update({
          title: editingWidget.title.trim(),
          subtitle: editingWidget.subtitle?.trim() || null,
          ha_entity_id: editingWidget.ha_entity_id.trim(),
          unit: editingWidget.unit?.trim() || null,
          icon: editingWidget.icon,
          widget_category: editingWidget.widget_category,
          admin_only: editingWidget.admin_only,
        })
        .eq("id", editingWidget.id),
    );
    if (ok) {
      setEditingWidget(null);
    }
  }

  async function deleteRow(
    table:
      | "properties"
      | "floors"
      | "rooms"
      | "room_devices"
      | "dashboard_widgets",
    id: string,
  ) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await runMutation(() => supabase.from(table).delete().eq("id", id));
  }

  async function handleCreateProfile(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !newProfileName.trim()) return;
    const rawPin = newProfilePin.trim();
    if (rawPin && !/^\d{4}$/.test(rawPin)) {
      setFeedback("Snabb-PIN måste bestå av exakt 4 siffror (eller lämnas tom).");
      return;
    }

    setBusy(true);
    setFeedback(null);
    const { data: inserted, error } = await supabase
      .from("profiles")
      .insert({
        display_name: newProfileName.trim(),
        role: newProfileRole,
        quick_pin: rawPin || null,
        avatar_icon: newProfileIcon || null,
        allowed_room_ids: [],
        allowed_widget_ids: [],
        show_energy: true,
        show_scenes: true,
        show_family_board: true,
        default_floor_id: null,
      })
      .select(PROFILE_SELECT_COLUMNS)
      .single();

    if (error) {
      setFeedback(`Kunde inte skapa profil: ${error.message}`);
    } else {
      setNewProfileName("");
      setNewProfilePin("");
      await loadProfiles();
      if (inserted) {
        const created = inserted as Profile;
        setExpandedProfileId(created.id);
        setEditingProfile(created);
      }
      setFeedback("Ny profil/surfplatta skapad. Anpassa rum och widgets nedan.");
    }
    setBusy(false);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !editingProfile) return;
    const rawPin = (editingProfile.quick_pin ?? "").trim();
    if (rawPin && !/^\d{4}$/.test(rawPin)) {
      setFeedback("Snabb-PIN måste bestå av exakt 4 siffror (eller lämnas tom).");
      return;
    }

    setBusy(true);
    setFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editingProfile.display_name?.trim() || null,
        role: editingProfile.role,
        quick_pin: rawPin || null,
        avatar_icon: editingProfile.avatar_icon || null,
        allowed_room_ids: editingProfile.allowed_room_ids ?? [],
        allowed_widget_ids: editingProfile.allowed_widget_ids ?? [],
        show_energy: editingProfile.show_energy,
        show_scenes: editingProfile.show_scenes,
        show_family_board: editingProfile.show_family_board,
        default_floor_id: editingProfile.default_floor_id || null,
      })
      .eq("id", editingProfile.id);

    if (error) {
      setFeedback(`Kunde inte spara profil: ${error.message}`);
    } else {
      setFeedback("Profilen sparades.");
      await loadProfiles();
      await onDataChanged();
    }
    setBusy(false);
  }

  async function handleDeleteProfile(profileId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);
    if (error) {
      setFeedback(`Kunde inte ta bort profil: ${error.message}`);
    } else {
      if (expandedProfileId === profileId) {
        setExpandedProfileId(null);
        setEditingProfile(null);
      }
      await loadProfiles();
    }
    setBusy(false);
  }

  function toggleExpandProfile(profile: Profile) {
    if (expandedProfileId === profile.id) {
      setExpandedProfileId(null);
      setEditingProfile(null);
    } else {
      setExpandedProfileId(profile.id);
      setEditingProfile({
        ...profile,
        allowed_room_ids: profile.allowed_room_ids ?? [],
        allowed_widget_ids: profile.allowed_widget_ids ?? [],
        show_energy: profile.show_energy ?? true,
        show_scenes: profile.show_scenes ?? true,
        show_family_board: profile.show_family_board ?? true,
      });
    }
  }

  function toggleEditingProfileArray(
    field: "allowed_room_ids" | "allowed_widget_ids",
    itemId: string,
  ) {
    if (!editingProfile) return;
    const current = editingProfile[field] ?? [];
    const next = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    setEditingProfile({ ...editingProfile, [field]: next });
  }

  function toggleExpandRoom(room: Room) {
    if (expandedRoomId === room.id) {
      setExpandedRoomId(null);
      setEditingRoom(null);
    } else {
      setExpandedRoomId(room.id);
      setEditingRoom(room);
      setInlineEntityId("");
      setInlineDeviceName("");
      setInlineDeviceType("light");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Admin-konfigurator"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                Admin-konfigurator
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                100 % datadriven struktur i Supabase – noll hårdkodning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng admin-panel"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] px-6 py-3">
          {(
            [
              { id: "rooms", label: "Rum & Hierarki" },
              { id: "properties", label: "Hus & Våningar" },
              { id: "devices", label: "Alla Enheter" },
              { id: "widgets", label: "Översikts-widgets" },
              { id: "family", label: "Familj & Surfplattor" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-10 rounded-xl px-4 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-[#6B8E6B] text-white shadow-sm"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {feedback && (
            <div className="rounded-xl border border-[#D49A42]/40 bg-[#D49A42]/10 px-4 py-3 text-sm text-[var(--text-primary)]">
              {feedback}
            </div>
          )}

          {/* TAB: ROOMS HIERARCHY */}
          {tab === "rooms" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-base font-semibold text-[var(--text-primary)]">
                    Våningar, rum & enheter
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Klicka på ett rum för att redigera det direkt eller lägga till enheter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewRoomForm((prev) => !prev)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:bg-[#5B7D5B]"
                >
                  <Plus className="h-4 w-4" />
                  {showNewRoomForm ? "Dölj formulär" : "Nytt rum"}
                </button>
              </div>

              {showNewRoomForm && (
                <form onSubmit={handleAddRoom} className={`${cardClass} space-y-3`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={roomFloorId}
                      onChange={(e) => setRoomFloorId(e.target.value)}
                      className={inputClass}
                    >
                      {data.floors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {propNameMap.get(f.property_id) ?? "Hus"} – {f.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Rumsnamn (t.ex. Vardagsrum)"
                      className={inputClass}
                    />
                  </div>
                  <IconPicker
                    value={roomIcon}
                    onChange={setRoomIcon}
                    filterGroups={["Rum & Ytor", "Belysning & Vitvaror"]}
                    label="Rumsikon"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex min-h-10 items-center gap-2.5 text-sm text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={roomCommon}
                        onChange={(e) => setRoomCommon(e.target.checked)}
                        className="h-4 w-4 accent-[#6B8E6B]"
                      />
                      <span>Gemensamt utrymme (visas på väggplatta)</span>
                    </label>
                    <button
                      type="submit"
                      disabled={busy || data.floors.length === 0}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6B8E6B] px-5 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" /> Skapa rum
                    </button>
                  </div>
                </form>
              )}

              {data.floors.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Skapa ett hus och en våning under fliken &ldquo;Hus &amp; Våningar&rdquo; först.
                </p>
              ) : (
                <div className="space-y-5">
                  {data.floors.map((floor) => {
                    const floorRooms = data.rooms.filter(
                      (r) => r.floor_id === floor.id,
                    );
                    return (
                      <section key={floor.id} className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <DynamicIcon
                              name={floor.icon}
                              className="h-4 w-4 text-[#6B8E6B]"
                            />
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                              {propNameMap.get(floor.property_id) ?? "Hus"} ·{" "}
                              <span className="text-[var(--text-primary)]">
                                {floor.name}
                              </span>{" "}
                              ({floorRooms.length} rum)
                            </h4>
                          </div>
                        </div>

                        {floorRooms.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                            Inga rum på denna våning ännu.
                          </p>
                        ) : (
                          <ul className="space-y-2.5">
                            {floorRooms.map((r, idx) => {
                              const isExpanded = expandedRoomId === r.id;
                              const roomDevices = devicesByRoom.get(r.id) ?? [];
                              const editTarget =
                                editingRoom?.id === r.id ? editingRoom : r;

                              return (
                                <li
                                  key={r.id}
                                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] transition-colors"
                                >
                                  {/* Room summary row */}
                                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandRoom(r)}
                                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B8E6B]" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                      )}
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6B8E6B]/12 text-[#6B8E6B]">
                                        <DynamicIcon
                                          name={r.icon}
                                          className="h-4 w-4"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="truncate font-serif text-sm font-semibold text-[var(--text-primary)]">
                                            {r.name}
                                          </p>
                                          <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                                            {roomDevices.length}{" "}
                                            {roomDevices.length === 1
                                              ? "enhet"
                                              : "enheter"}
                                          </span>
                                          {r.is_common_area && (
                                            <span className="rounded-md bg-[#6B8E6B]/15 px-2 py-0.5 text-[11px] font-medium text-[#6B8E6B]">
                                              Väggplatta
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        disabled={busy || idx === 0}
                                        onClick={() =>
                                          moveSortOrder("rooms", floorRooms, idx, -1)
                                        }
                                        aria-label="Flytta upp"
                                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          busy || idx === floorRooms.length - 1
                                        }
                                        onClick={() =>
                                          moveSortOrder("rooms", floorRooms, idx, 1)
                                        }
                                        aria-label="Flytta ner"
                                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => handleDuplicateRoom(r)}
                                        aria-label="Duplicera rum"
                                        title="Duplicera rum"
                                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[#6B8E6B]"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandRoom(r)}
                                        aria-label="Redigera rum"
                                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteRow("rooms", r.id)}
                                        aria-label="Ta bort rum"
                                        className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expanded inline editor + devices inside room */}
                                  {isExpanded && (
                                    <div className="space-y-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4">
                                      <form
                                        onSubmit={handleSaveRoom}
                                        className="space-y-3"
                                      >
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <div>
                                            <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                              Rumsnamn
                                            </label>
                                            <input
                                              type="text"
                                              required
                                              value={editTarget.name}
                                              onChange={(e) =>
                                                setEditingRoom({
                                                  ...editTarget,
                                                  name: e.target.value,
                                                })
                                              }
                                              className={inputClass}
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                              Våning / Zon
                                            </label>
                                            <select
                                              value={editTarget.floor_id}
                                              onChange={(e) =>
                                                setEditingRoom({
                                                  ...editTarget,
                                                  floor_id: e.target.value,
                                                })
                                              }
                                              className={inputClass}
                                            >
                                              {data.floors.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.name}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        <IconPicker
                                          value={editTarget.icon ?? "room_living"}
                                          onChange={(icon) =>
                                            setEditingRoom({ ...editTarget, icon })
                                          }
                                          filterGroups={[
                                            "Rum & Ytor",
                                            "Belysning & Vitvaror",
                                          ]}
                                          label="Rumsikon"
                                        />

                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <label className="flex min-h-10 items-center gap-2.5 text-sm text-[var(--text-primary)]">
                                            <input
                                              type="checkbox"
                                              checked={editTarget.is_common_area}
                                              onChange={(e) =>
                                                setEditingRoom({
                                                  ...editTarget,
                                                  is_common_area: e.target.checked,
                                                })
                                              }
                                              className="h-4 w-4 accent-[#6B8E6B]"
                                            />
                                            <span>
                                              Gemensamt utrymme (visas på väggplatta)
                                            </span>
                                          </label>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedRoomId(null)
                                              }
                                              className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)]"
                                            >
                                              Stäng
                                            </button>
                                            <button
                                              type="submit"
                                              disabled={busy}
                                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white hover:bg-[#5B7D5B]"
                                            >
                                              <Check className="h-3.5 w-3.5" /> Spara rum
                                            </button>
                                          </div>
                                        </div>
                                      </form>

                                      {/* Devices in this room */}
                                      <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                          Enheter i {r.name} ({roomDevices.length})
                                        </p>

                                        {roomDevices.length > 0 && (
                                          <ul className="space-y-1.5">
                                            {roomDevices.map((d, dIdx) => (
                                              <li
                                                key={d.id}
                                                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2"
                                              >
                                                <div className="min-w-0">
                                                  <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                                    {d.display_name}
                                                  </p>
                                                  <p className="truncate font-mono text-[11px] text-[var(--text-secondary)]">
                                                    {d.ha_entity_id} · {d.widget_type}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                  <button
                                                    type="button"
                                                    disabled={busy || dIdx === 0}
                                                    onClick={() =>
                                                      moveSortOrder(
                                                        "room_devices",
                                                        roomDevices,
                                                        dIdx,
                                                        -1,
                                                      )
                                                    }
                                                    aria-label="Flytta upp enhet"
                                                    className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                  >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={
                                                      busy ||
                                                      dIdx ===
                                                        roomDevices.length - 1
                                                    }
                                                    onClick={() =>
                                                      moveSortOrder(
                                                        "room_devices",
                                                        roomDevices,
                                                        dIdx,
                                                        1,
                                                      )
                                                    }
                                                    aria-label="Flytta ner enhet"
                                                    className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                  >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      deleteRow(
                                                        "room_devices",
                                                        d.id,
                                                      )
                                                    }
                                                    aria-label="Ta bort enhet"
                                                    className="rounded-lg p-1.5 text-[#C86D51] hover:bg-[#C86D51]/10"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        )}

                                        <form
                                          onSubmit={(e) =>
                                            handleAddInlineDevice(e, r.id)
                                          }
                                          className="grid gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/70 p-3 sm:grid-cols-12"
                                        >
                                          <div className="sm:col-span-5">
                                            <HAEntityPicker
                                              value={inlineEntityId}
                                              onChange={(
                                                entityId,
                                                friendlyName,
                                              ) => {
                                                setInlineEntityId(entityId);
                                                if (
                                                  friendlyName &&
                                                  !inlineDeviceName
                                                ) {
                                                  setInlineDeviceName(
                                                    friendlyName,
                                                  );
                                                }
                                              }}
                                              placeholder="Sök HA-entitet…"
                                            />
                                          </div>
                                          <div className="sm:col-span-3">
                                            <input
                                              type="text"
                                              required
                                              value={inlineDeviceName}
                                              onChange={(e) =>
                                                setInlineDeviceName(
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="Namn i rummet"
                                              className={inputClass}
                                            />
                                          </div>
                                          <div className="sm:col-span-2">
                                            <select
                                              value={inlineDeviceType}
                                              onChange={(e) =>
                                                setInlineDeviceType(
                                                  e.target.value as WidgetType,
                                                )
                                              }
                                              className={inputClass}
                                            >
                                              {WIDGET_TYPES.map((wt) => (
                                                <option key={wt} value={wt}>
                                                  {wt}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <button
                                            type="submit"
                                            disabled={busy}
                                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#6B8E6B] px-3 text-xs font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50 sm:col-span-2"
                                          >
                                            <Plus className="h-3.5 w-3.5" /> Lägg till
                                          </button>
                                        </form>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PROPERTIES & FLOORS */}
          {tab === "properties" && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Hus / Fastigheter ({data.properties.length})
                </h3>
                <form
                  onSubmit={handleAddProperty}
                  className={`${cardClass} space-y-3`}
                >
                  <input
                    type="text"
                    required
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    placeholder="Namn (t.ex. Almvägen 12)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
                    placeholder="Adress (valfritt)"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till hus
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.properties.map((p) => (
                    <li
                      key={p.id}
                      className={`${listItemClass} flex items-center justify-between gap-2`}
                    >
                      {editingPropId === p.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editingPropName}
                            onChange={(e) => setEditingPropName(e.target.value)}
                            className="min-h-9 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-sm text-[var(--text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePropertyName(p.id)}
                            className="rounded-lg bg-[#6B8E6B] p-2 text-white"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPropId(null)}
                            className="rounded-lg bg-[var(--bg-subtle)] p-2 text-[var(--text-secondary)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p className="truncate font-serif text-sm font-semibold text-[var(--text-primary)]">
                              {p.name}
                            </p>
                            {p.address && (
                              <p className="truncate text-xs text-[var(--text-secondary)]">
                                {p.address}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPropId(p.id);
                                setEditingPropName(p.name);
                              }}
                              className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow("properties", p.id)}
                              className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Våningar ({data.floors.length})
                </h3>
                <form
                  onSubmit={handleAddFloor}
                  className={`${cardClass} space-y-3`}
                >
                  <select
                    value={floorPropId}
                    onChange={(e) => setFloorPropId(e.target.value)}
                    className={inputClass}
                  >
                    {data.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={floorName}
                    onChange={(e) => setFloorName(e.target.value)}
                    placeholder="Våningsnamn (t.ex. Entréplan)"
                    className={inputClass}
                  />
                  <IconPicker
                    value={floorIcon}
                    onChange={setFloorIcon}
                    filterGroups={["Rum & Ytor"]}
                    label="Våningsikon (valfritt)"
                  />
                  <button
                    type="submit"
                    disabled={busy || data.properties.length === 0}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till våning
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.floors.map((f, idx) => (
                    <li key={f.id} className={listItemClass}>
                      {editingFloor?.id === f.id ? (
                        <form onSubmit={handleSaveFloor} className="space-y-3">
                          <input
                            type="text"
                            required
                            value={editingFloor.name}
                            onChange={(e) =>
                              setEditingFloor({
                                ...editingFloor,
                                name: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                          <IconPicker
                            value={editingFloor.icon ?? "layers"}
                            onChange={(icon) =>
                              setEditingFloor({ ...editingFloor, icon })
                            }
                            filterGroups={["Rum & Ytor"]}
                            label="Välj våningsikon"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingFloor(null)}
                              className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)]"
                            >
                              Avbryt
                            </button>
                            <button
                              type="submit"
                              disabled={busy}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white"
                            >
                              <Check className="h-3.5 w-3.5" /> Spara våning
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <DynamicIcon
                              name={f.icon}
                              className="h-4 w-4 shrink-0 text-[#6B8E6B]"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {f.name}
                              </p>
                              <p className="truncate text-xs text-[var(--text-secondary)]">
                                {propNameMap.get(f.property_id) ?? "Hus"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={busy || idx === 0}
                              onClick={() =>
                                moveSortOrder("floors", data.floors, idx, -1)
                              }
                              aria-label="Flytta upp"
                              className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy || idx === data.floors.length - 1}
                              onClick={() =>
                                moveSortOrder("floors", data.floors, idx, 1)
                              }
                              aria-label="Flytta ner"
                              className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFloor(f)}
                              aria-label="Redigera våning"
                              className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow("floors", f.id)}
                              aria-label="Ta bort våning"
                              className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB: ALL DEVICES */}
          {tab === "devices" && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddDevice}
                className={`${cardClass} grid gap-3 sm:grid-cols-2`}
              >
                <select
                  value={deviceRoomId}
                  onChange={(e) => setDeviceRoomId(e.target.value)}
                  className={inputClass}
                >
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({floorNameMap.get(r.floor_id) ?? "Våning"})
                    </option>
                  ))}
                </select>
                <select
                  value={deviceType}
                  onChange={(e) =>
                    setDeviceType(e.target.value as WidgetType)
                  }
                  className={inputClass}
                >
                  {WIDGET_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      Typ: {wt}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-2">
                  <HAEntityPicker
                    value={deviceEntityId}
                    onChange={(entityId, friendlyName) => {
                      setDeviceEntityId(entityId);
                      if (friendlyName && !deviceName) {
                        setDeviceName(friendlyName);
                      }
                    }}
                  />
                </div>
                <input
                  type="text"
                  required
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Visningsnamn (t.ex. Taklampa)"
                  className={`${inputClass} sm:col-span-2`}
                />
                <button
                  type="submit"
                  disabled={busy || data.rooms.length === 0}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till enhet i rum
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Enheter ({filteredDevices.length})
                </p>
                <select
                  value={deviceFilterRoomId}
                  onChange={(e) => setDeviceFilterRoomId(e.target.value)}
                  className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)]"
                >
                  <option value="all">Alla rum</option>
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="space-y-2.5">
                {filteredDevices.map((d, idx) => (
                  <li key={d.id} className={listItemClass}>
                    {editingDevice?.id === d.id ? (
                      <form
                        onSubmit={handleSaveDevice}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <select
                          value={editingDevice.room_id}
                          onChange={(e) =>
                            setEditingDevice({
                              ...editingDevice,
                              room_id: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          {data.rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              Rum: {r.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editingDevice.widget_type}
                          onChange={(e) =>
                            setEditingDevice({
                              ...editingDevice,
                              widget_type: e.target.value as WidgetType,
                            })
                          }
                          className={inputClass}
                        >
                          {WIDGET_TYPES.map((wt) => (
                            <option key={wt} value={wt}>
                              Typ: {wt}
                            </option>
                          ))}
                        </select>
                        <div className="sm:col-span-2">
                          <HAEntityPicker
                            value={editingDevice.ha_entity_id}
                            onChange={(entityId) =>
                              setEditingDevice({
                                ...editingDevice,
                                ha_entity_id: entityId,
                              })
                            }
                          />
                        </div>
                        <input
                          type="text"
                          required
                          value={editingDevice.display_name}
                          onChange={(e) =>
                            setEditingDevice({
                              ...editingDevice,
                              display_name: e.target.value,
                            })
                          }
                          className={`${inputClass} sm:col-span-2`}
                        />
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingDevice(null)}
                            className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Avbryt
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Spara enhet
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                              {d.display_name}
                            </p>
                            <span className="rounded-md bg-[#6B8E6B]/15 px-2 py-0.5 text-[11px] font-medium text-[#6B8E6B]">
                              {roomNameMap.get(d.room_id) ?? "Okänt rum"}
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                            {d.ha_entity_id} · {d.widget_type}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={busy || idx === 0}
                            onClick={() =>
                              moveSortOrder(
                                "room_devices",
                                filteredDevices,
                                idx,
                                -1,
                              )
                            }
                            aria-label="Flytta upp"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || idx === filteredDevices.length - 1
                            }
                            onClick={() =>
                              moveSortOrder(
                                "room_devices",
                                filteredDevices,
                                idx,
                                1,
                              )
                            }
                            aria-label="Flytta ner"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDevice(d)}
                            aria-label="Redigera enhet"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow("room_devices", d.id)}
                            aria-label="Ta bort enhet"
                            className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB: WIDGETS */}
          {tab === "widgets" && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddWidget}
                className={`${cardClass} grid gap-3 sm:grid-cols-2`}
              >
                <select
                  value={widgetPropId}
                  onChange={(e) => setWidgetPropId(e.target.value)}
                  className={inputClass}
                >
                  {data.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={widgetCategory}
                  onChange={(e) =>
                    setWidgetCategory(e.target.value as WidgetCategory)
                  }
                  className={inputClass}
                >
                  {WIDGET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      Kategori: {c}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-2">
                  <HAEntityPicker
                    value={widgetEntityId}
                    placeholder="Sök HA-entitet (t.ex. sensor.tibber_pulse_power)"
                    onChange={(entityId, friendlyName, unit) => {
                      setWidgetEntityId(entityId);
                      if (friendlyName && !widgetTitle)
                        setWidgetTitle(friendlyName);
                      if (unit && !widgetUnit) setWidgetUnit(unit);
                    }}
                  />
                </div>
                <input
                  type="text"
                  required
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Rubrik (t.ex. Tibber Pulse)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={widgetSubtitle}
                  onChange={(e) => setWidgetSubtitle(e.target.value)}
                  placeholder="Underrubrik (t.ex. Realtidseffekt)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={widgetUnit}
                  onChange={(e) => setWidgetUnit(e.target.value)}
                  placeholder="Enhet (t.ex. W, °C, öre/kWh)"
                  className={`${inputClass} sm:col-span-2`}
                />
                <div className="sm:col-span-2">
                  <IconPicker
                    value={widgetIcon}
                    onChange={setWidgetIcon}
                    label="Välj widget-ikon"
                  />
                </div>
                <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={widgetAdminOnly}
                    onChange={(e) => setWidgetAdminOnly(e.target.checked)}
                    className="h-4 w-4 accent-[#6B8E6B]"
                  />
                  <span>Endast synlig för admin</span>
                </label>
                <button
                  type="submit"
                  disabled={busy || data.properties.length === 0}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till översikts-widget
                </button>
              </form>

              <ul className="space-y-2.5">
                {data.dashboardWidgets.map((w, idx) => (
                  <li key={w.id} className={listItemClass}>
                    {editingWidget?.id === w.id ? (
                      <form
                        onSubmit={handleSaveWidget}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <input
                          type="text"
                          required
                          value={editingWidget.title}
                          onChange={(e) =>
                            setEditingWidget({
                              ...editingWidget,
                              title: e.target.value,
                            })
                          }
                          placeholder="Rubrik"
                          className={inputClass}
                        />
                        <select
                          value={editingWidget.widget_category}
                          onChange={(e) =>
                            setEditingWidget({
                              ...editingWidget,
                              widget_category: e.target.value as WidgetCategory,
                            })
                          }
                          className={inputClass}
                        >
                          {WIDGET_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              Kategori: {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editingWidget.subtitle ?? ""}
                          onChange={(e) =>
                            setEditingWidget({
                              ...editingWidget,
                              subtitle: e.target.value,
                            })
                          }
                          placeholder="Underrubrik"
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={editingWidget.unit ?? ""}
                          onChange={(e) =>
                            setEditingWidget({
                              ...editingWidget,
                              unit: e.target.value,
                            })
                          }
                          placeholder="Enhet (t.ex. W, °C)"
                          className={inputClass}
                        />
                        <div className="sm:col-span-2">
                          <HAEntityPicker
                            value={editingWidget.ha_entity_id}
                            onChange={(entityId) =>
                              setEditingWidget({
                                ...editingWidget,
                                ha_entity_id: entityId,
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <IconPicker
                            value={editingWidget.icon ?? "sys_tibber_pulse"}
                            onChange={(icon) =>
                              setEditingWidget({ ...editingWidget, icon })
                            }
                            label="Widget-ikon"
                          />
                        </div>
                        <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={editingWidget.admin_only}
                            onChange={(e) =>
                              setEditingWidget({
                                ...editingWidget,
                                admin_only: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-[#6B8E6B]"
                          />
                          <span>Endast synlig för admin</span>
                        </label>
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingWidget(null)}
                            className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Avbryt
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-xs font-semibold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Spara widget
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <DynamicIcon
                            name={w.icon}
                            className="h-4 w-4 shrink-0 text-[#6B8E6B]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                              {w.title}{" "}
                              {w.admin_only && (
                                <span className="text-xs text-[#D49A42]">
                                  (Admin)
                                </span>
                              )}
                            </p>
                            <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                              {w.ha_entity_id} · {w.widget_category}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={busy || idx === 0}
                            onClick={() =>
                              moveSortOrder(
                                "dashboard_widgets",
                                data.dashboardWidgets,
                                idx,
                                -1,
                              )
                            }
                            aria-label="Flytta upp"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || idx === data.dashboardWidgets.length - 1
                            }
                            onClick={() =>
                              moveSortOrder(
                                "dashboard_widgets",
                                data.dashboardWidgets,
                                idx,
                                1,
                              )
                            }
                            aria-label="Flytta ner"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWidget(w)}
                            aria-label="Redigera widget"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow("dashboard_widgets", w.id)}
                            aria-label="Ta bort widget"
                            className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB: FAMILY & TABLETS */}
          {tab === "family" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Users className="h-4 w-4 text-[#6B8E6B]" />
                  <span>Familjemedlemmar &amp; Väggplattor ({profiles.length})</span>
                </div>
                <button
                  type="button"
                  onClick={loadProfiles}
                  disabled={profilesLoading}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                >
                  {profilesLoading ? "Laddar…" : "Uppdatera"}
                </button>
              </div>

              {/* Create new profile / wall tablet */}
              <form
                onSubmit={handleCreateProfile}
                className={`${cardClass} space-y-3`}
              >
                <p className="font-serif text-sm font-semibold text-[var(--text-primary)]">
                  Skapa ny profil / surfplatta
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Namn (t.ex. Bella, Kökspanel)"
                    className={inputClass}
                  />
                  <select
                    value={newProfileRole}
                    onChange={(e) =>
                      setNewProfileRole(e.target.value as ProfileRole)
                    }
                    className={inputClass}
                  >
                    <option value="tablet">Väggplatta / Panel (tablet)</option>
                    <option value="child">Familjemedlem / Barn (child)</option>
                    <option value="admin">Förälder / Admin (admin)</option>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newProfilePin}
                    onChange={(e) =>
                      setNewProfilePin(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="Snabb-PIN (4 siffror, valfri)"
                    className={`${inputClass} font-mono tracking-widest`}
                  />
                </div>

                <IconPicker
                  value={newProfileIcon}
                  onChange={setNewProfileIcon}
                  label="Ikon / Avatar"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6B8E6B] px-5 text-sm font-semibold text-white hover:bg-[#5B7D5B] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Skapa profil / platta
                  </button>
                </div>
              </form>

              {/* Existing profiles list */}
              <div className="space-y-3">
                {profiles.map((p) => {
                  const isExpanded = expandedProfileId === p.id;
                  const draft =
                    editingProfile?.id === p.id ? editingProfile : p;
                  const roleLabel =
                    p.role === "admin"
                      ? "Admin"
                      : p.role === "tablet"
                        ? "Väggplatta"
                        : "Familjemedlem";

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpandProfile(p)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#6B8E6B]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                          )}
                          <AvatarBadge
                            avatarUrl={p.avatar_url}
                            avatarIcon={p.avatar_icon}
                            displayName={p.display_name}
                            sizeClass="h-9 w-9"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-serif text-sm font-semibold text-[var(--text-primary)]">
                                {p.display_name || "Namnlös profil"}
                              </p>
                              <span className="rounded-md bg-[#6B8E6B]/15 px-2 py-0.5 text-[11px] font-medium text-[#6B8E6B]">
                                {roleLabel}
                              </span>
                              {p.quick_pin && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#D49A42]/15 px-2 py-0.5 text-[11px] font-medium text-[#D49A42]">
                                  <KeyRound className="h-3 w-3" /> PIN
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-[var(--text-secondary)]">
                              {p.email ? `${p.email} · ` : ""}
                              {(p.allowed_room_ids ?? []).length} rum ·{" "}
                              {(p.allowed_widget_ids ?? []).length} widgets
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleExpandProfile(p)}
                            aria-label="Anpassa profil"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!p.email && (
                            <button
                              type="button"
                              onClick={() => handleDeleteProfile(p.id)}
                              aria-label="Ta bort profil"
                              className="rounded-lg p-2 text-[#C86D51] hover:bg-[#C86D51]/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && editingProfile?.id === p.id && (
                        <form
                          onSubmit={handleSaveProfile}
                          className="space-y-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                Namn
                              </label>
                              <input
                                type="text"
                                required
                                value={draft.display_name ?? ""}
                                onChange={(e) =>
                                  setEditingProfile({
                                    ...draft,
                                    display_name: e.target.value,
                                  })
                                }
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                Typ / Roll
                              </label>
                              <select
                                value={draft.role}
                                onChange={(e) =>
                                  setEditingProfile({
                                    ...draft,
                                    role: e.target.value as ProfileRole,
                                  })
                                }
                                className={inputClass}
                              >
                                {ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                Snabb-PIN (4 siffror)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                value={draft.quick_pin ?? ""}
                                onChange={(e) =>
                                  setEditingProfile({
                                    ...draft,
                                    quick_pin: e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 4),
                                  })
                                }
                                placeholder="Valfri PIN"
                                className={`${inputClass} font-mono tracking-widest`}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                                Startvåning
                              </label>
                              <select
                                value={draft.default_floor_id ?? ""}
                                onChange={(e) =>
                                  setEditingProfile({
                                    ...draft,
                                    default_floor_id: e.target.value || null,
                                  })
                                }
                                className={inputClass}
                              >
                                <option value="">Alla våningar</option>
                                {data.floors.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <IconPicker
                            value={draft.avatar_icon ?? "room_living"}
                            onChange={(icon) =>
                              setEditingProfile({
                                ...draft,
                                avatar_icon: icon,
                              })
                            }
                            label="Ikon / Avatar"
                          />

                          {/* Module visibility toggles */}
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                              Moduler på startsidan
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]">
                                <input
                                  type="checkbox"
                                  checked={draft.show_energy}
                                  onChange={(e) =>
                                    setEditingProfile({
                                      ...draft,
                                      show_energy: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[#6B8E6B]"
                                />
                                <span>Energimätare &amp; Översikt</span>
                              </label>
                              <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]">
                                <input
                                  type="checkbox"
                                  checked={draft.show_scenes}
                                  onChange={(e) =>
                                    setEditingProfile({
                                      ...draft,
                                      show_scenes: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[#6B8E6B]"
                                />
                                <span>Snabbscener</span>
                              </label>
                              <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]">
                                <input
                                  type="checkbox"
                                  checked={draft.show_family_board}
                                  onChange={(e) =>
                                    setEditingProfile({
                                      ...draft,
                                      show_family_board: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[#6B8E6B]"
                                />
                                <span>Familjens anslagstavla</span>
                              </label>
                            </div>
                          </div>

                          {/* Allowed rooms */}
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                              Tillåtna rum ({(draft.allowed_room_ids ?? []).length}{" "}
                              valda)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {data.rooms.map((r) => {
                                const checked = (
                                  draft.allowed_room_ids ?? []
                                ).includes(r.id);
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() =>
                                      toggleEditingProfileArray(
                                        "allowed_room_ids",
                                        r.id,
                                      )
                                    }
                                    className={`min-h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                                      checked
                                        ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[var(--text-primary)]"
                                        : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                                    }`}
                                  >
                                    {r.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Allowed widgets */}
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                              Tillåtna översikts-widgets (
                              {(draft.allowed_widget_ids ?? []).length} valda)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {data.dashboardWidgets.map((w) => {
                                const checked = (
                                  draft.allowed_widget_ids ?? []
                                ).includes(w.id);
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() =>
                                      toggleEditingProfileArray(
                                        "allowed_widget_ids",
                                        w.id,
                                      )
                                    }
                                    className={`min-h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                                      checked
                                        ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[var(--text-primary)]"
                                        : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                                    }`}
                                  >
                                    {w.title}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedProfileId(null);
                                setEditingProfile(null);
                              }}
                              className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-medium text-[var(--text-secondary)]"
                            >
                              Stäng
                            </button>
                            <button
                              type="submit"
                              disabled={busy}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#6B8E6B] px-5 text-xs font-semibold text-white hover:bg-[#5B7D5B]"
                            >
                              <Check className="h-3.5 w-3.5" /> Spara profil
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-3 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#6B8E6B]" />
            {data.properties.length} hus · {data.floors.length} våningar ·{" "}
            {data.rooms.length} rum · {data.roomDevices.length} enheter
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-primary)]"
          >
            Klar
          </button>
        </div>
      </div>
    </div>
  );
}
