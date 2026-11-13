"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  CUSTOM_ICON_LIST,
  CustomSvgIcon,
  type CustomIconGroup,
} from "@/components/icons/CustomIcons";

interface IconPickerProps {
  value: string;
  onChange: (iconId: string) => void;
  filterGroups?: CustomIconGroup[];
  label?: string;
}

const GROUP_ORDER: CustomIconGroup[] = [
  "Rum & Ytor",
  "Belysning & Vitvaror",
  "Klimat & Säkerhet",
  "System & Energi",
];

/**
 * Compact searchable icon selector using theme CSS variables.
 */
export function IconPicker({
  value,
  onChange,
  filterGroups,
  label = "Välj ikon",
}: IconPickerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const activeGroups = filterGroups
    ? GROUP_ORDER.filter((g) => filterGroups.includes(g))
    : GROUP_ORDER;

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
              (!normalizedQuery ||
                i.label.toLowerCase().includes(normalizedQuery) ||
                i.id.toLowerCase().includes(normalizedQuery)),
          );
          if (groupIcons.length === 0) return null;
          return (
            <div key={group} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {group}
              </p>
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
