"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";

interface HAEntityPickerProps {
  value: string;
  onChange: (
    entityId: string,
    friendlyName?: string,
    unit?: string,
  ) => void;
  placeholder?: string;
}

/**
 * Searchable Home Assistant entity picker with manual input fallback.
 */
export function HAEntityPicker({
  value,
  onChange,
  placeholder = "t.ex. light.vardagsrum_tak",
}: HAEntityPickerProps) {
  const { isConnected, entities } = useHomeAssistant();
  const [isOpen, setIsOpen] = useState(false);

  const entityList = useMemo(() => {
    const query = value.toLowerCase().trim();
    const all = Object.values(entities);
    const filtered = query
      ? all.filter(
          (e) =>
            e.entity_id.toLowerCase().includes(query) ||
            (e.attributes.friendly_name ?? "").toLowerCase().includes(query),
        )
      : all;
    return filtered
      .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
      .slice(0, 60);
  }, [entities, value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          type="text"
          value={value}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay close so click on dropdown item registers
            setTimeout(() => setIsOpen(false), 180);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }}
          aria-label="Visa entiteter"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-200"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
          {!isConnected ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              HA ej ansluten – skriv in <code>entity_id</code> manuellt ovan.
            </p>
          ) : entityList.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              Inga matchande entiteter hittades.
            </p>
          ) : (
            entityList.map((entity) => (
              <button
                key={entity.entity_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(
                    entity.entity_id,
                    entity.attributes.friendly_name,
                    entity.attributes.unit_of_measurement,
                  );
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">
                    {entity.attributes.friendly_name ?? entity.entity_id}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-400">
                    {entity.entity_id}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                  {entity.state}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
