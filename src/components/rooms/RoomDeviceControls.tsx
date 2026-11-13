"use client";

import { useState } from "react";
import { Power, Sun, Thermometer, Video, Zap } from "lucide-react";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { RoomDevice } from "@/lib/supabase/types";
import { getServiceDomain, isLightType } from "./roomHelpers";

interface RoomDeviceControlsProps {
  roomName: string;
  devices: RoomDevice[];
}

/**
 * Shared grouped device controls (lights/dimmers with 0-100% slider, switches,
 * climate/sensors, and other devices) used by RoomDetailDrawer and ChildRoomView.
 */
export function RoomDeviceControls({
  roomName,
  devices,
}: RoomDeviceControlsProps) {
  const { isConnected, getEntity, callService } = useHomeAssistant();
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [brightnessDrafts, setBrightnessDrafts] = useState<
    Record<string, number>
  >({});

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

  if (devices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-6 text-center text-sm text-[var(--text-secondary)]">
        Inga enheter är kopplade till {roomName} ännu.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
}
