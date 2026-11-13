"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Layers,
  Moon,
  RefreshCw,
  Sliders,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  DEFAULT_ENERGY_CONFIG,
  fetchEnergyConfig,
  resolveMainEnergyEntities,
  saveEnergyConfig,
  type EnergyHouseholdConfig,
  type EnergyPeriod,
} from "@/lib/energy/energyConfig";
import { computeEnergyDashboard } from "@/lib/energy/energyEngine";
import {
  fetchHAStatistics,
  type HAStatisticsMap,
} from "@/lib/ha/energyStats";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import {
  fetchTibberData,
  type TibberSyncData,
} from "@/lib/tibber/tibberClient";
import type {
  DashboardWidget,
  Floor,
  Room,
  RoomDevice,
} from "@/lib/supabase/types";
import { EnergyConfigModal } from "./EnergyConfigModal";
import { EnergyGauge } from "./EnergyGauge";
import { EnergyGeminiAdvisor } from "./EnergyGeminiAdvisor";
import { EnergyOverview } from "./EnergyOverview";

interface EnergyDashboardProps {
  propertyId: string | null;
  propertyName: string;
  defaultMunicipality?: string | null;
  floors: Floor[];
  rooms: Room[];
  roomDevices: RoomDevice[];
  widgets: DashboardWidget[];
  isAdmin: boolean;
  onOpenAdmin: () => void;
}

const PERIOD_OPTIONS: { id: EnergyPeriod; label: string }[] = [
  { id: "now", label: "Just nu" },
  { id: "today", label: "Idag" },
  { id: "7d", label: "7 dagar" },
  { id: "month", label: "Denna månad" },
];

type BreakdownTab = "groups" | "rooms" | "devices";

function formatKr(kr: number): string {
  return `${kr.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kr`;
}

function formatKwh(kwh: number): string {
  return `${kwh.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
}

function formatWatts(w: number): string {
  if (w >= 1000) {
    return `${(w / 1000).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;
  }
  return `${Math.round(w)} W`;
}

export function EnergyDashboard({
  propertyId,
  propertyName,
  defaultMunicipality,
  floors,
  rooms,
  roomDevices,
  widgets,
  isAdmin,
  onOpenAdmin,
}: EnergyDashboardProps) {
  const { isConnected, entities, sendCommand } = useHomeAssistant();

  const [period, setPeriod] = useState<EnergyPeriod>("today");
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("groups");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "lighting",
  );
  const [deviceSort, setDeviceSort] = useState<"kwh" | "live">("kwh");

  const [config, setConfig] = useState<EnergyHouseholdConfig>(
    DEFAULT_ENERGY_CONFIG,
  );
  const [statistics, setStatistics] = useState<HAStatisticsMap>({});
  const [tibberData, setTibberData] = useState<TibberSyncData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Load saved energy config from Supabase / localStorage
  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    fetchEnergyConfig(propertyId).then((loaded) => {
      if (active) setConfig(loaded);
    });
    return () => {
      active = false;
    };
  }, [propertyId]);

  const statisticIdsToFetch = useMemo(() => {
    const ids = new Set<string>();
    const main = resolveMainEnergyEntities(config, widgets, entities);
    if (main.mainPowerEntityId) ids.add(main.mainPowerEntityId);
    if (main.mainEnergyEntityId) ids.add(main.mainEnergyEntityId);
    if (main.priceEntityId) ids.add(main.priceEntityId);

    for (const dev of roomDevices) {
      const ov = config.deviceOverrides[dev.id];
      if (ov?.energyEntityId) ids.add(ov.energyEntityId);
      if (ov?.powerEntityId) ids.add(ov.powerEntityId);
      const ent = entities[dev.ha_entity_id];
      const dc = (ent?.attributes.device_class ?? "").toLowerCase();
      const unit = (ent?.attributes.unit_of_measurement ?? "").toLowerCase();
      if (
        dc === "energy" ||
        dc === "power" ||
        ["w", "kw", "kwh", "wh"].includes(unit)
      ) {
        ids.add(dev.ha_entity_id);
      }
    }

    for (const w of widgets) {
      if (w.widget_category === "energy") {
        ids.add(w.ha_entity_id);
      }
    }

    for (const td of config.trackedDevices ?? []) {
      if (td.energyEntityId) ids.add(td.energyEntityId);
      if (td.powerEntityId) ids.add(td.powerEntityId);
    }

    return Array.from(ids);
  }, [config, widgets, entities, roomDevices]);

  const loadStatistics = useCallback(async () => {
    if (!isConnected || statisticIdsToFetch.length === 0) return;
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const res = await fetchHAStatistics(
        sendCommand,
        statisticIdsToFetch,
        period,
      );
      setStatistics(res);
    } catch (err) {
      setStatsError(
        err instanceof Error
          ? err.message
          : "Kunde inte hämta historik från Home Assistant.",
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, [isConnected, statisticIdsToFetch, period, sendCommand]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  useEffect(() => {
    const token = config.tibberToken?.trim();
    if (!token) {
      setTibberData(null);
      return;
    }
    let active = true;
    fetchTibberData(token)
      .then((res) => {
        if (active) setTibberData(res);
      })
      .catch(() => {
        // Keep existing state on transient Tibber API error
      });
    return () => {
      active = false;
    };
  }, [config.tibberToken]);

  const summary = useMemo(
    () =>
      computeEnergyDashboard({
        period,
        config,
        floors,
        rooms,
        roomDevices,
        dashboardWidgets: widgets,
        entities,
        statistics,
        tibberData,
      }),
    [period, config, floors, rooms, roomDevices, widgets, entities, statistics, tibberData],
  );

  const hasGaugeWidget = useMemo(
    () =>
      widgets.some(
        (w) => w.widget_category === "energy" && (isAdmin || !w.admin_only),
      ),
    [widgets, isAdmin],
  );

  const sortedDevices = useMemo(() => {
    const copy = [...summary.devices];
    if (deviceSort === "live") {
      return copy.sort((a, b) => b.liveWatts - a.liveWatts || b.kwh - a.kwh);
    }
    return copy.sort((a, b) => b.kwh - a.kwh || b.liveWatts - a.liveWatts);
  }, [summary.devices, deviceSort]);

  const handleSaveConfig = async (next: EnergyHouseholdConfig) => {
    setConfig(next);
    if (propertyId) {
      await saveEnergyConfig(propertyId, next);
    }
  };

  const fuseColor =
    summary.fuseLoadPct >= 80
      ? "bg-[#C86D51]"
      : summary.fuseLoadPct >= 55
        ? "bg-[#D49A42]"
        : "bg-[#6B8E6B]";

  return (
    <div className="space-y-6">
      {/* Header & Period Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Energi, Kostnad &amp; Drift
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {isConnected
              ? "Realtid & statistik via Home Assistant"
              : "Väntar på anslutning till Home Assistant"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1"
            role="group"
            aria-label="Välj tidsperiod"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
                  period === opt.id
                    ? "bg-[#6B8E6B] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadStatistics}
            disabled={!isConnected || isLoadingStats}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B] hover:text-[#6B8E6B] disabled:opacity-50"
            title="Uppdatera statistik från Home Assistant"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingStats ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Uppdatera</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] hover:text-[#6B8E6B]"
            >
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Energiinställningar</span>
            </button>
          )}
        </div>
      </div>

      {statsError && (
        <div className="rounded-xl border border-[#D49A42]/40 bg-[#D49A42]/10 px-4 py-2.5 text-xs text-[var(--text-primary)]">
          Kunde inte hämta HA-historik ({statsError}). Visar realtidsdata.
        </div>
      )}

      {/* Top Smart Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {hasGaugeWidget && (
          <div className="lg:col-span-4">
            <EnergyGauge widgets={widgets} isAdmin={isAdmin} />
          </div>
        )}

        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            hasGaugeWidget ? "lg:col-span-8" : "lg:col-span-12 xl:grid-cols-4"
          }`}
        >
          {/* Card 1: Total consumption, cost & fuse guard */}
          <Card className="flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Förbrukning ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
                </p>
                <p className="tabular-nums mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {formatKwh(summary.totalKwh)}
                </p>
                <p className="tabular-nums text-sm font-semibold text-[#6B8E6B]">
                  {formatKr(summary.totalCostKr)}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
                <Zap className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                  Huvudsäkring ({config.mainFuseAmps} A)
                </span>
                <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                  {formatWatts(summary.liveTotalWatts)} /{" "}
                  {(summary.fuseMaxWatts / 1000).toFixed(1)} kW
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className={`h-full rounded-full transition-all ${fuseColor}`}
                  style={{ width: `${summary.fuseLoadPct}%` }}
                />
              </div>
              <p className="tabular-nums text-[11px] text-[var(--text-secondary)]">
                Elpris just nu:{" "}
                {summary.spotPriceKr !== null
                  ? `${summary.totalPricePerKwh.toFixed(2)} kr/kWh (inkl. ${config.gridFeePerKwh.toFixed(2)} kr nät)`
                  : `Nätavgift ${config.gridFeePerKwh.toFixed(2)} kr/kWh`}
              </p>
            </div>
          </Card>

          {/* Card 2: Effekttoppar */}
          <Card className="flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Effekttoppar
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {config.gridOperator
                    ? `${config.gridOperator}${config.municipality ? ` (${config.municipality})` : ""}`
                    : "Högsta timmarna (effekttariff-koll)"}
                </p>
                {config.gridTariffSummary && (
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {config.gridTariffSummary}
                  </p>
                )}
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C86D51]/15 text-[#C86D51]">
                <Flame className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            {summary.topPeaks.length > 0 ? (
              <div className="space-y-2">
                {summary.topPeaks.map((peak, idx) => (
                  <div
                    key={peak.timestamp}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-subtle)]/60 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-[var(--text-secondary)]">
                      #{idx + 1} · {peak.label}
                    </span>
                    <span className="tabular-nums font-bold text-[#C86D51]">
                      {peak.kw.toFixed(2)} kW
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                Koppla huvudmätare (kWh/W) i Energiinställningar för att se
                timtoppar.
              </p>
            )}
          </Card>

          {/* Card 3: Bästa starttid */}
          <Card className="flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Bästa starttid
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Billigaste fönster för tvätt/tork/laddning
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D49A42]/15 text-[#D49A42]">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            {summary.cheapestWindows.length > 0 ? (
              <div className="space-y-2">
                {summary.cheapestWindows.map((win) => (
                  <div
                    key={win.durationHours}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-subtle)]/60 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-[var(--text-primary)]">
                      <strong>{win.durationHours}h:</strong>{" "}
                      {win.isTomorrow ? "Imorgon " : "Idag "}
                      {win.startHour}–{win.endHour}
                    </span>
                    <span className="tabular-nums font-bold text-[#6B8E6B]">
                      {win.avgPriceKr.toFixed(2)} kr/kWh
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                Timpris-prognos visas automatiskt om din elprissensor innehåller
                timpriser (`raw_today` / `today`).
              </p>
            )}
          </Card>

          {/* Card 4: Nattlig baslast */}
          <Card className="flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Nattlig baslast
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Lägsta förbrukning 00:00–05:00
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                <Moon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            {summary.baseloadWatts !== null ? (
              <div className="space-y-1">
                <p className="tabular-nums text-2xl font-bold text-[var(--text-primary)]">
                  {formatWatts(summary.baseloadWatts)}
                </p>
                <p className="tabular-nums text-xs text-[var(--text-secondary)]">
                  Motsvarar ca{" "}
                  <strong>
                    {formatKr(
                      (summary.baseloadWatts / 1000) *
                        24 *
                        30 *
                        summary.totalPricePerKwh,
                    )}
                  </strong>{" "}
                  / mån i konstant grundlast
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                Väntar på nattstatistik från huvudmätaren.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Breakdown Section: Groups / Rooms & Floors / All Devices */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6B8E6B]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Förbrukning &amp; Kostnad per kategori
            </h3>
          </div>

          <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-1">
            {(
              [
                { id: "groups", label: "Grupper" },
                { id: "rooms", label: "Rum & Våningar" },
                { id: "devices", label: `Enheter (${summary.devices.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBreakdownTab(tab.id)}
                className={`min-h-8 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  breakdownTab === tab.id
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {breakdownTab === "groups" && (
          <div className="space-y-3">
            {summary.categories.map((cat) => {
              const isExpanded = expandedCategory === cat.category;
              const hasFloors = cat.floorBreakdown.length > 0;

              return (
                <div
                  key={cat.category}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 p-3.5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      hasFloors &&
                      setExpandedCategory(isExpanded ? null : cat.category)
                    }
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {hasFloors ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                        )
                      ) : (
                        <Activity className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      )}
                      <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {cat.label}
                      </span>
                      {cat.deviceCount > 0 && (
                        <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                          {cat.deviceCount} st
                        </span>
                      )}
                    </div>

                    <div className="tabular-nums flex shrink-0 items-center gap-3 text-xs">
                      <span className="hidden text-[var(--text-secondary)] sm:inline">
                        Just nu: <strong>{formatWatts(cat.liveWatts)}</strong>
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatKwh(cat.kwh)}
                      </span>
                      <span className="font-bold text-[#6B8E6B]">
                        {formatKr(cat.costKr)}
                      </span>
                    </div>
                  </button>

                  {/* Progress Bar */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-card)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.sharePct}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                    <span className="tabular-nums w-9 text-right text-[11px] font-semibold text-[var(--text-secondary)]">
                      {cat.sharePct}%
                    </span>
                  </div>

                  {/* Per-floor drill-down (e.g. Belysning per våning) */}
                  {isExpanded && hasFloors && (
                    <div className="mt-3 space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5 pl-6">
                      {cat.floorBreakdown.map((fl) => (
                        <div
                          key={fl.floorId}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {fl.floorName} ({fl.deviceCount} enheter)
                          </span>
                          <div className="tabular-nums flex items-center gap-3">
                            <span className="text-[var(--text-secondary)]">
                              {formatWatts(fl.liveWatts)}
                            </span>
                            <span className="font-medium text-[var(--text-primary)]">
                              {formatKwh(fl.kwh)}
                            </span>
                            <span className="font-semibold text-[#6B8E6B]">
                              {formatKr(fl.costKr)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {breakdownTab === "rooms" && (
          <div className="space-y-4">
            {summary.floors.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Inga våningar eller rum konfigurerade ännu.
              </p>
            ) : (
              summary.floors.map((floor) => (
                <div key={floor.floorId} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {floor.floorName}
                    </h4>
                    <div className="tabular-nums flex items-center gap-3 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        {formatWatts(floor.liveWatts)}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatKwh(floor.kwh)}
                      </span>
                      <span className="font-bold text-[#6B8E6B]">
                        {formatKr(floor.costKr)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {floor.rooms.map((room) => (
                      <div
                        key={room.roomId}
                        className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/35 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {room.roomName}
                          </p>
                          <p className="tabular-nums text-[11px] text-[var(--text-secondary)]">
                            {formatWatts(room.liveWatts)} · {room.deviceCount}{" "}
                            enheter
                          </p>
                        </div>
                        <div className="tabular-nums text-right">
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            {formatKwh(room.kwh)}
                          </p>
                          <p className="text-xs font-bold text-[#6B8E6B]">
                            {formatKr(room.costKr)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {breakdownTab === "devices" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Sortera efter:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDeviceSort("kwh")}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    deviceSort === "kwh"
                      ? "bg-[#6B8E6B] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  Förbrukning (kWh)
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceSort("live")}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    deviceSort === "live"
                      ? "bg-[#6B8E6B] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  Effekt just nu (W)
                </button>
              </div>
            </div>

            {sortedDevices.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Inga enheter kopplade ännu.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                {sortedDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-[var(--text-primary)]">
                          {dev.name}
                        </p>
                        {dev.statusText && (
                          <span className="rounded-full bg-[#6B8E6B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#6B8E6B]">
                            {dev.statusText}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-[var(--text-secondary)]">
                        {dev.floorName} · {dev.roomName} ·{" "}
                        {dev.source === "measured"
                          ? "Uppmätt"
                          : dev.source === "estimated"
                            ? `Uppskattad (${dev.ratedWatts} W)`
                            : "Saknar elmätare"}
                      </p>
                    </div>
                    <div className="tabular-nums flex items-center gap-4">
                      <span className="text-[var(--text-secondary)]">
                        {formatWatts(dev.liveWatts)}
                      </span>
                      <span className="w-16 text-right font-semibold text-[var(--text-primary)]">
                        {formatKwh(dev.kwh)}
                      </span>
                      <span className="w-16 text-right font-bold text-[#6B8E6B]">
                        {formatKr(dev.costKr)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Gemini Energy Advisor */}
      <EnergyGeminiAdvisor
        propertyId={propertyId}
        propertyName={propertyName}
        summary={summary}
        gridOperator={config.gridOperator}
        municipality={config.municipality ?? defaultMunicipality}
        gridTariffSummary={config.gridTariffSummary}
      />

      {/* Existing Custom Dashboard Widgets */}
      <EnergyOverview
        widgets={widgets}
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
      />

      {/* Admin Energy Config Modal */}
      <EnergyConfigModal
        isOpen={isConfigOpen}
        propertyId={propertyId}
        config={config}
        defaultMunicipality={defaultMunicipality}
        rooms={rooms}
        roomDevices={roomDevices}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
