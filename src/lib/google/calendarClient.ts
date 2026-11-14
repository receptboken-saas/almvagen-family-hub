import { getSupabaseClient } from "@/lib/supabase/client";

export const GOOGLE_CALENDAR_SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

const GOOGLE_TOKEN_STORAGE_KEY = "almvagen_google_calendar_token";
const GOOGLE_CAL_NOTE_PREFIX = "[HUB_PREF:google_calendar]";

export interface GoogleCalendarConfig {
  calendarId: string;
  calendarSummary: string;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export function cacheGoogleProviderToken(token: string | null | undefined): void {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(
      GOOGLE_TOKEN_STORAGE_KEY,
      JSON.stringify({ token, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage errors
  }
}

export function getCachedGoogleProviderToken(
  sessionToken?: string | null,
): string | null {
  if (sessionToken) {
    cacheGoogleProviderToken(sessionToken);
    return sessionToken;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; savedAt?: number };
    if (!parsed.token || !parsed.savedAt) return null;
    // Google OAuth access tokens expire after ~60 min; treat 55 min as valid window
    if (Date.now() - parsed.savedAt > 55 * 60 * 1000) {
      window.localStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearCachedGoogleProviderToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export async function fetchGoogleCalendarConfig(
  propertyId: string | null,
): Promise<GoogleCalendarConfig | null> {
  if (!propertyId) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("family_notes")
    .select("content")
    .eq("property_id", propertyId)
    .like("content", `${GOOGLE_CAL_NOTE_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const rawJson = (data[0].content as string)
      .slice(GOOGLE_CAL_NOTE_PREFIX.length)
      .trim();
    try {
      const parsed = JSON.parse(rawJson) as Partial<GoogleCalendarConfig>;
      if (parsed.calendarId && parsed.calendarSummary) {
        return {
          calendarId: parsed.calendarId,
          calendarSummary: parsed.calendarSummary,
        };
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  return null;
}

export async function saveGoogleCalendarConfig(
  propertyId: string,
  config: GoogleCalendarConfig,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await supabase
    .from("family_notes")
    .delete()
    .eq("property_id", propertyId)
    .like("content", `${GOOGLE_CAL_NOTE_PREFIX}%`);

  await supabase.from("family_notes").insert({
    property_id: propertyId,
    author_id: null,
    author_name: "System",
    content: `${GOOGLE_CAL_NOTE_PREFIX} ${JSON.stringify(config)}`,
    is_pinned: false,
    is_done: false,
  });
}

function addOneDayISO(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listGoogleCalendars(
  accessToken: string,
): Promise<GoogleCalendarListItem[]> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Google Kalender (${res.status}): kunde inte hämta kalenderlista.`);
  }
  const json = (await res.json()) as { items?: GoogleCalendarListItem[] };
  return json.items ?? [];
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  daysAhead = 45,
): Promise<GoogleCalendarEventItem[]> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const maxDate = new Date(startOfToday);
  maxDate.setDate(maxDate.getDate() + daysAhead);

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: startOfToday.toISOString(),
    timeMax: maxDate.toISOString(),
    maxResults: "100",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Google Kalender (${res.status}): kunde inte hämta händelser.`);
  }
  const json = (await res.json()) as { items?: GoogleCalendarEventItem[] };
  return json.items ?? [];
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: {
    title: string;
    startDate: string;
    endDate?: string;
    description?: string;
  },
): Promise<void> {
  const exclusiveEnd = addOneDayISO(input.endDate || input.startDate);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.title,
        description: input.description || "Tillagd via Almvägen Family Hub",
        start: { date: input.startDate },
        end: { date: exclusiveEnd },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Google Kalender (${res.status}): kunde inte spara händelse.`);
  }
}
