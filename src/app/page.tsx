"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Home,
  KeyRound,
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
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { EnergyOverview } from "@/components/energy/EnergyOverview";
import { EnergyGauge } from "@/components/energy/EnergyGauge";
import { QuickScenes } from "@/components/energy/QuickScenes";
import { FamilyBoard } from "@/components/family/FamilyBoard";
import { RoomCard } from "@/components/rooms/RoomCard";
import { ChildRoomView } from "@/components/rooms/ChildRoomView";
import { RoomDetailDrawer } from "@/components/rooms/RoomDetailDrawer";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Card } from "@/components/ui/Card";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { InstallAppBanner } from "@/components/ui/InstallAppBanner";
import { AvatarBadge } from "@/components/ui/AvatarBadge";
import { ProfileSetupModal } from "@/components/ui/ProfileSetupModal";
import { ProfileSwitcherModal } from "@/components/auth/ProfileSwitcherModal";

export default function HomePage() {
  const {
    user,
    profile,
    isAdmin,
    isLoading: authLoading,
    isPinLocked,
    signOut,
  } = useAuth();
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

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

  useEffect(() => {
    const defaultFloor = profile?.default_floor_id;
    if (defaultFloor && propertyFloors.some((f) => f.id === defaultFloor)) {
      setSelectedFloorId(defaultFloor);
    } else {
      setSelectedFloorId("all");
    }
  }, [profile?.id, profile?.default_floor_id, propertyFloors]);

  const floorNameById = useMemo(
    () => new Map(propertyFloors.map((f) => [f.id, f.name])),
    [propertyFloors],
  );

  const visibleRooms = useMemo(() => {
    const floorIds = new Set(propertyFloors.map((f) => f.id));
    const allowedRoomIds = profile?.allowed_room_ids ?? [];
    const filterByProfile = profile && profile.role !== "admin";

    return data.rooms.filter((r) => {
      if (!floorIds.has(r.floor_id)) return false;
      if (filterByProfile) {
        if (allowedRoomIds.length > 0) {
          if (!allowedRoomIds.includes(r.id)) return false;
        } else if (!r.is_common_area) {
          return false;
        }
      }
      if (selectedFloorId !== "all" && r.floor_id !== selectedFloorId) {
        return false;
      }
      return true;
    });
  }, [data.rooms, propertyFloors, selectedFloorId, profile]);

  const propertyWidgets = useMemo(() => {
    const allowedWidgetIds = profile?.allowed_widget_ids ?? [];
    const filterByProfile =
      profile && profile.role !== "admin" && allowedWidgetIds.length > 0;

    return data.dashboardWidgets.filter((w) => {
      if (w.property_id !== activeProperty?.id) return false;
      if (filterByProfile && !allowedWidgetIds.includes(w.id)) return false;
      return true;
    });
  }, [data.dashboardWidgets, activeProperty?.id, profile]);

  const isChild = profile?.role === "child";
  const showEnergy = !isChild && (profile?.show_energy ?? true);
  const showScenes = !isChild && (profile?.show_scenes ?? true);
  const showFamilyBoard = profile?.show_family_board ?? true;
  const childSingleRoom =
    isChild && visibleRooms.length === 1 ? visibleRooms[0] : null;

  const hasEnergyGaugeWidget = useMemo(
    () =>
      propertyWidgets.some(
        (w) => w.widget_category === "energy" && (isAdmin || !w.admin_only),
      ),
    [propertyWidgets, isAdmin],
  );

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--text-secondary)]">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#6B8E6B]" />
          <span>Laddar familjehubben…</span>
        </div>
      </main>
    );
  }

  if (!user || isPinLocked) {
    return <LoginScreen />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-7 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            title="Öppna Min profil"
            className="rounded-2xl transition-transform hover:scale-105 focus:outline-none"
          >
            <AvatarBadge
              avatarUrl={profile?.avatar_url}
              avatarIcon={profile?.avatar_icon}
              displayName={profile?.display_name || user.email}
              sizeClass="h-12 w-12"
            />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {activeProperty?.name ?? "Almvägen Family Hub"}
            </h1>
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="mt-0.5 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Inloggad som{" "}
              <span className="font-semibold text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4">
                {profile?.display_name || user.email}
              </span>
              {profile?.role && (
                <span className="ml-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {profile.role}
                </span>
              )}
            </button>
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
              className="min-h-11 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            >
              {data.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <ThemeToggle />

          <ProfileSetupModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <ProfileSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      <RoomDetailDrawer
        room={
          selectedRoomId
            ? visibleRooms.find((r) => r.id === selectedRoomId) ?? null
            : null
        }
        floorName={
          selectedRoomId
            ? floorNameById.get(
                visibleRooms.find((r) => r.id === selectedRoomId)?.floor_id ??
                  "",
              )
            : undefined
        }
        devices={
          selectedRoomId
            ? data.roomDevices.filter((d) => d.room_id === selectedRoomId)
            : []
        }
        onClose={() => setSelectedRoomId(null)}
      />

      {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#6B8E6B]/45 bg-[#6B8E6B]/15 px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[#6B8E6B]/25"
            >
              <Settings2 className="h-4 w-4 text-[#6B8E6B]" aria-hidden="true" />
              <span>Redigera hemmet</span>
            </button>
          )}

          {!isChild && <StatusBadge />}

          <button
            type="button"
            onClick={() => setIsSwitcherOpen(true)}
            title="Välj panel eller profil"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B] hover:text-[var(--text-primary)]"
          >
            <KeyRound className="h-4 w-4 text-[#D49A42]" aria-hidden="true" />
            <span className="hidden sm:inline">Välj panel / profil</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            title="Logga ut"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#C86D51]/50 hover:text-[var(--text-primary)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </header>

      <InstallAppBanner />

      {dataError && (
        <div className="rounded-2xl border border-[#C86D51]/40 bg-[#C86D51]/10 p-4 text-sm text-[#C86D51]">
          Kunde inte hämta data från Supabase: {dataError}
        </div>
      )}

      {dataLoading ? (
        <div className="flex items-center gap-3 py-12 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin text-[#6B8E6B]" />
          <span>Hämtar rum och enheter…</span>
        </div>
      ) : data.properties.length === 0 ? (
        <Card className="mx-auto my-8 flex max-w-lg flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
            <Home className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Välkommen till Almvägen Family Hub
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {isAdmin
              ? "Databasen är tom ännu. Skapa ditt första hus, våningar, rum och koppla Home Assistant-entiteter."
              : "Inga hus eller rum har delats med ditt konto ännu. Kontakta familjens administratör."}
          </p>
          <ProfileSetupModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <ProfileSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      <RoomDetailDrawer
        room={
          selectedRoomId
            ? visibleRooms.find((r) => r.id === selectedRoomId) ?? null
            : null
        }
        floorName={
          selectedRoomId
            ? floorNameById.get(
                visibleRooms.find((r) => r.id === selectedRoomId)?.floor_id ??
                  "",
              )
            : undefined
        }
        devices={
          selectedRoomId
            ? data.roomDevices.filter((d) => d.room_id === selectedRoomId)
            : []
        }
        onClose={() => setSelectedRoomId(null)}
      />

      {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#6B8E6B] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              <span>Skapa ditt första hus</span>
            </button>
          )}
        </Card>
      ) : (
        <>
          {childSingleRoom ? (
            <div className="space-y-6">
              <ChildRoomView
                room={childSingleRoom}
                floorName={floorNameById.get(childSingleRoom.floor_id)}
                devices={data.roomDevices.filter(
                  (d) => d.room_id === childSingleRoom.id,
                )}
              />
              {showFamilyBoard && (
                <FamilyBoard
                  propertyId={activeProperty?.id ?? null}
                  userId={user.id}
                  authorName={
                    profile?.display_name || user.email || "Familjemedlem"
                  }
                  isAdmin={isAdmin}
                />
              )}
            </div>
          ) : (
            <>
              {showEnergy && (
                <section aria-labelledby="energy-heading" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2
                      id="energy-heading"
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      Översikt &amp; Energi
                    </h2>
                    <span className="text-xs text-[var(--text-secondary)]">
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
                        <EnergyGauge
                          widgets={propertyWidgets}
                          isAdmin={isAdmin}
                        />
                      </div>
                    )}
                    <div className={hasEnergyGaugeWidget ? "lg:col-span-8" : ""}>
                      <EnergyOverview
                        widgets={propertyWidgets}
                        isAdmin={isAdmin}
                      />
                    </div>
                  </div>
                </section>
              )}

              {showScenes && (
                <QuickScenes widgets={propertyWidgets} isAdmin={isAdmin} />
              )}

              {showFamilyBoard && (
                <FamilyBoard
                  propertyId={activeProperty?.id ?? null}
                  userId={user.id}
                  authorName={
                    profile?.display_name || user.email || "Familjemedlem"
                  }
                  isAdmin={isAdmin}
                />
              )}

              <section aria-labelledby="rooms-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2
                    id="rooms-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                  >
                    {isChild ? "Mina rum" : "Rum & Enheter"}
                  </h2>
                  <span className="tabular-nums text-xs text-[var(--text-secondary)]">
                    {visibleRooms.length} rum
                  </span>
                </div>

                {!isChild && propertyFloors.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedFloorId("all")}
                      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                        selectedFloorId === "all"
                          ? "bg-[#6B8E6B] text-white"
                          : "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
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
                            ? "bg-[#6B8E6B] text-white"
                            : "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <DynamicIcon
                          name={floor.icon ?? "layers"}
                          className="h-4 w-4"
                        />
                        <span>{floor.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  {!isChild && propertyFloors.length > 0 && (
                    <aside
                      style={{ boxShadow: "var(--card-shadow)" }}
                      className="hidden w-56 shrink-0 flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 lg:flex"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedFloorId("all")}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                          selectedFloorId === "all"
                            ? "bg-[#6B8E6B]/15 text-[#6B8E6B] ring-1 ring-[#6B8E6B]/40"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
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
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                            selectedFloorId === floor.id
                              ? "bg-[#6B8E6B]/15 text-[#6B8E6B] ring-1 ring-[#6B8E6B]/40"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
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
                      <Card className="border-dashed text-center text-sm text-[var(--text-secondary)]">
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
                            onSelect={() => setSelectedRoomId(room.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-[#6B8E6B]" aria-hidden="true" />
          <span>Home Assistant WebSocket &amp; Supabase RLS</span>
        </span>
        <span>Almvägen Family Hub</span>
      </footer>

      <ProfileSetupModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <ProfileSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      <RoomDetailDrawer
        room={
          selectedRoomId
            ? visibleRooms.find((r) => r.id === selectedRoomId) ?? null
            : null
        }
        floorName={
          selectedRoomId
            ? floorNameById.get(
                visibleRooms.find((r) => r.id === selectedRoomId)?.floor_id ??
                  "",
              )
            : undefined
        }
        devices={
          selectedRoomId
            ? data.roomDevices.filter((d) => d.room_id === selectedRoomId)
            : []
        }
        onClose={() => setSelectedRoomId(null)}
      />

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
