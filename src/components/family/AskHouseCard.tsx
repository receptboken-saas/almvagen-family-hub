"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  DashboardWidget,
  DinnerPlan,
  Floor,
  Room,
  RoomDevice,
  WeeklyEvent,
} from "@/lib/supabase/types";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { Card } from "@/components/ui/Card";

interface AskHouseCardProps {
  propertyId: string | null;
  propertyName?: string | null;
  floors: Floor[];
  rooms: Room[];
  roomDevices: RoomDevice[];
  widgets: DashboardWidget[];
  weeklyEvents: WeeklyEvent[];
  dinnerPlans: DinnerPlan[];
  compactCollapsible?: boolean;
}

const QUICK_QUESTIONS = [
  "Vilka lampor lyser?",
  "Hur ser veckan ut?",
  "Vad blir det till middag?",
];

interface AskHouseResponse {
  answer?: string;
  reply?: string;
  message?: string;
  text?: string;
  error?: string;
}

async function extractInvokeError(err: unknown): Promise<string> {
  if (!err || typeof err !== "object") {
    return "Kunde inte nå Gemini-assistenten just nu.";
  }
  const record = err as {
    message?: string;
    context?: Response;
  };
  if (record.context && typeof record.context.json === "function") {
    try {
      const payload = (await record.context.clone().json()) as {
        error?: string;
        message?: string;
      };
      if (payload.error) return payload.error;
      if (payload.message) return payload.message;
    } catch {
      // Ignore JSON parse errors
    }
  }
  return record.message || "Kunde inte nå Gemini-assistenten just nu.";
}

/**
 * Compact AI assistant card ("Fråga Almvägen") powered by Supabase Edge Function
 * `gemini-hub-assistant` (`action: 'ask_house'`) with live HA + Supabase context.
 */
export function AskHouseCard({
  propertyId,
  propertyName,
  floors,
  rooms,
  roomDevices,
  widgets,
  weeklyEvents,
  dinnerPlans,
  compactCollapsible = false,
}: AskHouseCardProps) {
  const { isConnected, getEntity } = useHomeAssistant();

  const [expanded, setExpanded] = useState(!compactCollapsible);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const floorNameById = useMemo(
    () => new Map(floors.map((f) => [f.id, f.name])),
    [floors],
  );

  function buildHouseContext() {
    const roomsSnapshot = rooms.map((room) => {
      const devices = roomDevices
        .filter((d) => d.room_id === room.id)
        .map((device) => {
          const entity = getEntity(device.ha_entity_id);
          const attrs = entity?.attributes ?? {};
          const relevantAttrs: Record<string, unknown> = {};

          if (attrs.current_temperature !== undefined) {
            relevantAttrs.current_temperature = attrs.current_temperature;
          }
          if (attrs.temperature !== undefined) {
            relevantAttrs.target_temperature = attrs.temperature;
          }
          if (attrs.hvac_action !== undefined) {
            relevantAttrs.hvac_action = attrs.hvac_action;
          }
          if (attrs.unit_of_measurement !== undefined) {
            relevantAttrs.unit = attrs.unit_of_measurement;
          }
          if (attrs.brightness !== undefined && typeof attrs.brightness === "number") {
            relevantAttrs.brightness_pct = Math.round(
              (attrs.brightness / 255) * 100,
            );
          }

          return {
            name: device.display_name,
            type: device.widget_type,
            state: entity?.state ?? "unknown",
            ...relevantAttrs,
          };
        });

      return {
        room: room.name,
        floor: floorNameById.get(room.floor_id) ?? null,
        devices,
      };
    });

    const widgetsSnapshot = widgets.map((w) => {
      const entity = getEntity(w.ha_entity_id);
      const unitAttr = entity?.attributes?.unit_of_measurement;
      return {
        title: w.title,
        category: w.widget_category,
        state: entity?.state ?? "unknown",
        unit: w.unit ?? (typeof unitAttr === "string" ? unitAttr : null),
      };
    });

    return {
      today: new Date().toISOString().slice(0, 10),
      property: propertyName ?? null,
      ha_connected: isConnected,
      rooms: roomsSnapshot,
      widgets: widgetsSnapshot,
      weekly_events: weeklyEvents.slice(0, 20).map((ev) => ({
        title: ev.title,
        subtitle: ev.subtitle,
        category: ev.category,
        start_date: ev.start_date,
        end_date: ev.end_date,
      })),
      dinner_plans: dinnerPlans.map((d) => ({
        date: d.meal_date,
        dish: d.dish_name,
        notes: d.notes,
      })),
    };
  }

  async function askGemini(rawQuestion: string) {
    const cleanQuestion = rawQuestion.trim();
    const supabase = getSupabaseClient();
    if (!supabase || !propertyId || !cleanQuestion || isAsking) return;

    setIsAsking(true);
    setError(null);
    setAnswer(null);
    setAskedQuestion(cleanQuestion);

    try {
      const houseContext = buildHouseContext();
      const { data, error: invokeError } =
        await supabase.functions.invoke<AskHouseResponse>(
          "gemini-hub-assistant",
          {
            body: {
              action: "ask_house",
              property_id: propertyId,
              payload: {
                question: cleanQuestion,
                house_context: houseContext,
              },
            },
          },
        );

      if (invokeError) {
        setError(await extractInvokeError(invokeError));
      } else if (data?.error) {
        setError(data.error);
      } else {
        const text =
          data?.answer ??
          data?.reply ??
          data?.message ??
          data?.text ??
          "Inget svar mottogs från Gemini.";
        setAnswer(text);
        setQuestion("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Fel vid kontakt med Gemini.",
      );
    } finally {
      setIsAsking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void askGemini(question);
  }

  function handleClear() {
    setAnswer(null);
    setAskedQuestion(null);
    setError(null);
    setQuestion("");
  }

  if (!propertyId) return null;

  if (compactCollapsible && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left transition-colors hover:border-[#6B8E6B]/60"
        style={{ boxShadow: "var(--card-shadow)" }}
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D49A42]/15 text-[#D49A42]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Fråga Almvägen
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            Lampor, värme, vecka…
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
      </button>
    );
  }

  return (
    <Card className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D49A42]/15 text-[#D49A42]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Fråga Almvägen
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Smart överblick över hem, vecka &amp; middag
            </p>
          </div>
        </div>

        {compactCollapsible && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Fäll ihop Fråga Almvägen"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isAsking}
          placeholder="Fråga Almvägen... t.ex. Vilka lampor lyser? eller När är Kornelia ledig?"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/65 focus:border-[#6B8E6B] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isAsking || !question.trim()}
          aria-label="Skicka fråga"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#6B8E6B] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isAsking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Fråga</span>
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={isAsking}
            onClick={() => {
              setQuestion(preset);
              void askGemini(preset);
            }}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[#6B8E6B]/60 hover:bg-[#6B8E6B]/10 hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {preset}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-3.5 py-2.5 text-xs text-[#C86D51]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {answer && (
        <div className="space-y-2 rounded-2xl border border-[#6B8E6B]/30 bg-[#6B8E6B]/10 p-4">
          <div className="flex items-start justify-between gap-2">
            {askedQuestion && (
              <p className="text-xs font-semibold text-[#6B8E6B]">
                {askedQuestion}
              </p>
            )}
            <button
              type="button"
              onClick={handleClear}
              aria-label="Rensa svar"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3 w-3" />
              <span>Rensa</span>
            </button>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-primary)]">
            {answer}
          </p>
        </div>
      )}
    </Card>
  );
}
