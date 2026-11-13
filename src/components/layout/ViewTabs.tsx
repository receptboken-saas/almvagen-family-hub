"use client";

import { CalendarHeart, Home, Zap } from "lucide-react";
import type { HubViewId } from "@/lib/supabase/familyMeta";

interface ViewTabsProps {
  activeView: HubViewId;
  onChangeView: (view: HubViewId) => void;
  forceShowOnMobile?: boolean;
}

const TABS: {
  id: HubViewId;
  label: string;
  icon: typeof Home;
}[] = [
  { id: "home", label: "Hem & Styrning", icon: Home },
  { id: "family", label: "Familjen & Veckan", icon: CalendarHeart },
  { id: "energy", label: "Energi & Drift", icon: Zap },
];

/**
 * Tactile window/view selector shown directly under the header on wall tablets
 * and medium+ screens (>= 768px).
 */
export function ViewTabs({
  activeView,
  onChangeView,
  forceShowOnMobile = false,
}: ViewTabsProps) {
  return (
    <nav
      aria-label="Fönsterväljare"
      className={`${
        forceShowOnMobile ? "flex" : "hidden md:flex"
      } items-center gap-2 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 shadow-sm`}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeView(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "bg-[#6B8E6B] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70 hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
