"use client";

import { useState } from "react";
import {
  Flame,
  Minus,
  Plus,
  Power,
  Shield,
  Sun,
  Thermometer,
  Video,
  Zap,
} from "lucide-react";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { RoomDevice } from "@/lib/supabase/types";
import {
  getServiceDomain,
  groupRoomDevicesByTab,
  type RoomTabId,
} from "./roomHelpers";

interface RoomDeviceControlsProps {
  roomName: string;
  devices: RoomDevice[];
  activeTab?: RoomTabId;
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `för ${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `för ${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  return `för ${days} d sedan`;
}

function formatSecurityState(state: string | undefined, deviceClass?: string): string {
  if (!state || state === "unavailable" || state === "unknown") return "—";
  if (state === "on" || state === "open") {
    if (deviceClass === "motion" || deviceClass === "occupancy") return "Rörelse";
    if (deviceClass === "door" || deviceClass === "window" || deviceClass === "opening") {
      return "Öppen";
    }
    return "Aktiv";
  }
  if (state === "off" || state === "closed") {
    if (deviceClass === "motion" || deviceClass === "occupancy") return "Lugnt";
    if (deviceClass === "door" || deviceClass === "window" || deviceClass === "opening") {
      return "Stängd";
    }
    return "Inaktiv";
  }
  if (state === "locked") return "Låst";
  if (state === "unlocked") return "Olåst";
  return state;
}

/**
 * Shared grouped device controls supporting both full view (ChildRoomView)
 * and tab-filtered Room Hub view (RoomDetailDrawer).
 */
export function RoomDeviceControls({
  roomName,
  devices,
  activeTab,
}: RoomDeviceControlsProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [brightnessDrafts, setBrightnessDrafts] = useState<
    Record<string, number>
  >({});

  const grouped = groupRoomDevicesByTab(devices, getEntity);
  const lights = grouped.lights.filter((d) => d.widget_type !== "switch");
  const switches = grouped.lights.filter((d) => d.widget_type === "switch");
  const climateDevices = grouped.climate;
  const securityDevices = grouped.security;
  const otherDevices = grouped.other;

  const showLights = !activeTab || activeTab === "lights";
  const showClimate = !activeTab || activeTab === "climate";
  const showSecurity = !activeTab || activeTab === "security";
  const showOther = !activeTab || activeTab === "other";

  async function toggleLight(device: RoomDevice) {
    if (!isConnected || busyIds[device.id]) return;
    const entity = getEntity(device.ha_entity_id);
    const isOn = entity?.state === "on";
    const domain = getServiceDomain(device.ha_entity_id, device.widget_type);

    setBusyIds((prev) => ({ ...prev, [device.id]: true }));
    try {
      await callService(domain, isOn ? "turn_off" : "turn_on", {
        entity_id: device.ha_entity_id,
      });
    } catch {
      // Ignore transient errors
    } finally {
      setBusyIds((prev) => ({ ...prev, [device.id]: false }));
    }
  }

  async function toggleSwitch(device: RoomDevice) {
    if (!isConnected || busyIds[device.id]) return;
    setBusyIds((prev) => ({ ...prev, [device.id]: true }));
    try {
      await callService("switch", "toggle", {
        entity_id: device.ha_entity_id,
      });
    } catch {
      // Ignore transient errors
    } finally {
      setBusyIds((prev) => ({ ...prev, [device.id]: false }));
    }
  }

  async function commitBrightness(device: RoomDevice, pct: number) {
    if (!isConnected) return;
    try {
      if (pct <= 0) {
        await callService("light", "turn_off", {
          entity_id: device.ha_entity_id,
        });
      } else {
        await callService("light", "turn_on", {
          entity_id: device.ha_entity_id,
          brightness_pct: pct,
        });
      }
    } catch {
      // Ignore transient errors
    }
  }

  async function adjustTargetTemp(device: RoomDevice, nextTemp: number) {
    if (!isConnected || busyIds[device.id]) return;
    setBusyIds((prev) => ({ ...prev, [device.id]: true }));
    try {
      await callService("climate", "set_temperature", {
        entity_id: device.ha_entity_id,
        temperature: nextTemp,
      });
    } catch {
      // Ignore transient errors
    } finally {
      setBusyIds((prev) => ({ ...prev, [device.id]: false }));
    }
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-6 text-center text-sm text-[var(--text-secondary)]">
        Inga enheter är kopplade till {roomName} ännu.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showLights && lights.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <Sun className="h-3.5 w-3.5 text-[#D49A42]" />
            <span>Belysning ({lights.length})</span>
          </h3>
          <div className="space-y-2.5">
            {lights.map((device) => {
              const entity = isConnected
                ? getEntity(device.ha_entity_id)
                : undefined;
              const isOn = entity?.state === "on";
              const rawBrightness = entity?.attributes.brightness;
              const entityPct =
                typeof rawBrightness === "number"
                  ? Math.round((rawBrightness / 255) * 100)
                  : isOn
                    ? 100
                    : 0;
              const sliderValue = brightnessDrafts[device.id] ?? entityPct;
              const supportedModes = entity?.attributes.supported_color_modes;
              const supportsDimming =
                device.widget_type === "dimmer" ||
                typeof rawBrightness === "number" ||
                !(
                  Array.isArray(supportedModes) &&
                  supportedModes.length === 1 &&
                  supportedModes[0] === "onoff"
                );

              return (
                <div
                  key={device.id}
                  className={`space-y-3 rounded-2xl border p-4 transition-colors ${
                    isOn
                      ? "border-[#D49A42]/50 bg-[#D49A42]/10"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {device.display_name}
                      </p>
                      <p className="tabular-nums text-xs text-[var(--text-secondary)]">
                        {!isConnected
                          ? "Väntar på HA"
                          : isOn
                            ? supportsDimming
                              ? `På · ${sliderValue} %`
                              : "På"
                            : "Av"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!isConnected || busyIds[device.id]}
                      onClick={() => toggleLight(device)}
                      aria-label={`${isOn ? "Släck" : "Tänd"} ${device.display_name}`}
                      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition-colors ${
                        isOn
                          ? "border-[#D49A42] bg-[#D49A42] text-white"
                          : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      } disabled:opacity-40`}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>

                  {supportsDimming && (
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        disabled={!isConnected}
                        value={sliderValue}
                        aria-label={`Ljusstyrka för ${device.display_name}`}
                        onChange={(e) =>
                          setBrightnessDrafts((prev) => ({
                            ...prev,
                            [device.id]: Number(e.target.value),
                          }))
                        }
                        onPointerUp={(e) => {
                          const val = Number(
                            (e.target as HTMLInputElement).value,
                          );
                          void commitBrightness(device, val);
                          setBrightnessDrafts((prev) => {
                            const copy = { ...prev };
                            delete copy[device.id];
                            return copy;
                          });
                        }}
                        onKeyUp={(e) => {
                          const val = Number(
                            (e.target as HTMLInputElement).value,
                          );
                          void commitBrightness(device, val);
                        }}
                        className="h-2 w-full cursor-pointer accent-[#D49A42] disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      <span className="tabular-nums w-11 text-right text-xs font-semibold text-[var(--text-secondary)]">
                        {sliderValue} %
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showLights && switches.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <Zap className="h-3.5 w-3.5 text-[#6B8E6B]" />
            <span>Brytare ({switches.length})</span>
          </h3>
          <div className="space-y-2">
            {switches.map((device) => {
              const entity = isConnected
                ? getEntity(device.ha_entity_id)
                : undefined;
              const isOn = entity?.state === "on";
              return (
                <button
                  key={device.id}
                  type="button"
                  disabled={!isConnected || busyIds[device.id]}
                  onClick={() => toggleSwitch(device)}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isOn
                      ? "border-[#6B8E6B]/60 bg-[#6B8E6B]/15 text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  } disabled:opacity-45`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {device.display_name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {isConnected ? (isOn ? "På" : "Av") : "Offline"}
                    </p>
                  </div>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isOn
                        ? "bg-[#6B8E6B] text-white"
                        : "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <Power className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showClimate && climateDevices.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <Thermometer className="h-3.5 w-3.5 text-[#C86D51]" />
            <span>Värme &amp; Klimat ({climateDevices.length})</span>
          </h3>
          <div className="space-y-2.5">
            {climateDevices.map((device) => {
              const entity = isConnected
                ? getEntity(device.ha_entity_id)
                : undefined;

              if (device.widget_type === "climate") {
                const currentTemp = entity?.attributes.current_temperature;
                const targetTemp = entity?.attributes.temperature;
                const humidity = entity?.attributes.current_humidity;
                const hvacAction = entity?.attributes.hvac_action as
                  | string
                  | undefined;
                const isHeating = hvacAction === "heating";
                const numericTarget =
                  typeof targetTemp === "number" ? targetTemp : 20;

                return (
                  <div
                    key={device.id}
                    className={`space-y-3 rounded-2xl border p-4 ${
                      isHeating
                        ? "border-[#C86D51]/50 bg-[#C86D51]/10"
                        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {device.display_name}
                          </p>
                          {isHeating && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#C86D51]/20 px-2 py-0.5 text-[10px] font-semibold text-[#C86D51]">
                              <Flame className="h-3 w-3" />
                              Värmer
                            </span>
                          )}
                        </div>
                        <p className="tabular-nums mt-0.5 text-xs text-[var(--text-secondary)]">
                          Nu:{" "}
                          <strong className="text-[var(--text-primary)]">
                            {typeof currentTemp === "number"
                              ? `${currentTemp.toFixed(1)}°C`
                              : "—"}
                          </strong>
                          {typeof humidity === "number" && ` · ${humidity} % fukt`}
                          {entity?.state && ` · Läge: ${entity.state}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!isConnected || busyIds[device.id]}
                          onClick={() =>
                            adjustTargetTemp(
                              device,
                              Math.round((numericTarget - 0.5) * 2) / 2,
                            )
                          }
                          aria-label={`Sänk måltemperatur för ${device.display_name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[#C86D51] disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="tabular-nums min-w-14 text-center text-sm font-bold text-[var(--text-primary)]">
                          {typeof targetTemp === "number"
                            ? `${targetTemp.toFixed(1)}°`
                            : "—"}
                        </span>
                        <button
                          type="button"
                          disabled={!isConnected || busyIds[device.id]}
                          onClick={() =>
                            adjustTargetTemp(
                              device,
                              Math.round((numericTarget + 0.5) * 2) / 2,
                            )
                          }
                          aria-label={`Höj måltemperatur för ${device.display_name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[#C86D51] disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const unit = entity?.attributes.unit_of_measurement ?? "";
              const value =
                entity &&
                entity.state !== "unavailable" &&
                entity.state !== "unknown"
                  ? `${entity.state}${unit ? ` ${unit}` : ""}`
                  : "—";

              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
                      {device.display_name}
                    </p>
                    <p className="tabular-nums mt-0.5 text-base font-semibold text-[var(--text-primary)]">
                      {value}
                    </p>
                  </div>
                  <DynamicIcon
                    name={
                      unit === "%" || device.ha_entity_id.includes("humid")
                        ? "ctrl_fukt"
                        : "ctrl_temp"
                    }
                    className="h-5 w-5 shrink-0 text-[#C86D51]"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showSecurity && securityDevices.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <Shield className="h-3.5 w-3.5 text-[#6B8E6B]" />
            <span>Säkerhet &amp; Sensorer ({securityDevices.length})</span>
          </h3>
          <div className="space-y-2">
            {securityDevices.map((device) => {
              const entity = isConnected
                ? getEntity(device.ha_entity_id)
                : undefined;
              const isAlert =
                entity?.state === "on" ||
                entity?.state === "open" ||
                entity?.state === "unlocked";
              const statusText = formatSecurityState(
                entity?.state,
                entity?.attributes.device_class,
              );
              const changedText = formatRelativeTime(entity?.last_changed);

              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    isAlert
                      ? "border-[#C86D51]/50 bg-[#C86D51]/10"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {device.display_name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {changedText || "Realtidssensor"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      isAlert
                        ? "bg-[#C86D51] text-white"
                        : "bg-[#6B8E6B]/15 text-[#6B8E6B]"
                    }`}
                  >
                    {statusText}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showOther && otherDevices.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <Video className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span>Övrigt &amp; Energi ({otherDevices.length})</span>
          </h3>
          <div className="space-y-2">
            {otherDevices.map((device) => {
              const entity = isConnected
                ? getEntity(device.ha_entity_id)
                : undefined;
              const unit = entity?.attributes.unit_of_measurement ?? "";
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {device.display_name}
                    </p>
                    <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                      {device.ha_entity_id}
                    </p>
                  </div>
                  <span className="tabular-nums rounded-lg bg-[var(--bg-card)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    {entity ? `${entity.state}${unit ? ` ${unit}` : ""}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
