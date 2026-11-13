"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  Building2,
  DoorOpen,
  Cpu,
  LayoutGrid,
  Users,
  Pencil,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  DashboardWidget,
  Floor,
  HomeDataState,
  Profile,
  Room,
  RoomDevice,
  WidgetCategory,
  WidgetType,
} from "@/lib/supabase/types";
import { HAEntityPicker } from "@/components/admin/HAEntityPicker";
import { IconPicker } from "@/components/admin/IconPicker";
import { DynamicIcon } from "@/components/ui/IconResolver";

type AdminTab = "properties" | "rooms" | "devices" | "widgets" | "family";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: HomeDataState;
  activePropertyId: string | null;
  onDataChanged: () => Promise<void>;
}

const TABS: { id: AdminTab; label: string; icon: typeof Building2 }[] = [
  { id: "properties", label: "Hus & Våningar", icon: Building2 },
  { id: "rooms", label: "Rum", icon: DoorOpen },
  { id: "devices", label: "Enheter", icon: Cpu },
  { id: "widgets", label: "Widgets", icon: LayoutGrid },
  { id: "family", label: "Familj", icon: Users },
];

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

export function AdminPanel({
  isOpen,
  onClose,
  data,
  activePropertyId,
  onDataChanged,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("properties");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Property rename state
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [editingPropName, setEditingPropName] = useState("");

  // Full edit states
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingDevice, setEditingDevice] = useState<RoomDevice | null>(null);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
    null,
  );

  // Property & Floor create forms
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [floorPropId, setFloorPropId] = useState(activePropertyId ?? "");
  const [floorName, setFloorName] = useState("");
  const [floorIcon, setFloorIcon] = useState("layers");

  // Room create form
  const [roomFloorId, setRoomFloorId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomIcon, setRoomIcon] = useState("room_vardagsrum");
  const [roomCommon, setRoomCommon] = useState(true);

  // Device create form
  const [deviceRoomId, setDeviceRoomId] = useState("");
  const [deviceEntityId, setDeviceEntityId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<WidgetType>("light");

  // Dashboard widget create form
  const [widgetPropId, setWidgetPropId] = useState(activePropertyId ?? "");
  const [widgetEntityId, setWidgetEntityId] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetSubtitle, setWidgetSubtitle] = useState("");
  const [widgetUnit, setWidgetUnit] = useState("");
  const [widgetIcon, setWidgetIcon] = useState("sys_tibber_pulse");
  const [widgetCategory, setWidgetCategory] =
    useState<WidgetCategory>("energy");
  const [widgetAdminOnly, setWidgetAdminOnly] = useState(false);

  // Family profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const floorNameMap = useMemo(
    () => new Map(data.floors.map((f) => [f.id, f.name])),
    [data.floors],
  );
  const roomNameMap = useMemo(
    () => new Map(data.rooms.map((r) => [r.id, r.name])),
    [data.rooms],
  );

  useEffect(() => {
    if (activePropertyId) {
      setFloorPropId((prev) => prev || activePropertyId);
      setWidgetPropId((prev) => prev || activePropertyId);
    } else if (data.properties[0]?.id) {
      setFloorPropId((prev) => prev || data.properties[0].id);
      setWidgetPropId((prev) => prev || data.properties[0].id);
    }
    if (data.floors[0]?.id) {
      setRoomFloorId((prev) => prev || data.floors[0].id);
    }
    if (data.rooms[0]?.id) {
      setDeviceRoomId((prev) => prev || data.rooms[0].id);
    }
  }, [activePropertyId, data.properties, data.floors, data.rooms]);

  const loadProfiles = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: rows } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role, allowed_room_ids")
      .order("display_name", { ascending: true });
    if (rows) {
      setProfiles(rows as Profile[]);
    }
  }, []);

  useEffect(() => {
    if (isOpen && tab === "family") {
      loadProfiles();
    }
  }, [isOpen, tab, loadProfiles]);

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

  async function deleteRow(table: string, id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await runMutation(() => supabase.from(table).delete().eq("id", id));
  }

  async function toggleCommonArea(roomId: string, current: boolean) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await runMutation(() =>
      supabase
        .from("rooms")
        .update({ is_common_area: !current })
        .eq("id", roomId),
    );
  }

  async function toggleAllowedRoom(profile: Profile, roomId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const current = profile.allowed_room_ids ?? [];
    const next = current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId];

    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id ? { ...p, allowed_room_ids: next } : p,
      ),
    );

    const { error } = await supabase
      .from("profiles")
      .update({ allowed_room_ids: next })
      .eq("id", profile.id);

    if (error) {
      setFeedback(`Kunde inte spara behörighet: ${error.message}`);
      await loadProfiles();
    }
  }

  const filteredDevices = data.roomDevices.filter(
    (d) => !deviceRoomId || d.room_id === deviceRoomId,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-[#131A26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2
              id="admin-modal-title"
              className="text-lg font-semibold text-slate-100"
            >
              Redigera hemmet (Admin)
            </h2>
            <p className="text-xs text-slate-400">
              Skapa, redigera, flytta, sortera och hantera familjebehörigheter.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-[#0B0F17] text-slate-400 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto border-b border-slate-800 px-6 py-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setEditingPropId(null);
                  setEditingFloor(null);
                  setEditingRoom(null);
                  setEditingDevice(null);
                  setEditingWidget(null);
                  setFeedback(null);
                }}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#38BDF8] text-slate-950"
                    : "bg-[#0B0F17] text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {feedback && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            {feedback}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "properties" && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Hus ({data.properties.length})
                </h3>
                <form
                  onSubmit={handleAddProperty}
                  className="space-y-2.5 rounded-2xl border border-slate-800 bg-[#0B0F17]/70 p-4"
                >
                  <input
                    type="text"
                    required
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    placeholder="Husets namn (t.ex. Almvägen 1)"
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100 focus:border-[#38BDF8] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
                    placeholder="Adress (valfritt)"
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100 focus:border-[#38BDF8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#38BDF8] px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till hus
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.properties.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0B0F17]/50 px-3.5 py-2.5"
                    >
                      {editingPropId === p.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editingPropName}
                            onChange={(e) => setEditingPropName(e.target.value)}
                            className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-2.5 text-sm text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePropertyName(p.id)}
                            className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPropId(null)}
                            className="rounded-lg bg-slate-800 p-2 text-slate-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {p.name}
                            </p>
                            {p.address && (
                              <p className="truncate text-xs text-slate-500">
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
                              className="rounded-lg p-2 text-slate-400 hover:text-slate-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow("properties", p.id)}
                              className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
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
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Våningar ({data.floors.length})
                </h3>
                <form
                  onSubmit={handleAddFloor}
                  className="space-y-3 rounded-2xl border border-slate-800 bg-[#0B0F17]/70 p-4"
                >
                  <select
                    value={floorPropId}
                    onChange={(e) => setFloorPropId(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100 focus:border-[#38BDF8] focus:outline-none"
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
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#38BDF8] px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till våning
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.floors.map((f, idx) => (
                    <li
                      key={f.id}
                      className="rounded-xl border border-slate-800 bg-[#0B0F17]/50 px-3.5 py-2.5"
                    >
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
                            className="min-h-10 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
                          />
                          <IconPicker
                            value={editingFloor.icon ?? "layers"}
                            onChange={(icon) =>
                              setEditingFloor({ ...editingFloor, icon })
                            }
                            filterGroups={["Rum & Ytor"]}
                            label="Ikon"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingFloor(null)}
                              className="min-h-9 rounded-lg bg-slate-800 px-3 text-xs text-slate-300"
                            >
                              Avbryt
                            </button>
                            <button
                              type="submit"
                              disabled={busy}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#22C55E] px-3 text-xs font-semibold text-slate-950"
                            >
                              <Check className="h-3.5 w-3.5" /> Spara
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <DynamicIcon
                              name={f.icon ?? "layers"}
                              className="h-4 w-4 shrink-0 text-[#38BDF8]"
                            />
                            <span className="truncate text-sm font-medium text-slate-100">
                              {f.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={busy || idx === 0}
                              onClick={() =>
                                moveSortOrder("floors", data.floors, idx, -1)
                              }
                              aria-label="Flytta upp"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30"
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
                              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFloor(f)}
                              aria-label="Redigera våning"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow("floors", f.id)}
                              aria-label="Ta bort våning"
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
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

          {tab === "rooms" && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddRoom}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-[#0B0F17]/70 p-4 sm:grid-cols-2"
              >
                <select
                  value={roomFloorId}
                  onChange={(e) => setRoomFloorId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
                >
                  {data.floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Rumnamn (t.ex. Vardagsrum)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
                />
                <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-200 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={roomCommon}
                    onChange={(e) => setRoomCommon(e.target.checked)}
                    className="h-4 w-4 accent-[#38BDF8]"
                  />
                  <span>Gemensamt utrymme (visas på väggplatta)</span>
                </label>
                <div className="sm:col-span-2">
                  <IconPicker
                    value={roomIcon}
                    onChange={setRoomIcon}
                    filterGroups={["Rum & Ytor", "Klimat & Styrning"]}
                    label="Välj rumsikon"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || data.floors.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#38BDF8] px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till rum
                </button>
              </form>

              <ul className="space-y-2.5">
                {data.rooms.map((r, idx) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-800 bg-[#0B0F17]/50 px-4 py-3"
                  >
                    {editingRoom?.id === r.id ? (
                      <form onSubmit={handleSaveRoom} className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-400">
                            Rumsnamn
                          </label>
                          <input
                            type="text"
                            required
                            value={editingRoom.name}
                            onChange={(e) =>
                              setEditingRoom({
                                ...editingRoom,
                                name: e.target.value,
                              })
                            }
                            className="min-h-10 w-full rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-400">
                            Våning / Zon
                          </label>
                          <select
                            value={editingRoom.floor_id}
                            onChange={(e) =>
                              setEditingRoom({
                                ...editingRoom,
                                floor_id: e.target.value,
                              })
                            }
                            className="min-h-10 w-full rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
                          >
                            {data.floors.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-200 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={editingRoom.is_common_area}
                            onChange={(e) =>
                              setEditingRoom({
                                ...editingRoom,
                                is_common_area: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-[#38BDF8]"
                          />
                          <span>Gemensamt utrymme (visas på väggplatta)</span>
                        </label>
                        <div className="sm:col-span-2">
                          <IconPicker
                            value={editingRoom.icon ?? "room_vardagsrum"}
                            onChange={(icon) =>
                              setEditingRoom({ ...editingRoom, icon })
                            }
                            filterGroups={["Rum & Ytor", "Klimat & Styrning"]}
                            label="Rumsikon"
                          />
                        </div>
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingRoom(null)}
                            className="min-h-10 rounded-xl bg-slate-800 px-4 text-xs font-medium text-slate-300"
                          >
                            Avbryt
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#22C55E] px-4 text-xs font-semibold text-slate-950"
                          >
                            <Check className="h-4 w-4" /> Spara rum
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <DynamicIcon
                            name={r.icon}
                            className="h-4 w-4 shrink-0 text-[#38BDF8]"
                          />
                          <span className="text-sm font-medium text-slate-100">
                            {r.name}
                          </span>
                          <span className="rounded-lg bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-[#38BDF8]">
                            {floorNameMap.get(r.floor_id) ?? "Okänd våning"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              toggleCommonArea(r.id, r.is_common_area)
                            }
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                              r.is_common_area
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {r.is_common_area
                              ? "Väggplatta: Ja"
                              : "Väggplatta: Nej"}
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={busy || idx === 0}
                            onClick={() =>
                              moveSortOrder("rooms", data.rooms, idx, -1)
                            }
                            aria-label="Flytta upp"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || idx === data.rooms.length - 1}
                            onClick={() =>
                              moveSortOrder("rooms", data.rooms, idx, 1)
                            }
                            aria-label="Flytta ner"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRoom(r)}
                            aria-label="Redigera rum"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow("rooms", r.id)}
                            aria-label="Ta bort rum"
                            className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
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

          {tab === "devices" && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddDevice}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-[#0B0F17]/70 p-4 sm:grid-cols-2"
              >
                <select
                  value={deviceRoomId}
                  onChange={(e) => setDeviceRoomId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
                >
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as WidgetType)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100 sm:col-span-2"
                />
                <button
                  type="submit"
                  disabled={busy || data.rooms.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#38BDF8] px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till enhet i rum
                </button>
              </form>

              <ul className="space-y-2">
                {filteredDevices.map((d, idx) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-slate-800 bg-[#0B0F17]/50 px-4 py-3"
                  >
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100 sm:col-span-2"
                        />
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingDevice(null)}
                            className="min-h-10 rounded-xl bg-slate-800 px-4 text-xs font-medium text-slate-300"
                          >
                            Avbryt
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#22C55E] px-4 text-xs font-semibold text-slate-950"
                          >
                            <Check className="h-4 w-4" /> Spara enhet
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {d.display_name}
                            </p>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-[#38BDF8]">
                              {roomNameMap.get(d.room_id) ?? "Okänt rum"}
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-slate-500">
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
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || idx === filteredDevices.length - 1}
                            onClick={() =>
                              moveSortOrder(
                                "room_devices",
                                filteredDevices,
                                idx,
                                1,
                              )
                            }
                            aria-label="Flytta ner"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDevice(d)}
                            aria-label="Redigera enhet"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow("room_devices", d.id)}
                            aria-label="Ta bort enhet"
                            className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
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

          {tab === "widgets" && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddWidget}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-[#0B0F17]/70 p-4 sm:grid-cols-2"
              >
                <select
                  value={widgetPropId}
                  onChange={(e) => setWidgetPropId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={widgetSubtitle}
                  onChange={(e) => setWidgetSubtitle(e.target.value)}
                  placeholder="Underrubrik (t.ex. Realtidseffekt)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={widgetUnit}
                  onChange={(e) => setWidgetUnit(e.target.value)}
                  placeholder="Enhet (t.ex. W, °C, öre/kWh)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-100 sm:col-span-2"
                />
                <div className="sm:col-span-2">
                  <IconPicker
                    value={widgetIcon}
                    onChange={setWidgetIcon}
                    label="Välj widget-ikon"
                  />
                </div>
                <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-200 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={widgetAdminOnly}
                    onChange={(e) => setWidgetAdminOnly(e.target.checked)}
                    className="h-4 w-4 accent-[#38BDF8]"
                  />
                  <span>Endast synlig för admin</span>
                </label>
                <button
                  type="submit"
                  disabled={busy || data.properties.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#38BDF8] px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till översikts-widget
                </button>
              </form>

              <ul className="space-y-2.5">
                {data.dashboardWidgets.map((w, idx) => (
                  <li
                    key={w.id}
                    className="rounded-xl border border-slate-800 bg-[#0B0F17]/50 px-4 py-3"
                  >
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
                        />
                        <select
                          value={editingWidget.widget_category}
                          onChange={(e) =>
                            setEditingWidget({
                              ...editingWidget,
                              widget_category: e.target.value as WidgetCategory,
                            })
                          }
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                          className="min-h-10 rounded-xl border border-slate-700 bg-[#0B0F17] px-3 text-sm text-slate-100"
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
                        <label className="flex min-h-10 items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] px-3 text-sm text-slate-200 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={editingWidget.admin_only}
                            onChange={(e) =>
                              setEditingWidget({
                                ...editingWidget,
                                admin_only: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-[#38BDF8]"
                          />
                          <span>Endast synlig för admin</span>
                        </label>
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingWidget(null)}
                            className="min-h-10 rounded-xl bg-slate-800 px-4 text-xs font-medium text-slate-300"
                          >
                            Avbryt
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#22C55E] px-4 text-xs font-semibold text-slate-950"
                          >
                            <Check className="h-4 w-4" /> Spara widget
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <DynamicIcon
                            name={w.icon}
                            className="h-4 w-4 shrink-0 text-[#38BDF8]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {w.title}{" "}
                              {w.admin_only && (
                                <span className="text-xs text-amber-400">
                                  (Admin)
                                </span>
                              )}
                            </p>
                            <p className="truncate font-mono text-xs text-slate-500">
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
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
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
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWidget(w)}
                            aria-label="Redigera widget"
                            className="rounded-lg p-2 text-slate-400 hover:text-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow("dashboard_widgets", w.id)}
                            aria-label="Ta bort widget"
                            className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
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

          {tab === "family" && (
            <div className="space-y-4">
              {profiles.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Inga profiler hittades.
                </p>
              ) : (
                profiles.map((prof) => {
                  const allowed = prof.allowed_room_ids ?? [];
                  return (
                    <div
                      key={prof.id}
                      className="rounded-2xl border border-slate-800 bg-[#0B0F17]/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-100">
                            {prof.display_name || prof.id}
                          </p>
                          <p className="text-xs uppercase tracking-wider text-slate-400">
                            Roll: {prof.role}
                          </p>
                        </div>
                        {prof.role === "admin" && (
                          <span className="rounded-lg bg-[#38BDF8]/15 px-2.5 py-1 text-xs font-medium text-[#38BDF8]">
                            Full åtkomst
                          </span>
                        )}
                      </div>

                      {prof.role !== "admin" && (
                        <div className="mt-3 grid gap-2 border-t border-slate-800/80 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                          {data.rooms.map((room) => {
                            const checked = allowed.includes(room.id);
                            return (
                              <label
                                key={room.id}
                                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-[#131A26] px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleAllowedRoom(prof, room.id)
                                  }
                                  className="h-4 w-4 accent-[#38BDF8]"
                                />
                                <span className="truncate">{room.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
