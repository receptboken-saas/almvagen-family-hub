import type { EnergyPeriod } from "@/lib/energy/energyConfig";
import type { HassEntity } from "./types";

export interface HAStatisticPoint {
  start: number; // epoch ms
  end: number;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  sum?: number | null;
  state?: number | null;
  change?: number | null;
}

export type HAStatisticsMap = Record<string, HAStatisticPoint[]>;

export interface PowerPeak {
  timestamp: number;
  kw: number;
  label: string;
}

export interface PriceWindow {
  startHour: string;
  endHour: string;
  avgPriceKr: number;
  durationHours: number;
  isTomorrow: boolean;
}

export function getPeriodRange(period: EnergyPeriod): {
  startTime: Date;
  endTime: Date;
  haPeriod: "hour" | "day";
} {
  const now = new Date();
  if (period === "now" || period === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    return { startTime: startOfToday, endTime: now, haPeriod: "hour" };
  }
  if (period === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startTime: start, endTime: now, haPeriod: "hour" };
  }
  // "month": 1st of current month 00:00 -> now (matches Tibber "Innevarande månad")
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  return { startTime: startOfMonth, endTime: now, haPeriod: "hour" };
}

/**
 * Fetches long-term statistics from Home Assistant via WebSocket `recorder/statistics_during_period`.
 */
export async function fetchHAStatistics(
  sendCommand: <T = unknown>(
    type: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>,
  statisticIds: string[],
  period: EnergyPeriod,
): Promise<HAStatisticsMap> {
  const uniqueIds = Array.from(new Set(statisticIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { startTime, endTime, haPeriod } = getPeriodRange(period);

  const result = await sendCommand<HAStatisticsMap>(
    "recorder/statistics_during_period",
    {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      statistic_ids: uniqueIds,
      period: haPeriod,
      types: ["change", "sum", "mean", "min", "max", "state"],
    },
  );

  return result ?? {};
}

/**
 * Computes total kWh consumed from a list of HA statistic points.
 * Prefers `change` sum; falls back to `sum` delta or `state` delta.
 */
export function sumKwhFromStatistics(
  points: HAStatisticPoint[] | undefined,
  unit?: string | null,
): number {
  if (!points || points.length === 0) return 0;

  let total = 0;
  let hasNonZeroChange = false;
  for (const pt of points) {
    if (typeof pt.change === "number" && Number.isFinite(pt.change) && pt.change > 0) {
      hasNonZeroChange = true;
      total += pt.change;
    }
  }

  if (!hasNonZeroChange) {
    const sums = points
      .map((p) => p.sum)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (sums.length >= 2) {
      total = Math.max(0, sums[sums.length - 1] - sums[0]);
    } else {
      const states = points
        .map((p) => p.state)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (states.length >= 2) {
        total = Math.max(0, states[states.length - 1] - states[0]);
      }
    }
  }

  if ((unit ?? "").trim().toLowerCase() === "wh") {
    return total / 1000;
  }
  return total;
}

/**
 * Computes exact cost (kr) by multiplying each hour's kWh consumption by that
 * hour's recorded electricity price + grid fee, falling back to current price.
 */
export function computeHourlyWeightedCost(
  energyPoints: HAStatisticPoint[] | undefined,
  pricePoints: HAStatisticPoint[] | undefined,
  fallbackPricePerKwh: number,
  gridFeePerKwh: number,
  energyUnit?: string | null,
  priceUnit?: string | null,
): number | null {
  if (!energyPoints || energyPoints.length === 0) return null;
  if (!pricePoints || pricePoints.length === 0) return null;

  const isWh = (energyUnit ?? "").trim().toLowerCase() === "wh";
  const isOre = (priceUnit ?? "").trim().toLowerCase().includes("öre");

  const priceByHour = new Map<number, number>();
  for (const pt of pricePoints) {
    const raw = pt.mean ?? pt.state;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const kr = isOre ? raw / 100 : raw;
      // Round timestamp to hour start for reliable matching
      const hourKey = Math.floor(pt.start / 3600000);
      priceByHour.set(hourKey, kr + gridFeePerKwh);
    }
  }

  let totalCost = 0;
  let usedHours = 0;
  for (const pt of energyPoints) {
    if (typeof pt.change === "number" && Number.isFinite(pt.change) && pt.change > 0) {
      const kwh = isWh ? pt.change / 1000 : pt.change;
      const hourKey = Math.floor(pt.start / 3600000);
      const price = priceByHour.get(hourKey) ?? fallbackPricePerKwh;
      totalCost += kwh * price;
      usedHours += 1;
    }
  }

  return usedHours > 0 ? totalCost : null;
}

/**
 * Computes top N hourly power peaks (kW) from either an energy sensor (kWh/h)
 * or a power sensor (W/kW mean/max).
 */
export function extractTopPeaks(
  energyPoints: HAStatisticPoint[] | undefined,
  powerPoints: HAStatisticPoint[] | undefined,
  powerUnit?: string | null,
  count = 3,
): PowerPeak[] {
  const candidates: { timestamp: number; kw: number }[] = [];

  if (energyPoints && energyPoints.length > 0) {
    for (const pt of energyPoints) {
      if (typeof pt.change === "number" && pt.change > 0) {
        candidates.push({ timestamp: pt.start, kw: pt.change });
      }
    }
  } else if (powerPoints && powerPoints.length > 0) {
    const isKw = (powerUnit ?? "").trim().toLowerCase() === "kw";
    for (const pt of powerPoints) {
      const raw = pt.max ?? pt.mean;
      if (typeof raw === "number" && raw > 0) {
        candidates.push({
          timestamp: pt.start,
          kw: isKw ? raw : raw / 1000,
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.kw - a.kw)
    .slice(0, count)
    .map((item) => {
      const d = new Date(item.timestamp);
      const day = d.toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "short",
      });
      const hour = String(d.getHours()).padStart(2, "0");
      const nextHour = String((d.getHours() + 1) % 24).padStart(2, "0");
      return {
        timestamp: item.timestamp,
        kw: item.kw,
        label: `${day} kl ${hour}:00–${nextHour}:00`,
      };
    });
}

/**
 * Estimates nocturnal baseload (W) from 00:00–05:00 hourly points.
 */
export function estimateBaseloadWatts(
  energyPoints: HAStatisticPoint[] | undefined,
  powerPoints: HAStatisticPoint[] | undefined,
  powerUnit?: string | null,
): number | null {
  const nightWatts: number[] = [];

  if (powerPoints && powerPoints.length > 0) {
    const isKw = (powerUnit ?? "").trim().toLowerCase() === "kw";
    for (const pt of powerPoints) {
      const hour = new Date(pt.start).getHours();
      if (hour >= 0 && hour < 5) {
        const val = pt.min ?? pt.mean;
        if (typeof val === "number" && val >= 0) {
          nightWatts.push(isKw ? val * 1000 : val);
        }
      }
    }
  }

  if (nightWatts.length === 0 && energyPoints && energyPoints.length > 0) {
    for (const pt of energyPoints) {
      const hour = new Date(pt.start).getHours();
      if (hour >= 0 && hour < 5 && typeof pt.change === "number" && pt.change > 0) {
        nightWatts.push(pt.change * 1000);
      }
    }
  }

  if (nightWatts.length === 0) return null;
  nightWatts.sort((a, b) => a - b);
  // 20th percentile represents true standby baseload without occasional heat pump bursts
  const idx = Math.min(
    nightWatts.length - 1,
    Math.floor(nightWatts.length * 0.2),
  );
  return Math.round(nightWatts[idx]);
}

interface RawPriceSlot {
  startTime: number;
  priceKr: number;
  isTomorrow: boolean;
}

/**
 * Extracts upcoming cheapest 2h and 3h windows from a HA electricity price entity
 * (supports Nordpool/Tibber attribute shapes like `raw_today`/`raw_tomorrow` or `today`/`tomorrow`).
 */
export function findCheapestPriceWindows(
  priceEntity: HassEntity | undefined,
  gridFeePerKwh: number,
): PriceWindow[] {
  if (!priceEntity) return [];
  const attrs = priceEntity.attributes as Record<string, unknown>;
  const now = Date.now();
  const slots: RawPriceSlot[] = [];

  const parseArray = (arr: unknown, dayOffset: number) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item, idx) => {
      if (typeof item === "number") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const startMs = d.getTime() + (dayOffset * 24 + idx) * 3600 * 1000;
        slots.push({
          startTime: startMs,
          priceKr: item + gridFeePerKwh,
          isTomorrow: dayOffset > 0,
        });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const val =
          typeof obj.value === "number"
            ? obj.value
            : typeof obj.total === "number"
              ? obj.total
              : typeof obj.price === "number"
                ? obj.price
                : null;
        const startRaw =
          typeof obj.start === "string"
            ? obj.start
            : typeof obj.startsAt === "string"
              ? obj.startsAt
              : null;
        if (val !== null && startRaw) {
          const parsed = Date.parse(startRaw);
          if (!Number.isNaN(parsed)) {
            slots.push({
              startTime: parsed,
              priceKr: val + gridFeePerKwh,
              isTomorrow: dayOffset > 0,
            });
          }
        }
      }
    });
  };

  parseArray(attrs.raw_today ?? attrs.today, 0);
  parseArray(attrs.raw_tomorrow ?? attrs.tomorrow, 1);

  const upcoming = slots
    .filter((s) => s.startTime + 3600 * 1000 > now)
    .sort((a, b) => a.startTime - b.startTime);

  if (upcoming.length < 2) return [];

  const findBest = (durationHours: number): PriceWindow | null => {
    if (upcoming.length < durationHours) return null;
    let bestIdx = 0;
    let bestAvg = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= upcoming.length - durationHours; i++) {
      let sum = 0;
      for (let j = 0; j < durationHours; j++) {
        sum += upcoming[i + j].priceKr;
      }
      const avg = sum / durationHours;
      if (avg < bestAvg) {
        bestAvg = avg;
        bestIdx = i;
      }
    }

    const start = new Date(upcoming[bestIdx].startTime);
    const end = new Date(
      upcoming[bestIdx + durationHours - 1].startTime + 3600 * 1000,
    );
    return {
      startHour: `${String(start.getHours()).padStart(2, "0")}:00`,
      endHour: `${String(end.getHours()).padStart(2, "0")}:00`,
      avgPriceKr: bestAvg,
      durationHours,
      isTomorrow: upcoming[bestIdx].isTomorrow,
    };
  };

  const w2 = findBest(2);
  const w3 = findBest(3);
  return [w2, w3].filter((w): w is PriceWindow => w !== null);
}
