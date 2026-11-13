"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  CUSTOM_ICON_LIST,
  CustomSvgIcon,
  type CustomIconGroup,
  type CustomIconMeta,
} from "@/components/icons/CustomIcons";

export type IconPickerContext = "avatar" | "room" | "device" | "widget";

interface IconPickerProps {
  context: IconPickerContext;
  value: string;
  onChange: (iconId: string) => void;
  label?: string;
}

const CONTEXT_GROUPS: Record<IconPickerContext, CustomIconGroup[]> = {
  avatar: ["Avatar & Paneler"],
  room: ["Rum & Ytor"],
  device: ["Belysning & Vitvaror", "Klimat & Säkerhet"],
  widget: ["System & Energi", "Klimat & Säkerhet", "Belysning & Vitvaror"],
};

function matchesContext(icon: CustomIconMeta, context: IconPickerContext): boolean {
  switch (context) {
    case "avatar":
      return icon.id.startsWith("avatar_");
    case "room":
      return icon.id.startsWith("room_");
    case "device":
      return (
        icon.id.startsWith("light_") ||
        icon.id.startsWith("ctrl_") ||
        icon.id.startsWith("dev_")
      );
    case "widget":
      return (
        icon.id.startsWith("sys_") ||
        icon.id.startsWith("ctrl_") ||
        icon.id.startsWith("light_") ||
        icon.id.startsWith("dev_")
      );
  }
}

/**
 * Context-filtered, searchable icon selector using theme CSS variables.
 */
export function IconPicker({
  context,
  value,
  onChange,
  label = "Välj ikon",
}: IconPickerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const activeGroups = CONTEXT_GROUPS[context];

  return (
    <div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </p>
        <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök ikon…"
            className="min-h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 pl-8 pr-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:border-[#6B8E6B] focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2.5">
        {activeGroups.map((group) => {
          const groupIcons = CUSTOM_ICON_LIST.filter(
            (i) =>
              i.group === group &&
              matchesContext(i, context) &&
              (!normalizedQuery ||
                i.label.toLowerCase().includes(normalizedQuery) ||
                i.id.toLowerCase().includes(normalizedQuery)),
          );
          if (groupIcons.length === 0) return null;
          return (
            <div key={group} className="space-y-1.5">
              {activeGroups.length > 1 && (
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {group}
                </p>
              )}
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {groupIcons.map((icon) => {
                  const selected = value === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => onChange(icon.id)}
                      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-colors ${
                        selected
                          ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[var(--text-primary)] ring-1 ring-[#6B8E6B]/40"
                          : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[#6B8E6B]/50 hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <CustomSvgIcon id={icon.id} className="h-4 w-4" />
                      <span className="w-full truncate text-[10px] font-medium">
                        {icon.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
