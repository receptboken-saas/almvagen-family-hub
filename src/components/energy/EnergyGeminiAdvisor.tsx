"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  fetchEnergyAiCache,
  saveEnergyAiCache,
  type EnergyAiAnalysisCache,
} from "@/lib/energy/energyConfig";
import type { EnergyDashboardSummary } from "@/lib/energy/energyEngine";
import { getSupabaseClient } from "@/lib/supabase/client";

interface EnergyGeminiAdvisorProps {
  propertyId: string | null;
  propertyName: string;
  summary: EnergyDashboardSummary;
  gridOperator?: string | null;
  municipality?: string | null;
  gridTariffSummary?: string | null;
}

interface GeminiResponse {
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

function parseStructuredAdvice(
  rawText: string,
  period: EnergyDashboardSummary["period"],
): EnergyAiAnalysisCache {
  const clean = rawText.trim();
  // Try extracting JSON block if Gemini followed the JSON format
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        summary?: string;
        tips?: string[];
        estimatedMonthlySavingKr?: string;
      };
      if (parsed.summary && Array.isArray(parsed.tips) && parsed.tips.length > 0) {
        return {
          summary: parsed.summary,
          tips: parsed.tips.slice(0, 3),
          estimatedMonthlySavingKr: parsed.estimatedMonthlySavingKr ?? null,
          generatedAt: new Date().toISOString(),
          period,
        };
      }
    } catch {
      // Fallback to line parsing
    }
  }

  // Fallback: split lines into summary + bullet tips
  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const tips = lines
    .filter((l) => /^[-*•\d]/.test(l))
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .slice(0, 3);
  const summaryLines = lines.filter((l) => !/^[-*•\d]/.test(l));

  return {
    summary: summaryLines.join(" ") || clean,
    tips,
    estimatedMonthlySavingKr: null,
    generatedAt: new Date().toISOString(),
    period,
  };
}

export function EnergyGeminiAdvisor({
  propertyId,
  propertyName,
  summary,
  gridOperator,
  municipality,
  gridTariffSummary,
}: EnergyGeminiAdvisorProps) {
  const [cache, setCache] = useState<EnergyAiAnalysisCache | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    fetchEnergyAiCache(propertyId).then((loaded) => {
      if (active && loaded) setCache(loaded);
    });
    return () => {
      active = false;
    };
  }, [propertyId]);

  function buildEnergyContext() {
    return {
      today: new Date().toISOString().slice(0, 10),
      property: propertyName,
      ha_connected: true,
      rooms: [],
      widgets: [],
      weekly_events: [],
      dinner_plans: [],
      energy_summary: {
        municipality: municipality ?? undefined,
        grid_operator: gridOperator ?? undefined,
        grid_tariff_summary: gridTariffSummary ?? undefined,
        period: summary.period,
        live_total_watts: Math.round(summary.liveTotalWatts),
        fuse_load_pct: summary.fuseLoadPct,
        total_kwh: Number(summary.totalKwh.toFixed(2)),
        total_cost_kr: Number(summary.totalCostKr.toFixed(1)),
        total_price_per_kwh_kr: Number(summary.totalPricePerKwh.toFixed(2)),
        baseload_watts: summary.baseloadWatts,
        top_peaks_kw: summary.topPeaks.map((p) => ({
          when: p.label,
          kw: Number(p.kw.toFixed(2)),
        })),
        cheapest_windows: summary.cheapestWindows.map((w) => ({
          hours: `${w.startHour}-${w.endHour}`,
          tomorrow: w.isTomorrow,
          avg_kr_per_kwh: Number(w.avgPriceKr.toFixed(2)),
        })),
        categories: summary.categories.map((c) => ({
          name: c.label,
          live_watts: Math.round(c.liveWatts),
          kwh: Number(c.kwh.toFixed(2)),
          cost_kr: Number(c.costKr.toFixed(1)),
          share_pct: c.sharePct,
          per_floor: c.floorBreakdown.map((f) => ({
            floor: f.floorName,
            kwh: Number(f.kwh.toFixed(2)),
            live_watts: Math.round(f.liveWatts),
          })),
        })),
        top_devices: summary.devices.slice(0, 10).map((d) => ({
          name: d.name,
          room: d.roomName,
          category: d.category,
          live_watts: Math.round(d.liveWatts),
          kwh: Number(d.kwh.toFixed(2)),
          cost_kr: Number(d.costKr.toFixed(1)),
        })),
      },
    };
  }

  const runAnalysis = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase-klient saknas.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setFollowUpAnswer(null);

    const prompt =
      "Analysera husets energidata i house_context (effekttoppar, baslast, elpris, kategorier och rum). " +
      "Svara ENDAST med giltig JSON på svenska i formatet: " +
      '{"summary": "Kort lägesbild på max 2 meningar", "estimatedMonthlySavingKr": "t.ex. 250-400 kr/mån", "tips": ["Konkret tips 1 med uppskattad besparing", "Konkret tips 2", "Konkret tips 3"]}';

    try {
      const { data, error: invokeErr } =
        await supabase.functions.invoke<GeminiResponse>(
          "gemini-hub-assistant",
          {
            body: {
              action: "ask_house",
              property_id: propertyId,
              payload: {
                question: prompt,
                house_context: buildEnergyContext(),
              },
            },
          },
        );

      if (invokeErr) {
        throw invokeErr;
      }

      const rawText =
        data?.answer || data?.reply || data?.message || data?.text || "";
      if (!rawText) {
        throw new Error(data?.error || "Fick inget svar från Gemini.");
      }

      const parsed = parseStructuredAdvice(rawText, summary.period);
      setCache(parsed);
      if (propertyId) {
        await saveEnergyAiCache(propertyId, parsed);
      }
    } catch (err) {
      setError(await extractInvokeError(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    const q = followUp.trim();
    if (!q || isAskingFollowUp) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsAskingFollowUp(true);
    setError(null);

    try {
      const { data, error: invokeErr } =
        await supabase.functions.invoke<GeminiResponse>(
          "gemini-hub-assistant",
          {
            body: {
              action: "ask_house",
              property_id: propertyId,
              payload: {
                question: q,
                house_context: buildEnergyContext(),
              },
            },
          },
        );
      if (invokeErr) throw invokeErr;
      const ans =
        data?.answer || data?.reply || data?.message || data?.text || "";
      setFollowUpAnswer(ans || "Inget svar mottaget.");
      setFollowUp("");
    } catch (err) {
      setError(await extractInvokeError(err));
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B8E6B]/15 text-[#6B8E6B]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Gemini Energirådgivare
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {cache
                ? `Senast analyserad ${new Date(cache.generatedAt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Analyserar effekttoppar, baslast & prisfönster för konkreta spartips"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#6B8E6B] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{isAnalyzing ? "Analyserar..." : cache ? "Uppdatera analys" : "Analysera nu"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-3.5 py-2.5 text-xs text-[#C86D51]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {cache ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/60 p-3.5">
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
              {cache.summary}
            </p>
            {cache.estimatedMonthlySavingKr && (
              <span className="tabular-nums shrink-0 rounded-full bg-[#6B8E6B]/15 px-3 py-1 text-xs font-bold text-[#6B8E6B]">
                Potential: {cache.estimatedMonthlySavingKr}
              </span>
            )}
          </div>

          {cache.tips.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {cache.tips.map((tip, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 p-3"
                >
                  <span className="mb-1 inline-block text-[11px] font-bold uppercase tracking-wider text-[#D49A42]">
                    Spartips {idx + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-[var(--text-primary)]">
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-4 text-center text-xs text-[var(--text-secondary)]">
          Klicka på <strong>Analysera nu</strong> för att låta Gemini granska
          era effekttoppar, nattlig baslast och förbrukning per kategori.
        </div>
      )}

      {/* Follow-up input */}
      <form onSubmit={handleFollowUp} className="flex gap-2">
        <input
          type="text"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          placeholder="Ställ en följdfråga om elen, t.ex. 'Varför var det en topp kl 19?'"
          className="flex-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[#6B8E6B]"
        />
        <button
          type="submit"
          disabled={!followUp.trim() || isAskingFollowUp}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#6B8E6B] hover:text-[#6B8E6B] disabled:opacity-40"
        >
          {isAskingFollowUp ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Fråga</span>
        </button>
      </form>

      {followUpAnswer && (
        <div className="rounded-xl border border-[#6B8E6B]/30 bg-[#6B8E6B]/10 p-3.5 text-xs leading-relaxed text-[var(--text-primary)]">
          {followUpAnswer}
        </div>
      )}
    </Card>
  );
}
