import type { EnergyPeriod } from "@/lib/energy/energyConfig";
import type { PowerPeak, PriceWindow } from "@/lib/ha/energyStats";

export interface TibberDailyNode {
  from: string;
  to: string;
  consumption: number | null;
  cost: number | null;
}

export interface TibberHourlyNode {
  from: string;
  to: string;
  consumption: number | null;
  cost: number | null;
}

export interface TibberPriceNode {
  total: number;
  startsAt: string;
}

export interface TibberSyncData {
  homeName: string;
  currentPriceKr: number | null;
  todayPrices: TibberPriceNode[];
  tomorrowPrices: TibberPriceNode[];
  dailyNodes: TibberDailyNode[];
  hourlyNodes: TibberHourlyNode[];
}

const TIBBER_GQL_URL = "https://api.tibber.com/v1-beta/gql";

const TIBBER_QUERY = `
query AlmvagenTibberSync {
  viewer {
    homes {
      appNickname
      address {
        address1
      }
      currentSubscription {
        priceInfo {
          current {
            total
            startsAt
          }
          today {
            total
            startsAt
          }
          tomorrow {
            total
            startsAt
          }
        }
      }
      daily: consumption(resolution: DAILY, last: 35) {
        nodes {
          from
          to
          consumption
          cost
        }
      }
      hourly: consumption(resolution: HOURLY, last: 168) {
        nodes {
          from
          to
          consumption
          cost
        }
      }
    }
  }
}
`;

interface TibberGqlResponse {
  data?: {
    viewer?: {
      homes?: Array<{
        appNickname?: string | null;
        address?: { address1?: string | null } | null;
        currentSubscription?: {
          priceInfo?: {
            current?: TibberPriceNode | null;
            today?: TibberPriceNode[] | null;
            tomorrow?: TibberPriceNode[] | null;
          } | null;
        } | null;
        daily?: { nodes?: TibberDailyNode[] | null } | null;
        hourly?: { nodes?: TibberHourlyNode[] | null } | null;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
}

export async function fetchTibberData(
  token: string,
): Promise<TibberSyncData | null> {
  const clean = token.trim();
  if (!clean) return null;

  const res = await fetch(TIBBER_GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clean}`,
    },
    body: JSON.stringify({ query: TIBBER_QUERY }),
  });

  if (!res.ok) {
    throw new Error(`Tibber API svarade med HTTP ${res.status}.`);
  }

  const json = (await res.json()) as TibberGqlResponse;
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || "Tibber API-fel.");
  }

  const home = json.data?.viewer?.homes?.[0];
  if (!home) return null;

  const priceInfo = home.currentSubscription?.priceInfo;

  return {
    homeName: home.appNickname || home.address?.address1 || "Tibber Hem",
    currentPriceKr: priceInfo?.current?.total ?? null,
    todayPrices: priceInfo?.today ?? [],
    tomorrowPrices: priceInfo?.tomorrow ?? [],
    dailyNodes: home.daily?.nodes ?? [],
    hourlyNodes: home.hourly?.nodes ?? [],
  };
}

export function computeTibberPeriodTotals(
  tibber: TibberSyncData,
  period: EnergyPeriod,
): { kwh: number; costKr: number } {
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
    ).getTime();

    let kwh = 0;
    let costKr = 0;
    for (const n of tibber.hourlyNodes) {
      const ts = Date.parse(n.from);
      if (!Number.isNaN(ts) && ts >= startOfToday) {
        if (typeof n.consumption === "number") kwh += n.consumption;
        if (typeof n.cost === "number") costKr += n.cost;
      }
    }
    return { kwh, costKr };
  }

  if (period === "7d") {
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    let kwh = 0;
    let costKr = 0;
    for (const n of tibber.dailyNodes) {
      const ts = Date.parse(n.from);
      if (!Number.isNaN(ts) && ts >= cutoff) {
        if (typeof n.consumption === "number") kwh += n.consumption;
        if (typeof n.cost === "number") costKr += n.cost;
      }
    }
    return { kwh, costKr };
  }

  // "month": 1st of current month -> now
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  ).getTime();

  let kwh = 0;
  let costKr = 0;
  for (const n of tibber.dailyNodes) {
    const ts = Date.parse(n.from);
    if (!Number.isNaN(ts) && ts >= startOfMonth) {
      if (typeof n.consumption === "number") kwh += n.consumption;
      if (typeof n.cost === "number") costKr += n.cost;
    }
  }
  return { kwh, costKr };
}

export function extractTibberPeaks(
  tibber: TibberSyncData,
  count = 3,
): PowerPeak[] {
  return tibber.hourlyNodes
    .filter((n) => typeof n.consumption === "number" && n.consumption > 0)
    .sort((a, b) => (b.consumption ?? 0) - (a.consumption ?? 0))
    .slice(0, count)
    .map((n) => {
      const d = new Date(n.from);
      const day = d.toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "short",
      });
      const hour = String(d.getHours()).padStart(2, "0");
      const nextHour = String((d.getHours() + 1) % 24).padStart(2, "0");
      return {
        timestamp: d.getTime(),
        kw: n.consumption ?? 0,
        label: `${day} kl ${hour}:00–${nextHour}:00`,
      };
    });
}

export function estimateTibberBaseloadWatts(
  tibber: TibberSyncData,
): number | null {
  const nightWatts: number[] = [];
  for (const n of tibber.hourlyNodes) {
    const d = new Date(n.from);
    const hour = d.getHours();
    if (hour >= 0 && hour < 5 && typeof n.consumption === "number" && n.consumption > 0) {
      nightWatts.push(n.consumption * 1000);
    }
  }
  if (nightWatts.length === 0) return null;
  nightWatts.sort((a, b) => a - b);
  const idx = Math.min(nightWatts.length - 1, Math.floor(nightWatts.length * 0.2));
  return Math.round(nightWatts[idx]);
}

export function findTibberCheapestWindows(
  tibber: TibberSyncData,
  gridFeePerKwh: number,
): PriceWindow[] {
  const now = Date.now();
  const slots = [
    ...tibber.todayPrices.map((p) => ({
      startTime: Date.parse(p.startsAt),
      priceKr: p.total + gridFeePerKwh,
      isTomorrow: false,
    })),
    ...tibber.tomorrowPrices.map((p) => ({
      startTime: Date.parse(p.startsAt),
      priceKr: p.total + gridFeePerKwh,
      isTomorrow: true,
    })),
  ]
    .filter((s) => !Number.isNaN(s.startTime) && s.startTime + 3600 * 1000 > now)
    .sort((a, b) => a.startTime - b.startTime);

  const findBest = (durationHours: number): PriceWindow | null => {
    if (slots.length < durationHours) return null;
    let bestIdx = 0;
    let bestAvg = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= slots.length - durationHours; i++) {
      let sum = 0;
      for (let j = 0; j < durationHours; j++) sum += slots[i + j].priceKr;
      const avg = sum / durationHours;
      if (avg < bestAvg) {
        bestAvg = avg;
        bestIdx = i;
      }
    }
    const start = new Date(slots[bestIdx].startTime);
    const end = new Date(slots[bestIdx + durationHours - 1].startTime + 3600 * 1000);
    return {
      startHour: `${String(start.getHours()).padStart(2, "0")}:00`,
      endHour: `${String(end.getHours()).padStart(2, "0")}:00`,
      avgPriceKr: bestAvg,
      durationHours,
      isTomorrow: slots[bestIdx].isTomorrow,
    };
  };

  return [findBest(2), findBest(3)].filter((w): w is PriceWindow => w !== null);
}
