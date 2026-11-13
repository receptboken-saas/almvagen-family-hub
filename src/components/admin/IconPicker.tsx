"use client";

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

export function IconPicker({
  value,
  onChange,
  filterGroups,
  label = "Välj ikon",
}: IconPickerProps) {
  const activeGroups = filterGroups
    ? GROUP_ORDER.filter((g) => filterGroups.includes(g))
    : GROUP_ORDER;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {activeGroups.map((group) => {
          const groupIcons = CUSTOM_ICON_LIST.filter((i) => i.group === group);
          if (groupIcons.length === 0) return null;
          return (
            <div key={group} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {group}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {groupIcons.map((icon) => {
                  const selected = value === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => onChange(icon.id)}
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-colors ${
                        selected
                          ? "border-[#6B8E6B] bg-[#6B8E6B]/15 text-[var(--text-primary)] ring-1 ring-[#6B8E6B]/40"
                          : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[#6B8E6B]/50 hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <CustomSvgIcon id={icon.id} className="h-5 w-5" />
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
