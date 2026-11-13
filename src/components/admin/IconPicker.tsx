"use client";

import {
  CUSTOM_ICON_LIST,
  CustomSvgIcon,
  type CustomIconMeta,
} from "@/components/icons/CustomIcons";

interface IconPickerProps {
  value: string;
  onChange: (iconId: string) => void;
  filterGroups?: CustomIconMeta["group"][];
  label?: string;
}

export function IconPicker({
  value,
  onChange,
  filterGroups,
  label = "Välj ikon",
}: IconPickerProps) {
  const icons = filterGroups
    ? CUSTOM_ICON_LIST.filter((i) => filterGroups.includes(i.group))
    : CUSTOM_ICON_LIST;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {icons.map((icon) => {
          const selected = value === icon.id;
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => onChange(icon.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-colors ${
                selected
                  ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]"
                  : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
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
}
