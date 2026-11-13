"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DynamicIcon } from "@/components/ui/IconResolver";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import type { DashboardWidget } from "@/lib/supabase/types";

interface QuickScenesProps {
  widgets: DashboardWidget[];
  isAdmin: boolean;
}

function resolveSceneCall(entityId: string): { domain: string; service: string } {
  const domain = entityId.split(".")[0] ?? "scene";
  switch (domain) {
    case "automation":
      return { domain: "automation", service: "trigger" };
    case "button":
      return { domain: "button", service: "press" };
    case "script":
      return { domain: "script", service: "turn_on" };
    case "scene":
      return { domain: "scene", service: "turn_on" };
    default:
      return { domain: "homeassistant", service: "turn_on" };
  }
}

export function QuickScenes({ widgets, isAdmin }: QuickScenesProps) {
  const { isConnected, callService } = useHomeAssistant();
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const scenes = widgets.filter(
    (w) => w.widget_category === "scene" && (isAdmin || !w.admin_only),
  );

  if (scenes.length === 0) {
    return null;
  }

  async function handleTrigger(scene: DashboardWidget) {
    if (!isConnected || triggeringId) return;
    setTriggeringId(scene.id);
    const { domain, service } = resolveSceneCall(scene.ha_entity_id);
    try {
      await callService(domain, service, {
        entity_id: scene.ha_entity_id,
      });
    } catch {
      // Ignore transient errors
    } finally {
      setTimeout(() => setTriggeringId(null), 350);
    }
  }

  return (
    <section aria-labelledby="scenes-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id="scenes-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Snabba scener
        </h2>
      </div>
      <div className="flex flex-wrap gap-3">
        {scenes.map((scene) => {
          const isBusy = triggeringId === scene.id;
          return (
            <button
              key={scene.id}
              type="button"
              disabled={!isConnected || isBusy}
              onClick={() => handleTrigger(scene)}
              className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-slate-800/90 bg-[#131A26] px-4 py-3 text-sm font-medium text-slate-100 shadow-md transition-all hover:border-[#38BDF8]/50 hover:bg-[#38BDF8]/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#38BDF8]/15 text-[#38BDF8]">
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <DynamicIcon name={scene.icon ?? "sparkles"} className="h-4 w-4" />
                )}
              </span>
              <span>{scene.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
