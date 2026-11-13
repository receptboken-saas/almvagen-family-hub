import type { SVGProps } from "react";

export type CustomIconId =
  | "sys_tibber_pulse"
  | "sys_zaptec"
  | "sys_nibe"
  | "sys_elpris"
  | "sys_huvudsakring"
  | "room_entre"
  | "room_vardagsrum"
  | "room_kok"
  | "room_barnrum"
  | "room_kallare"
  | "room_tradgard"
  | "room_garage"
  | "ctrl_netatmo"
  | "ctrl_temp"
  | "ctrl_fukt"
  | "ctrl_rorelse"
  | "ctrl_kamera"
  | "light_hue"
  | "light_dimmer"
  | "light_vitvaror";

export interface CustomIconMeta {
  id: CustomIconId;
  label: string;
  group: "System & Energi" | "Rum & Ytor" | "Klimat & Styrning" | "Belysning & Vitvaror";
}

export const CUSTOM_ICON_LIST: CustomIconMeta[] = [
  { id: "sys_tibber_pulse", label: "Tibber Pulse", group: "System & Energi" },
  { id: "sys_zaptec", label: "Zaptec", group: "System & Energi" },
  { id: "sys_nibe", label: "NIBE", group: "System & Energi" },
  { id: "sys_elpris", label: "Elpris", group: "System & Energi" },
  { id: "sys_huvudsakring", label: "Huvudsäkring", group: "System & Energi" },
  { id: "room_entre", label: "Entré", group: "Rum & Ytor" },
  { id: "room_vardagsrum", label: "Vardagsrum", group: "Rum & Ytor" },
  { id: "room_kok", label: "Kök", group: "Rum & Ytor" },
  { id: "room_barnrum", label: "Barnrum", group: "Rum & Ytor" },
  { id: "room_kallare", label: "Källare", group: "Rum & Ytor" },
  { id: "room_tradgard", label: "Trädgård", group: "Rum & Ytor" },
  { id: "room_garage", label: "Garage", group: "Rum & Ytor" },
  { id: "ctrl_netatmo", label: "Termostat", group: "Klimat & Styrning" },
  { id: "ctrl_temp", label: "Temperatur", group: "Klimat & Styrning" },
  { id: "ctrl_fukt", label: "Luftfuktighet", group: "Klimat & Styrning" },
  { id: "ctrl_rorelse", label: "Rörelse", group: "Klimat & Styrning" },
  { id: "ctrl_kamera", label: "Kamera", group: "Klimat & Styrning" },
  { id: "light_hue", label: "Hue Lampa", group: "Belysning & Vitvaror" },
  { id: "light_dimmer", label: "Dimmer", group: "Belysning & Vitvaror" },
  { id: "light_vitvaror", label: "Vitvaror", group: "Belysning & Vitvaror" },
];

const CUSTOM_ICON_SET = new Set<string>(CUSTOM_ICON_LIST.map((i) => i.id));

export function isCustomIcon(name: string | null | undefined): name is CustomIconId {
  return Boolean(name && CUSTOM_ICON_SET.has(name));
}

interface CustomIconProps extends SVGProps<SVGSVGElement> {
  id: CustomIconId;
}

export function CustomSvgIcon({ id, className = "h-5 w-5", ...props }: CustomIconProps) {
  const baseProps: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
    ...props,
  };

  switch (id) {
    case "sys_tibber_pulse":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.14" />
          <path d="M13 6L8.5 12.5H12L11 18L15.5 11.5H12L13 6Z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case "sys_zaptec":
      return (
        <svg {...baseProps}>
          <rect x="6" y="3" width="12" height="18" rx="3" fill="currentColor" fillOpacity="0.14" />
          <path d="M12.5 8L10 12H12.5L11.5 16L14 12H11.5" />
          <path d="M9 21V19M15 21V19" />
        </svg>
      );
    case "sys_nibe":
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.14" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 7.5V12L15 14.5M12 12L9 14.5" />
        </svg>
      );
    case "sys_elpris":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.14" />
          <path d="M8.5 14V8M8.5 8L6.5 10M8.5 8L10.5 10" />
          <path d="M15.5 10V16M15.5 16L13.5 14M15.5 16L17.5 14" />
        </svg>
      );
    case "sys_huvudsakring":
      return (
        <svg {...baseProps}>
          <rect x="7" y="3" width="10" height="18" rx="2" fill="currentColor" fillOpacity="0.14" />
          <rect x="9.5" y="7" width="5" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
          <path d="M12 16V18" />
        </svg>
      );
    case "room_entre":
      return (
        <svg {...baseProps}>
          <path d="M6 21V5A2 2 0 0 1 8 3H16A2 2 0 0 1 18 5V21" fill="currentColor" fillOpacity="0.14" />
          <path d="M4 21H20" />
          <circle cx="14.5" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "room_vardagsrum":
      return (
        <svg {...baseProps}>
          <path d="M4 11V8A2 2 0 0 1 6 6H18A2 2 0 0 1 20 8V11" fill="currentColor" fillOpacity="0.14" />
          <path d="M3 11H21V16A2 2 0 0 1 19 18H5A2 2 0 0 1 3 16V11Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M6 18V20M18 18V20" />
        </svg>
      );
    case "room_kok":
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.14" />
          <path d="M4 9H20" />
          <circle cx="8" cy="6.5" r="0.8" fill="currentColor" />
          <circle cx="12" cy="6.5" r="0.8" fill="currentColor" />
          <circle cx="16" cy="6.5" r="0.8" fill="currentColor" />
          <rect x="7.5" y="12" width="9" height="5" rx="1" />
        </svg>
      );
    case "room_barnrum":
      return (
        <svg {...baseProps}>
          <path d="M3 17V7M3 14H21V17M21 17V12A2 2 0 0 0 19 10H10V14" fill="currentColor" fillOpacity="0.16" />
          <circle cx="6.5" cy="10.5" r="1.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case "room_kallare":
      return (
        <svg {...baseProps}>
          <path d="M4 19H9V15H14V11H19V7H21" />
          <path d="M4 19L19 7V19H4Z" fill="currentColor" fillOpacity="0.14" stroke="none" />
        </svg>
      );
    case "room_tradgard":
      return (
        <svg {...baseProps}>
          <path d="M12 20V11" />
          <path d="M12 13C12 8 16.5 6 20 6C20 10.5 16.5 13 12 13Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 15C12 11 7.5 9 4 9C4 13.5 7.5 15 12 15Z" fill="currentColor" fillOpacity="0.14" />
        </svg>
      );
    case "room_garage":
      return (
        <svg {...baseProps}>
          <path d="M3 9L12 3L21 9V20H3V9Z" fill="currentColor" fillOpacity="0.14" />
          <rect x="7" y="12" width="10" height="8" rx="1" fill="currentColor" fillOpacity="0.18" />
          <path d="M7 15H17M7 17.5H17" />
        </svg>
      );
    case "ctrl_netatmo":
      return (
        <svg {...baseProps}>
          <rect x="6" y="4" width="12" height="16" rx="3" fill="currentColor" fillOpacity="0.14" />
          <circle cx="12" cy="11" r="3" />
          <path d="M10 17H14" />
        </svg>
      );
    case "ctrl_temp":
      return (
        <svg {...baseProps}>
          <path d="M14 14.76V5A2 2 0 0 0 10 5V14.76A3.5 3.5 0 1 0 14 14.76Z" fill="currentColor" fillOpacity="0.18" />
          <circle cx="12" cy="17.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case "ctrl_fukt":
      return (
        <svg {...baseProps}>
          <path d="M12 3C12 3 6 10.2 6 14.5A6 6 0 0 0 18 14.5C18 10.2 12 3 12 3Z" fill="currentColor" fillOpacity="0.18" />
          <path d="M9.5 15.5A2.5 2.5 0 0 0 12 18" />
        </svg>
      );
    case "ctrl_rorelse":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="6" r="2" fill="currentColor" fillOpacity="0.25" />
          <path d="M9 11L12 9L15 11M12 9V15L9.5 20M12 15L14.5 20" />
          <path d="M5 8A8 8 0 0 1 5 16M19 8A8 8 0 0 0 19 16" />
        </svg>
      );
    case "ctrl_kamera":
      return (
        <svg {...baseProps}>
          <path d="M3 9L15 5L18 13L6 17L3 9Z" fill="currentColor" fillOpacity="0.18" />
          <path d="M16.5 13.5L21 15V10L17 11.5" />
          <path d="M9 16V20H5" />
        </svg>
      );
    case "light_hue":
      return (
        <svg {...baseProps}>
          <path d="M9 18H15M10 21H14" />
          <path d="M15 14C16.5 12.8 17.5 11 17.5 9A5.5 5.5 0 1 0 6.5 9C6.5 11 7.5 12.8 9 14V15.5H15V14Z" fill="currentColor" fillOpacity="0.22" />
        </svg>
      );
    case "light_dimmer":
      return (
        <svg {...baseProps}>
          <path d="M4 7H20M4 17H20" />
          <circle cx="9" cy="7" r="2.5" fill="currentColor" fillOpacity="0.25" />
          <circle cx="15" cy="17" r="2.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case "light_vitvaror":
      return (
        <svg {...baseProps}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill="currentColor" fillOpacity="0.14" />
          <path d="M4 8H20" />
          <circle cx="12" cy="14" r="3.5" fill="currentColor" fillOpacity="0.18" />
          <circle cx="8" cy="5.5" r="0.8" fill="currentColor" />
        </svg>
      );
  }
}
