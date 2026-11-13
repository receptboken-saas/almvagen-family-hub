"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  HomeDataState,
  Profile,
  WidgetCategory,
  WidgetType,
} from "@/lib/supabase/types";
import { HAEntityPicker } from "@/components/admin/HAEntityPicker";
import { IconPicker } from "@/components/admin/IconPicker";

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

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Property & Floor forms
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [floorPropId, setFloorPropId] = useState(activePropertyId ?? "");
  const [floorName, setFloorName] = useState("");

  // Room form
  const [roomFloorId, setRoomFloorId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomIcon, setRoomIcon] = useState("room_vardagsrum");
  const [roomCommon, setRoomCommon] = useState(true);

  // Device form
  const [deviceRoomId, setDeviceRoomId] = useState("");
  const [deviceEntityId, setDeviceEntityId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<WidgetType>("light");

  // Dashboard widget form
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

  async function runMutation(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setFeedback(null);
    const { error } = await action();
    if (error) {
      setFeedback(`Fel: ${error.message}`);
    } else {
      await onDataChanged();
    }
    setBusy(false);
  }

  async function handleAddProperty(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !propName.trim()) return;
    await runMutation(() =>
      supabase.from("properties").insert({
        name: propName.trim(),
        address: propAddress.trim() || null,
        sort_order: data.properties.length,
      }),
    );
    setPropName("");
    setPropAddress("");
  }

  async function handleAddFloor(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !floorPropId || !floorName.trim()) return;
    await runMutation(() =>
      supabase.from("floors").insert({
        property_id: floorPropId,
        name: floorName.trim(),
        icon: "layers",
        sort_order: data.floors.length,
      }),
    );
    setFloorName("");
  }

  async function handleAddRoom(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !roomFloorId || !roomName.trim()) return;
    await runMutation(() =>
      supabase.from("rooms").insert({
        floor_id: roomFloorId,
        name: roomName.trim(),
        icon: roomIcon,
        is_common_area: roomCommon,
        sort_order: data.rooms.length,
      }),
    );
    setRoomName("");
  }

  async function handleAddDevice(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !deviceRoomId || !deviceEntityId.trim() || !deviceName.trim()) {
      return;
    }
    await runMutation(() =>
      supabase.from("room_devices").insert({
        room_id: deviceRoomId,
        ha_entity_id: deviceEntityId.trim(),
        display_name: deviceName.trim(),
        widget_type: deviceType,
        sort_order: data.roomDevices.length,
      }),
    );
    setDeviceEntityId("");
    setDeviceName("");
  }

  async function handleAddWidget(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !widgetPropId || !widgetEntityId.trim() || !widgetTitle.trim()) {
      return;
    }
    await runMutation(() =>
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
    setWidgetEntityId("");
    setWidgetTitle("");
    setWidgetSubtitle("");
    setWidgetUnit("");
  }

  async function saveRename(table: string, id: string, field = "name") {
    const supabase = getSupabaseClient();
    if (!supabase || !editingText.trim()) return;
    await runMutation(() =>
      supabase.from(table).update({ [field]: editingText.trim() }).eq("id", id),
    );
    setEditingId(null);
    setEditingText("");
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
      supabase.from("rooms").update({ is_common_area: !current }).eq("id", roomId),
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="admin-modal-title" className="text-lg font-semibold text-slate-100">
              Redigera hemmet (Admin)
            </h2>
            <p className="text-xs text-slate-400">
              Hantera hus, våningar, rum, HA-enheter, widgets och familjebehörigheter.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-100"
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
                  setEditingId(null);
                  setFeedback(null);
                }}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-sky-500 text-slate-950"
                    : "bg-slate-950/60 text-slate-300 hover:bg-slate-800"
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
                <form onSubmit={handleAddProperty} className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <input
                    type="text"
                    required
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    placeholder="Husets namn (t.ex. Almvägen 1)"
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
                    placeholder="Adress (valfritt)"
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till hus
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.properties.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-2.5">
                      {editingId === p.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100"
                          />
                          <button type="button" onClick={() => saveRename("properties", p.id)} className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">{p.name}</p>
                            {p.address && <p className="truncate text-xs text-slate-500">{p.address}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setEditingId(p.id); setEditingText(p.name); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow("properties", p.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
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
                <form onSubmit={handleAddFloor} className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <select
                    value={floorPropId}
                    onChange={(e) => setFloorPropId(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    {data.properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={floorName}
                    onChange={(e) => setFloorName(e.target.value)}
                    placeholder="Våningsnamn (t.ex. Entréplan)"
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || data.properties.length === 0}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Lägg till våning
                  </button>
                </form>

                <ul className="space-y-2">
                  {data.floors.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-2.5">
                      {editingId === f.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100"
                          />
                          <button type="button" onClick={() => saveRename("floors", f.id)} className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate text-sm font-medium text-slate-100">{f.name}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setEditingId(f.id); setEditingText(f.name); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow("floors", f.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "rooms" && (
            <div className="space-y-5">
              <form onSubmit={handleAddRoom} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
                <select
                  value={roomFloorId}
                  onChange={(e) => setRoomFloorId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  {data.floors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Rumnamn (t.ex. Vardagsrum)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={roomCommon}
                    onChange={(e) => setRoomCommon(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
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
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till rum
                </button>
              </form>

              <ul className="space-y-2">
                {data.rooms.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5">
                    {editingId === r.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100"
                        />
                        <button type="button" onClick={() => saveRename("rooms", r.id)} className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-100">{r.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleCommonArea(r.id, r.is_common_area)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                              r.is_common_area
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {r.is_common_area ? "Väggplatta: Ja" : "Väggplatta: Nej"}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => { setEditingId(r.id); setEditingText(r.name); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => deleteRow("rooms", r.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "devices" && (
            <div className="space-y-5">
              <form onSubmit={handleAddDevice} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
                <select
                  value={deviceRoomId}
                  onChange={(e) => setDeviceRoomId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as WidgetType)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  {WIDGET_TYPES.map((wt) => (
                    <option key={wt} value={wt}>Typ: {wt}</option>
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
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 sm:col-span-2"
                />
                <button
                  type="submit"
                  disabled={busy || data.rooms.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till enhet i rum
                </button>
              </form>

              <ul className="space-y-2">
                {data.roomDevices
                  .filter((d) => !deviceRoomId || d.room_id === deviceRoomId)
                  .map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5">
                      {editingId === d.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100"
                          />
                          <button type="button" onClick={() => saveRename("room_devices", d.id, "display_name")} className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">{d.display_name}</p>
                            <p className="truncate font-mono text-xs text-slate-500">
                              {d.ha_entity_id} · {d.widget_type}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setEditingId(d.id); setEditingText(d.display_name); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow("room_devices", d.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {tab === "widgets" && (
            <div className="space-y-5">
              <form onSubmit={handleAddWidget} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
                <select
                  value={widgetPropId}
                  onChange={(e) => setWidgetPropId(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  {data.properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={widgetCategory}
                  onChange={(e) => setWidgetCategory(e.target.value as WidgetCategory)}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  {WIDGET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>Kategori: {c}</option>
                  ))}
                </select>
                <div className="sm:col-span-2">
                  <HAEntityPicker
                    value={widgetEntityId}
                    placeholder="Sök HA-entitet (t.ex. sensor.tibber_pulse_power)"
                    onChange={(entityId, friendlyName, unit) => {
                      setWidgetEntityId(entityId);
                      if (friendlyName && !widgetTitle) setWidgetTitle(friendlyName);
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
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={widgetSubtitle}
                  onChange={(e) => setWidgetSubtitle(e.target.value)}
                  placeholder="Underrubrik (t.ex. Realtidseffekt)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={widgetUnit}
                  onChange={(e) => setWidgetUnit(e.target.value)}
                  placeholder="Enhet (t.ex. W, °C, öre/kWh)"
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <div className="sm:col-span-2">
                  <IconPicker
                    value={widgetIcon}
                    onChange={setWidgetIcon}
                    label="Välj widget-ikon"
                  />
                </div>
                <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={widgetAdminOnly}
                    onChange={(e) => setWidgetAdminOnly(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  <span>Endast synlig för admin</span>
                </label>
                <button
                  type="submit"
                  disabled={busy || data.properties.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Lägg till översikts-widget
                </button>
              </form>

              <ul className="space-y-2">
                {data.dashboardWidgets.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5">
                    {editingId === w.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100"
                        />
                        <button type="button" onClick={() => saveRename("dashboard_widgets", w.id, "title")} className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {w.title} {w.admin_only && <span className="text-xs text-amber-400">(Admin)</span>}
                          </p>
                          <p className="truncate font-mono text-xs text-slate-500">
                            {w.ha_entity_id} · {w.widget_category}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => { setEditingId(w.id); setEditingText(w.title); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => deleteRow("dashboard_widgets", w.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "family" && (
            <div className="space-y-4">
              {profiles.length === 0 ? (
                <p className="text-sm text-slate-400">Inga profiler hittades.</p>
              ) : (
                profiles.map((prof) => {
                  const allowed = prof.allowed_room_ids ?? [];
                  return (
                    <div
                      key={prof.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
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
                          <span className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
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
                                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAllowedRoom(prof, room.id)}
                                  className="h-4 w-4 accent-sky-500"
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
