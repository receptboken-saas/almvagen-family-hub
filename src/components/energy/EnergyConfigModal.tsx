"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Lightbulb,
  Loader2,
  Save,
  Sliders,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { HAEntityPicker } from "@/components/admin/HAEntityPicker";
import {
  ENERGY_CATEGORIES_ORDER,
  ENERGY_CATEGORY_META,
  inferDeviceCategory,
  type DeviceEnergyOverride,
  type EnergyCategory,
  type EnergyHouseholdConfig,
  type TrackedHAEnergyDevice,
} from "@/lib/energy/energyConfig";
import {
  scanHomeAssistantEnergyDevices,
  type DiscoveredHADevice,
} from "@/lib/ha/energyDiscovery";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Room, RoomDevice } from "@/lib/supabase/types";

interface EnergyConfigModalProps {
  isOpen: boolean;
  propertyId?: string | null;
  config: EnergyHouseholdConfig;
  defaultMunicipality?: string | null;
  rooms: Room[];
  roomDevices: RoomDevice[];
  onClose: () => void;
  onSave: (next: EnergyHouseholdConfig) => Promise<void>;
}

function getGridTariffFallback(
  operatorInput: string,
  municipalityInput: string,
): {
  gridOperator: string;
  gridFeePerKwh: number;
  gridTariffSummary: string;
} {
  const op = operatorInput.toLowerCase();
  const muni = municipalityInput.trim();

  if (op.includes("eon") || op.includes("e.on")) {
    return {
      gridOperator: "E.ON Energidistribution",
      gridFeePerKwh: 1.18,
      gridTariffSummary:
        "E.ON överföring + energiskatt inkl. moms (effekttariff pausad)",
    };
  }
  if (op.includes("ellevio")) {
    return {
      gridOperator: "Ellevio",
      gridFeePerKwh: 1.12,
      gridTariffSummary:
        "Ellevio överföring + energiskatt inkl. moms (effekttariff snitt topp 3)",
    };
  }
  if (op.includes("vattenfall")) {
    return {
      gridOperator: "Vattenfall Eldistribution",
      gridFeePerKwh: 1.15,
      gridTariffSummary:
        "Vattenfall överföring + energiskatt inkl. moms (effekttariff införd)",
    };
  }

  return {
    gridOperator:
      operatorInput.trim() ||
      (muni ? `Lokalt elnät (${muni})` : "Svenskt elnät (schablon)"),
    gridFeePerKwh: 1.15,
    gridTariffSummary:
      "Schablon överföring + energiskatt inkl. moms (justera vid behov)",
  };
}

export function EnergyConfigModal({
  isOpen,
  propertyId,
  config,
  defaultMunicipality,
  rooms,
  roomDevices,
  onClose,
  onSave,
}: EnergyConfigModalProps) {
  const { isConnected, entities, sendCommand } = useHomeAssistant();

  const [draft, setDraft] = useState<EnergyHouseholdConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"scan" | "main" | "devices">(
    "scan",
  );

  const [isScanning, setIsScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredHADevice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<
    Record<string, EnergyCategory>
  >({});
  const [bulbAppliedCount, setBulbAppliedCount] = useState<number | null>(null);
  const [isFetchingTariff, setIsFetchingTariff] = useState(false);
  const [tariffError, setTariffError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...config,
        municipality: config.municipality ?? defaultMunicipality ?? null,
      });
      setBulbAppliedCount(null);
      setTariffError(null);
    }
  }, [isOpen, config, defaultMunicipality]);

  if (!isOpen) return null;

  const roomMap = new Map(rooms.map((r) => [r.id, r.name]));

  const handleScanHA = async () => {
    setIsScanning(true);
    setScanDone(false);
    try {
      const result = await scanHomeAssistantEnergyDevices(sendCommand, entities);

      setDraft((prev) => ({
        ...prev,
        mainPowerEntityId: prev.mainPowerEntityId ?? result.mainPowerEntityId,
        mainEnergyEntityId:
          prev.mainEnergyEntityId ?? result.mainEnergyEntityId,
        priceEntityId: prev.priceEntityId ?? result.priceEntityId,
      }));

      const nonMain = result.devices.filter((d) => !d.isMainMeterCandidate);
      setDiscovered(nonMain);

      const existingIds = new Set(
        (draft.trackedDevices ?? []).map((t) => t.haDeviceId),
      );
      const nextSelected = new Set<string>();
      const nextCats: Record<string, EnergyCategory> = {};

      for (const dev of nonMain) {
        if (existingIds.size === 0 || existingIds.has(dev.haDeviceId)) {
          nextSelected.add(dev.haDeviceId);
        }
        const existingMatch = (draft.trackedDevices ?? []).find(
          (t) => t.haDeviceId === dev.haDeviceId,
        );
        nextCats[dev.haDeviceId] =
          existingMatch?.category ?? dev.suggestedCategory;
      }

      setSelectedIds(nextSelected);
      setCategoryOverrides(nextCats);
      setScanDone(true);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelected = (haDeviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(haDeviceId)) next.delete(haDeviceId);
      else next.add(haDeviceId);
      return next;
    });
  };

  const handleFetchGridTariff = async () => {
    const op = (draft.gridOperator ?? "").trim();
    const muni = (draft.municipality ?? "").trim();
    if (!op && !muni) {
      setTariffError("Ange minst elnätsleverantör eller kommun först.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setTariffError("Supabase-klient saknas.");
      return;
    }

    setIsFetchingTariff(true);
    setTariffError(null);

    const prompt =
      `Slå upp aktuell svensk elnätsavgift (överföringsavgift + svensk energiskatt inkl. moms i kr/kWh) och eventuell effekttariff-modell för elnätsleverantör "${op || "okänd (välj lokal nätägare i kommunen)"}" i "${muni || "Sverige"}" för en villa med ${draft.mainFuseAmps} A huvudsäkring. ` +
      "Svara ENDAST med giltig JSON i exakt detta format: " +
      '{"gridOperator": "Bekräftat bolagsnamn", "gridFeePerKwh": 1.15, "gridTariffSummary": "Kort sammanfattning på max 120 tecken om överföring, energiskatt och effekttariff"}';

    const effectivePropertyId = propertyId ?? null;

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<{
        answer?: string;
        reply?: string;
        message?: string;
        text?: string;
        error?: string;
      }>("gemini-hub-assistant", {
        body: {
          action: "ask_house",
          ...(effectivePropertyId ? { property_id: effectivePropertyId } : {}),
          payload: {
            question: prompt,
            house_context: {
              today: new Date().toISOString().slice(0, 10),
              property: null,
              ha_connected: isConnected,
              rooms: [],
              widgets: [],
              weekly_events: [],
              dinner_plans: [],
              grid_operator: op,
              municipality: muni,
              main_fuse_amps: draft.mainFuseAmps,
            },
          },
        },
      });

      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      const rawText =
        data?.answer || data?.reply || data?.message || data?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Kunde inte tolka svaret från Gemini.");
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        gridOperator?: string;
        gridFeePerKwh?: number;
        gridTariffSummary?: string;
      };

      setDraft((prev) => ({
        ...prev,
        gridOperator: parsed.gridOperator?.trim() || prev.gridOperator,
        gridFeePerKwh:
          typeof parsed.gridFeePerKwh === "number" &&
          Number.isFinite(parsed.gridFeePerKwh)
            ? Number(parsed.gridFeePerKwh.toFixed(2))
            : prev.gridFeePerKwh,
        gridTariffSummary:
          parsed.gridTariffSummary?.trim() || prev.gridTariffSummary,
      }));
    } catch {
      const fallback = getGridTariffFallback(op, muni);
      setDraft((prev) => ({
        ...prev,
        gridOperator: fallback.gridOperator,
        gridFeePerKwh: fallback.gridFeePerKwh,
        gridTariffSummary: fallback.gridTariffSummary,
      }));
      setTariffError(null);
    } finally {
      setIsFetchingTariff(false);
    }
  };

  const applyDefaultLightWatts = () => {
    let count = 0;
    const nextOverrides = { ...draft.deviceOverrides };
    for (const dev of roomDevices) {
      if (dev.widget_type === "light" || dev.widget_type === "dimmer") {
        const current = nextOverrides[dev.id] ?? {};
        if (!current.ratedWatts && !current.powerEntityId) {
          nextOverrides[dev.id] = {
            ...current,
            energyCategory: "lighting",
            ratedWatts: 9,
          };
          count += 1;
        }
      }
    }
    setDraft((prev) => ({ ...prev, deviceOverrides: nextOverrides }));
    setBulbAppliedCount(count);
  };

  const updateOverride = (
    deviceId: string,
    patch: Partial<DeviceEnergyOverride>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      deviceOverrides: {
        ...prev.deviceOverrides,
        [deviceId]: {
          ...prev.deviceOverrides[deviceId],
          ...patch,
        },
      },
    }));
  };

  const filteredDevices = roomDevices.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const rName = (roomMap.get(d.room_id) ?? "").toLowerCase();
    return (
      d.display_name.toLowerCase().includes(q) ||
      d.ha_entity_id.toLowerCase().includes(q) ||
      rName.includes(q)
    );
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalDraft = draft;
      if (scanDone) {
        const tracked: TrackedHAEnergyDevice[] = discovered
          .filter((d) => selectedIds.has(d.haDeviceId))
          .map((d) => ({
            haDeviceId: d.haDeviceId,
            name: d.name,
            category: categoryOverrides[d.haDeviceId] ?? d.suggestedCategory,
            powerEntityId: d.powerEntityId,
            energyEntityId: d.energyEntityId,
            statusEntityId: d.statusEntityId,
            areaName: d.areaName,
          }));
        finalDraft = {
          ...draft,
          trackedDevices: tracked,
        };
      }
      await onSave(finalDraft);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="energy-cfg-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
              <Sliders className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="energy-cfg-title"
                className="font-display text-lg font-semibold text-[var(--text-primary)]"
              >
                Smart Energi-konfiguration
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Skanna Home Assistant i ett klick eller finjustera manuellt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            aria-label="Stäng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("scan")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors ${
              activeTab === "scan"
                ? "bg-[#6B8E6B] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Smart Skanna HA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("main")}
            className={`min-h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
              activeTab === "main"
                ? "bg-[#6B8E6B] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
            }`}
          >
            Huvudmätare &amp; Pris
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("devices")}
            className={`min-h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
              activeTab === "devices"
                ? "bg-[#6B8E6B] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
            }`}
          >
            Rumsenheter ({roomDevices.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "scan" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-[#6B8E6B]/30 bg-[#6B8E6B]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Hitta prylar &amp; sensorer automatiskt
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Läser HA:s enhetsregister och kopplar automatiskt ihop
                    W, kWh, elpris och driftstatus (t.ex. laddare, tvättmaskin,
                    NIBE, smarta pluggar).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleScanHA}
                  disabled={!isConnected || isScanning}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#6B8E6B] px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isScanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {isScanning ? "Skannar HA..." : "Skanna Home Assistant"}
                  </span>
                </button>
              </div>

              {/* Quick action for lights without meters */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Lightbulb
                    className="h-4 w-4 shrink-0 text-[#D49A42]"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-[var(--text-primary)]">
                    Lampor utan elmätare? Sätt schablon (9 W) på alla lampor i
                    ett klick.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applyDefaultLightWatts}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#D49A42] hover:text-[#D49A42]"
                >
                  {bulbAppliedCount !== null
                    ? `Klart (${bulbAppliedCount} lampor uppdaterade)`
                    : "Sätt 9 W på alla lampor"}
                </button>
              </div>

              {/* Scan Results */}
              {scanDone ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/35 p-3 text-xs">
                    <p className="font-semibold text-[var(--text-primary)]">
                      Huvudmätare &amp; Pris (automatiskt ifyllt):
                    </p>
                    <div className="mt-1 grid grid-cols-1 gap-1 text-[var(--text-secondary)] sm:grid-cols-3">
                      <span className="truncate">
                        Effekt: <strong>{draft.mainPowerEntityId ?? "Ej hittad"}</strong>
                      </span>
                      <span className="truncate">
                        Energi: <strong>{draft.mainEnergyEntityId ?? "Ej hittad"}</strong>
                      </span>
                      <span className="truncate">
                        Elpris: <strong>{draft.priceEntityId ?? "Ej hittad"}</strong>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Upptäckta energiprylar ({discovered.length} st) — välj vilka
                    som ska följas:
                  </p>

                  {discovered.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Inga separata W/kWh-enheter hittades utöver huvudmätaren.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {discovered.map((dev) => {
                        const checked = selectedIds.has(dev.haDeviceId);
                        const cat =
                          categoryOverrides[dev.haDeviceId] ??
                          dev.suggestedCategory;
                        return (
                          <div
                            key={dev.haDeviceId}
                            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                              checked
                                ? "border-[#6B8E6B]/50 bg-[#6B8E6B]/5"
                                : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/25 opacity-75"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSelected(dev.haDeviceId)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  checked
                                    ? "border-[#6B8E6B] bg-[#6B8E6B] text-white"
                                    : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
                                }`}
                              >
                                {checked && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {dev.name}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                  {dev.areaName && (
                                    <span className="rounded bg-[var(--bg-card)] px-1.5 py-0.5">
                                      {dev.areaName}
                                    </span>
                                  )}
                                  {dev.powerEntityId && (
                                    <span className="rounded bg-[#D49A42]/15 px-1.5 py-0.5 font-medium text-[#D49A42]">
                                      W
                                    </span>
                                  )}
                                  {dev.energyEntityId && (
                                    <span className="rounded bg-[#6B8E6B]/15 px-1.5 py-0.5 font-medium text-[#6B8E6B]">
                                      kWh
                                    </span>
                                  )}
                                  {dev.statusEntityId && (
                                    <span className="rounded bg-[#C86D51]/15 px-1.5 py-0.5 font-medium text-[#C86D51]">
                                      Status
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>

                            <select
                              aria-label={`Kategori för ${dev.name}`}
                              value={cat}
                              onChange={(e) =>
                                setCategoryOverrides((prev) => ({
                                  ...prev,
                                  [dev.haDeviceId]: e.target
                                    .value as EnergyCategory,
                                }))
                              }
                              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                            >
                              {ENERGY_CATEGORIES_ORDER.map((c) => (
                                <option key={c} value={c}>
                                  {ENERGY_CATEGORY_META[c].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                draft.trackedDevices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      Redan aktiverade energiprylar ({draft.trackedDevices.length} st):
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {draft.trackedDevices.map((td) => (
                        <div
                          key={td.haDeviceId}
                          className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text-primary)]">
                              {td.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {ENERGY_CATEGORY_META[td.category].label}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                trackedDevices: prev.trackedDevices.filter(
                                  (x) => x.haDeviceId !== td.haDeviceId,
                                ),
                              }))
                            }
                            className="text-[11px] font-semibold text-[#C86D51] hover:underline"
                          >
                            Ta bort
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === "main" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3.5 text-xs text-[var(--text-secondary)]">
                Lämna fälten tomma om du vill att hubben automatiskt ska hitta
                rätt sensor från dina energikort i Home Assistant.
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tibber-token-input"
                  className="text-xs font-semibold text-[var(--text-primary)]"
                >
                  Tibber API-token (rekommenderas för exakt månadssynk mot Tibber-appen)
                </label>
                <input
                  id="tibber-token-input"
                  type="password"
                  value={draft.tibberToken ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      tibberToken: e.target.value.trim() || null,
                    }))
                  }
                  placeholder="Klistra in din Personal Access Token från developer.tibber.com..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
                />
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Hämtar månadens exakta kWh, kostnad och dagens/morgondagens timpriser direkt från Tibber.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Huvudmätare – Effekt just nu (W / kW)
                </label>
                <HAEntityPicker
                  value={draft.mainPowerEntityId ?? ""}
                  onChange={(id) =>
                    setDraft((p) => ({
                      ...p,
                      mainPowerEntityId: id.trim() || null,
                    }))
                  }
                  placeholder="t.ex. sensor.tibber_pulse_stromforbrukning"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Huvudmätare – Ackumulerad energi (kWh, för historik)
                </label>
                <HAEntityPicker
                  value={draft.mainEnergyEntityId ?? ""}
                  onChange={(id) =>
                    setDraft((p) => ({
                      ...p,
                      mainEnergyEntityId: id.trim() || null,
                    }))
                  }
                  placeholder="t.ex. sensor.tibber_pulse_ackumulerad_forbrukning"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Elprissensor (kr/kWh eller öre/kWh)
                </label>
                <HAEntityPicker
                  value={draft.priceEntityId ?? ""}
                  onChange={(id) =>
                    setDraft((p) => ({
                      ...p,
                      priceEntityId: id.trim() || null,
                    }))
                  }
                  placeholder="t.ex. sensor.tibber_elpris"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Elnätsleverantör &amp; Kommun
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Hämta överföringsavgift, energiskatt och effekttariff-regler med Gemini
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchGridTariff}
                    disabled={isFetchingTariff}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#6B8E6B] px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isFetchingTariff ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {isFetchingTariff ? "Hämtar..." : "Hämta uppgifter med Gemini"}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="grid-operator-input"
                      className="text-[11px] font-semibold text-[var(--text-secondary)]"
                    >
                      Elnätsleverantör
                    </label>
                    <input
                      id="grid-operator-input"
                      type="text"
                      value={draft.gridOperator ?? ""}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          gridOperator: e.target.value || null,
                        }))
                      }
                      placeholder="t.ex. Ellevio, E.ON, Vattenfall..."
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="energy-municipality-input"
                      className="text-[11px] font-semibold text-[var(--text-secondary)]"
                    >
                      Kommun
                    </label>
                    <input
                      id="energy-municipality-input"
                      type="text"
                      value={draft.municipality ?? ""}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          municipality: e.target.value || null,
                        }))
                      }
                      placeholder="t.ex. Nacka, Täby, Kungsbacka..."
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
                    />
                  </div>
                </div>

                {tariffError && (
                  <p className="text-xs font-medium text-[#C86D51]">
                    {tariffError}
                  </p>
                )}

                {draft.gridTariffSummary && (
                  <p className="rounded-lg bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)]">
                    <strong>Tariff-info:</strong> {draft.gridTariffSummary}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="grid-fee-input"
                    className="text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Nätavgift &amp; Energiskatt (kr/kWh påslag)
                  </label>
                  <input
                    id="grid-fee-input"
                    type="number"
                    step="0.05"
                    min="0"
                    value={draft.gridFeePerKwh}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        gridFeePerKwh: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="tabular-nums w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="fuse-amps-input"
                    className="text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Huvudsäkring (Ampere, 3-fas)
                  </label>
                  <select
                    id="fuse-amps-input"
                    value={draft.mainFuseAmps}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        mainFuseAmps: Number.parseInt(e.target.value, 10) || 20,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
                  >
                    <option value={16}>16 A (max 11,0 kW)</option>
                    <option value={20}>20 A (max 13,8 kW)</option>
                    <option value={25}>25 A (max 17,3 kW)</option>
                    <option value={35}>35 A (max 24,2 kW)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "devices" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök enhet eller rum..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#6B8E6B] sm:max-w-xs"
                />
                <span className="text-xs text-[var(--text-secondary)]">
                  Ange märkeffekt (W) för lampor utan egen elmätare
                </span>
              </div>

              <div className="space-y-2.5">
                {filteredDevices.map((dev) => {
                  const override = draft.deviceOverrides[dev.id] ?? {};
                  const effectiveCat = inferDeviceCategory(dev, override);
                  return (
                    <div
                      key={dev.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/35 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {dev.display_name}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {roomMap.get(dev.room_id) ?? "Okänt rum"} ·{" "}
                            {dev.ha_entity_id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Energikategori för ${dev.display_name}`}
                            value={effectiveCat}
                            onChange={(e) =>
                              updateOverride(dev.id, {
                                energyCategory: e.target.value as EnergyCategory,
                              })
                            }
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                          >
                            {ENERGY_CATEGORIES_ORDER.map((cat) => (
                              <option key={cat} value={cat}>
                                {ENERGY_CATEGORY_META[cat].label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1">
                            <Zap
                              className="h-3.5 w-3.5 text-[#D49A42]"
                              aria-hidden="true"
                            />
                            <input
                              type="number"
                              min="0"
                              placeholder="W"
                              aria-label={`Märkeffekt i Watt för ${dev.display_name}`}
                              value={override.ratedWatts ?? ""}
                              onChange={(e) => {
                                const val = Number.parseFloat(e.target.value);
                                updateOverride(dev.id, {
                                  ratedWatts: Number.isFinite(val) ? val : null,
                                });
                              }}
                              className="tabular-nums w-14 bg-transparent text-xs text-[var(--text-primary)] outline-none"
                            />
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              W
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">
                            Valfri effektsensor (W)
                          </span>
                          <HAEntityPicker
                            value={override.powerEntityId ?? ""}
                            onChange={(id) =>
                              updateOverride(dev.id, {
                                powerEntityId: id.trim() || null,
                              })
                            }
                            placeholder="Koppla W-sensor..."
                          />
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">
                            Valfri energisensor (kWh)
                          </span>
                          <HAEntityPicker
                            value={override.energyEntityId ?? ""}
                            onChange={(id) =>
                              updateOverride(dev.id, {
                                energyEntityId: id.trim() || null,
                              })
                            }
                            placeholder="Koppla kWh-sensor..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#6B8E6B] px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isSaving
                ? "Sparar..."
                : scanDone
                  ? `Aktivera valda (${selectedIds.size}) & Spara`
                  : "Spara inställningar"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
