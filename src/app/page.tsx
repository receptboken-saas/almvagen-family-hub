"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Home,
  Layers,
  Loader2,
  LogOut,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/useAuth";
import { useHomeData } from "@/lib/supabase/useHomeData";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EnergyOverview } from "@/components/energy/EnergyOverview";
import { EnergyGauge } from "@/components/energy/EnergyGauge";
import { QuickScenes } from "@/components/energy/QuickScenes";
import { RoomCard } from "@/components/rooms/RoomCard";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";

export default function HomePage() {
  const { user, profile, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const {
    data,
    isLoading: dataLoading,
    error: dataError,
    refetch,
  } = useHomeData(user?.id);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    if (
      data.properties.length > 0 &&
      (!selectedPropertyId ||
        !data.properties.some((p) => p.id === selectedPropertyId))
    ) {
      setSelectedPropertyId(data.properties[0].id);
      setSelectedFloorId("all");
    }
  }, [data.properties, selectedPropertyId]);

  const activeProperty = useMemo(
    () => data.properties.find((p) => p.id === selectedPropertyId) ?? null,
    [data.properties, selectedPropertyId],
  );

  const propertyFloors = useMemo(
    () => data.floors.filter((f) => f.property_id === activeProperty?.id),
    [data.floors, activeProperty?.id],
  );

  const floorNameById = useMemo(
    () => new Map(propertyFloors.map((f) => [f.id, f.name])),
    [propertyFloors],
  );

  const visibleRooms = useMemo(() => {
    const floorIds = new Set(propertyFloors.map((f) => f.id));
    return data.rooms.filter((r) => {
      if (!floorIds.has(r.floor_id)) return false;
      if (selectedFloorId !== "all" && r.floor_id !== selectedFloorId) {
        return false;
      }
      return true;
    });
  }, [data.rooms, propertyFloors, selectedFloorId]);

  const propertyWidgets = useMemo(
    () =>
      data.dashboardWidgets.filter(
        (w) => w.property_id === activeProperty?.id,
      ),
    [data.dashboardWidgets, activeProperty?.id],
  );

  const hasEnergyGaugeWidget = useMemo(
    () =>
      propertyWidgets.some(
        (w) => w.widget_category === "energy" && (isAdmin || !w.admin_only),
      ),
    [propertyWidgets, isAdmin],
  );

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F17] text-slate-300">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#38BDF8]" />
          <span>Laddar familjehubben…</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-7 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/15 text-[#38BDF8] ring-1 ring-[#38BDF8]/30">
            <Home className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              {activeProperty?.name ?? "Almvägen Family Hub"}
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Inloggad som{" "}
              <span className="font-medium text-slate-200">
                {profile?.display_name || user.email}
              </span>
              {profile?.role && (
                <span className="ml-2 rounded-md bg-[#131A26] px-2 py-0.5 text-xs uppercase tracking-wider text-slate-300 ring-1 ring-slate-800">
                  {profile.role}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data.properties.length > 1 && (
            <select
              aria-label="Välj hus"
              value={selectedPropertyId ?? ""}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                setSelectedFloorId("all");
              }}
              className="min-h-11 rounded-full border border-slate-800 bg-[#131A26] px-4 text-sm font-medium text-slate-200 focus:border-[#38BDF8] focus:outline-none"
            >
              {data.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#38BDF8]/40 bg-[#38BDF8]/15 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-[#38BDF8]/25"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              <span>Redigera hemmet</span>
            </button>
          )}

          <StatusBadge />

          <button
            type="button"
            onClick={signOut}
            title="Logga ut"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-800 bg-[#131A26] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </header>

      {dataError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Kunde inte hämta data från Supabase: {dataError}
        </div>
      )}

      {dataLoading ? (
        <div className="flex items-center gap-3 py-12 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-[#38BDF8]" />
          <span>Hämtar rum och enheter…</span>
        </div>
      ) : data.properties.length === 0 ? (
        <Card className="mx-auto my-8 flex max-w-lg flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#38BDF8]/15 text-[#38BDF8]">
            <Home className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">
            Välkommen till Almvägen Family Hub
          </h2>
          <p className="text-sm text-slate-400">
            {isAdmin
              ? "Databasen är tom ännu. Skapa ditt första hus, våningar, rum och koppla Home Assistant-entiteter."
              : "Inga hus eller rum har delats med ditt konto ännu. Kontakta familjens administratör."}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#38BDF8] px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300"
            >
              <Plus className="h-4 w-4" />
              <span>Skapa ditt första hus</span>
            </button>
          )}
        </Card>
      ) : (
        <>
          <section aria-labelledby="energy-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="energy-heading"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Översikt &amp; Energi
              </h2>
              <span className="text-xs text-slate-500">
                Realtidsdata via HA
              </span>
            </div>

            <div
              className={`grid grid-cols-1 gap-4 ${
                hasEnergyGaugeWidget ? "lg:grid-cols-12" : ""
              }`}
            >
              {hasEnergyGaugeWidget && (
                <div className="lg:col-span-4">
                  <EnergyGauge widgets={propertyWidgets} isAdmin={isAdmin} />
                </div>
              )}
              <div className={hasEnergyGaugeWidget ? "lg:col-span-8" : ""}>
                <EnergyOverview widgets={propertyWidgets} isAdmin={isAdmin} />
              </div>
            </div>
          </section>

          <QuickScenes widgets={propertyWidgets} isAdmin={isAdmin} />

          <section aria-labelledby="rooms-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="rooms-heading"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Rum &amp; Enheter
              </h2>
              <span className="text-xs text-slate-500">
                {visibleRooms.length} {visibleRooms.length === 1 ? "rum" : "rum"}
              </span>
            </div>

            {/* Mobile horizontal pill navigation */}
            {propertyFloors.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedFloorId("all")}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    selectedFloorId === "all"
                      ? "bg-[#38BDF8] text-slate-950"
                      : "border border-slate-800 bg-[#131A26] text-slate-300"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Alla våningar</span>
                </button>
                {propertyFloors.map((floor) => (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                      selectedFloorId === floor.id
                        ? "bg-[#38BDF8] text-slate-950"
                        : "border border-slate-800 bg-[#131A26] text-slate-300"
                    }`}
                  >
                    <DynamicIcon name={floor.icon ?? "layers"} className="h-4 w-4" />
                    <span>{floor.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Wall Tablet / Desktop left floor rail */}
              {propertyFloors.length > 0 && (
                <aside className="hidden w-56 shrink-0 flex-col gap-2 rounded-2xl border border-slate-800/80 bg-[#131A26] p-3 lg:flex">
                  <button
                    type="button"
                    onClick={() => setSelectedFloorId("all")}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      selectedFloorId === "all"
                        ? "bg-[#38BDF8]/15 text-[#38BDF8] ring-1 ring-[#38BDF8]/40"
                        : "text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="truncate">Alla våningar</span>
                  </button>
                  {propertyFloors.map((floor) => (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => setSelectedFloorId(floor.id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                        selectedFloorId === floor.id
                          ? "bg-[#38BDF8]/15 text-[#38BDF8] ring-1 ring-[#38BDF8]/40"
                          : "text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <DynamicIcon
                        name={floor.icon ?? "layers"}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="truncate">{floor.name}</span>
                    </button>
                  ))}
                </aside>
              )}

              <div className="min-w-0 flex-1">
                {visibleRooms.length === 0 ? (
                  <Card className="border-dashed border-slate-800 bg-[#131A26]/50 text-center text-sm text-slate-400">
                    Inga rum att visa här ännu.
                    {isAdmin &&
                      " Öppna 'Redigera hemmet' för att lägga till våningar och rum."}
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        floorName={floorNameById.get(room.floor_id)}
                        devices={data.roomDevices.filter(
                          (d) => d.room_id === room.id,
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-6 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <span>Home Assistant WebSocket &amp; Supabase RLS</span>
        </span>
        <span>Cloudflare Static Export</span>
      </footer>

      {isAdmin && (
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          data={data}
          activePropertyId={selectedPropertyId}
          onDataChanged={refetch}
        />
      )}
    </main>
  );
}
