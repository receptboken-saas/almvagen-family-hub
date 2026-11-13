"use client";

import { useEffect, useState } from "react";
import { Power, Sun, Thermometer, Video, X, Zap } from "lucide-react";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { Room, RoomDevice } from "@/lib/supabase/types";
import {
  bulkToggleRoomDevices,
  getRoomTemperatureDisplay,
  getServiceDomain,
  isControllableType,
  isLightType,
} from "./roomHelpers";

interface RoomDetailDrawerProps {
  room: Room | null;
  floorName?: string;
  devices: RoomDevice[];
  onClose: () => void;
}

/**
 * Responsive detail drawer (right slide-over on tablet/desktop, bottom-sheet on mobile)
 * displaying all devices in a room grouped by category with dimmer sliders and toggles.
 */
export function RoomDetailDrawer({
  room,
  floorName,
  devices,
  onClose,
}: RoomDetailDrawerProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [brightnessDrafts, setBrightnessDrafts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!room) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [room, onClose]);

  if (!room) return null;

  const lights = devices.filter((d) => isLightType(d.widget_type));
  const switches = devices.filter((d) => d.widget_type === "switch");
  const climateSensors = devices.filter(
    (d) =>
      d.widget_type === "climate" ||
      d.widget_type === "sensor" ||
      d.widget_type === "energy",
  );
  const otherDevices = devices.filter(
    (d) =>
      !isLightType(d.widget_type) &&
      d.widget_type !== "switch" &&
      d.widget_type !== "climate" &&
      d.widget_type !== "sensor" &&
      d.widget_type !== "energy",
  );

  const controllableDevices = devices.filter((d) =>
    isControllableType(d.widget_type),
  );
  const tempDisplay = getRoomTemperatureDisplay(
    devices,
    isConnected,
    getEntity,
  );

  async function handleBulk(turnOn: boolean) {
    if (!isConnected || controllableDevices.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await bulkToggleRoomDevices(controllableDevices, turnOn, callService);
    } catch {
      // Ignore transient errors
    } finally {
      setBulkBusy(false);
    }
  }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-stretch sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Detaljvy för ${room.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl sm:h-full sm:max-h-none sm:max-w-lg sm:rounded-l-3xl sm:rounded-tr-none">
        {/* Header */}
        <div className="space-y-4 border-b border-[var(--border-subtle)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
                <DynamicIcon name={room.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                {floorName && (
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {floorName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display truncate text-2xl font-semibold text-[var(--text-primary)]">
                    {room.name}
                  </h2>
                  {tempDisplay && (
                    <span className="tabular-nums inline-flex items-center gap-1 rounded-xl bg-[#C86D51]/12 px-2.5 py-1 text-xs font-semibold text-[#C86D51]">
                      <Thermometer className="h-3.5 w-3.5" />
                      <span>{tempDisplay}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Stäng rumsdetaljer"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {controllableDevices.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(true)}
                className="min-h-11 rounded-xl bg-[#D49A42]/20 px-4 text-xs font-semibold text-[#D49A42] transition-colors hover:bg-[#D49A42]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tänd alla
              </button>
              <button
                type="button"
                disabled={!isConnected || bulkBusy}
                onClick={() => handleBulk(false)}
                className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Släck alla
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {devices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-6 text-center text-sm text-[var(--text-secondary)]">
              Inga enheter är kopplade till {room.name} ännu.
            </div>
          ) : (
            <>
              {/* Lights & Dimmers */}
              {lights.length > 0 && (
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
                      const sliderValue =
                        brightnessDrafts[device.id] ?? entityPct;
                      const supportedModes =
                        entity?.attributes.supported_color_modes;
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
                                  commitBrightness(device, val);
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
                                  commitBrightness(device, val);
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

              {/* Switches */}
              {switches.length > 0 && (
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

              {/* Climate & Sensors */}
              {climateSensors.length > 0 && (
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Thermometer className="h-3.5 w-3.5 text-[#C86D51]" />
                    <span>Klimat &amp; Sensorer ({climateSensors.length})</span>
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {climateSensors.map((device) => {
                      const entity = isConnected
                        ? getEntity(device.ha_entity_id)
                        : undefined;
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
                              device.widget_type === "energy"
                                ? "sys_tibber_pulse"
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

              {/* Other devices (e.g. camera) */}
              {otherDevices.length > 0 && (
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Video className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span>Övrigt ({otherDevices.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {otherDevices.map((device) => {
                      const entity = isConnected
                        ? getEntity(device.ha_entity_id)
                        : undefined;
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
                            {entity?.state ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
