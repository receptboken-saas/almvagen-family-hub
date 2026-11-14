"use client";

import { useMemo } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
} from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";

const WEATHER_LABELS: Record<string, string> = {
  sunny: "Soligt",
  "clear-night": "Klart",
  partlycloudy: "Halvklart",
  cloudy: "Molnigt",
  rainy: "Regn",
  pouring: "Skyfall",
  snowy: "Snö",
  "snowy-rainy": "Snöblandat",
  lightning: "Åska",
  "lightning-rainy": "Åska & regn",
  fog: "Dimma",
  windy: "Blåsigt",
  "windy-variant": "Blåsigt",
  hail: "Hagel",
  exceptional: "Oväder",
};

function WeatherIcon({ condition }: { condition: string }) {
  const cls = "h-4 w-4 shrink-0";
  switch (condition) {
    case "sunny":
      return <Sun className={`${cls} text-[#D49A42]`} aria-hidden="true" />;
    case "clear-night":
      return <Moon className={`${cls} text-[#D49A42]`} aria-hidden="true" />;
    case "partlycloudy":
      return <CloudSun className={`${cls} text-[#D49A42]`} aria-hidden="true" />;
    case "rainy":
    case "pouring":
      return <CloudRain className={`${cls} text-[#6B8E6B]`} aria-hidden="true" />;
    case "snowy":
    case "snowy-rainy":
    case "hail":
      return <CloudSnow className={`${cls} text-[var(--text-secondary)]`} aria-hidden="true" />;
    case "lightning":
    case "lightning-rainy":
      return <CloudLightning className={`${cls} text-[#C86D51]`} aria-hidden="true" />;
    case "fog":
      return <CloudFog className={`${cls} text-[var(--text-secondary)]`} aria-hidden="true" />;
    case "windy":
    case "windy-variant":
      return <Wind className={`${cls} text-[#6B8E6B]`} aria-hidden="true" />;
    default:
      return <Cloud className={`${cls} text-[var(--text-secondary)]`} aria-hidden="true" />;
  }
}

/**
 * Compact weather pill for the top header, auto-discovered from Home Assistant
 * `weather.*` entities without any hardcoded entity IDs.
 */
export function WeatherBadge() {
  const { isConnected, entities } = useHomeAssistant();

  const weatherEntity = useMemo(() => {
    if (!isConnected) return null;
    const candidates = Object.values(entities).filter(
      (e) =>
        e.entity_id.startsWith("weather.") &&
        e.state !== "unavailable" &&
        e.state !== "unknown",
    );
    return candidates[0] ?? null;
  }, [isConnected, entities]);

  if (!weatherEntity) return null;

  const tempRaw = weatherEntity.attributes.temperature;
  const temp =
    typeof tempRaw === "number"
      ? tempRaw
      : typeof tempRaw === "string"
        ? Number.parseFloat(tempRaw)
        : Number.NaN;
  const tempUnit =
    typeof weatherEntity.attributes.temperature_unit === "string"
      ? weatherEntity.attributes.temperature_unit
      : "°C";
  const condition = weatherEntity.state.toLowerCase();
  const conditionLabel = WEATHER_LABELS[condition] ?? weatherEntity.state;
  const friendlyName = weatherEntity.attributes.friendly_name ?? "Väder";

  const tempFormatted = Number.isFinite(temp)
    ? `${temp.toFixed(1).replace(".", ",")} ${tempUnit}`
    : null;

  return (
    <div
      title={`${friendlyName}: ${tempFormatted ? `${tempFormatted} · ` : ""}${conditionLabel}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 px-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-sm sm:h-10 sm:px-3"
    >
      <WeatherIcon condition={condition} />
      {tempFormatted && (
        <span className="tabular-nums whitespace-nowrap">{tempFormatted}</span>
      )}
      <span className="hidden whitespace-nowrap text-[var(--text-secondary)] sm:inline">
        · {conditionLabel}
      </span>
    </div>
  );
}
