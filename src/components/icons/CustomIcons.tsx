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
  | "room_matsal"
  | "room_sovrum"
  | "room_barnrum"
  | "room_badrum"
  | "room_kallare"
  | "room_trappa"
  | "room_vind"
  | "room_pannrum"
  | "room_tvattstuga"
  | "room_matkallare"
  | "room_tradgard"
  | "room_altan"
  | "room_vaxthus"
  | "room_uppfart"
  | "room_garage"
  | "ctrl_netatmo"
  | "ctrl_temp"
  | "ctrl_fukt"
  | "ctrl_rorelse"
  | "ctrl_kamera"
  | "light_hue"
  | "light_dimmer"
  | "light_led"
  | "light_vitvaror"
  | "light_media"
  | "light_kontor"
  | "dev_vattenkastare"
  | "dev_utebelysning"
  | "ui_ha_status"
  | "avatar_parent"
  | "avatar_girl"
  | "avatar_boy"
  | "avatar_pet"
  | "avatar_tablet"
  | "avatar_kitchen_panel"
  | "avatar_hall_panel"
  | "avatar_heart"
  | "avatar_star"
  | "avatar_sun"
  | "avatar_flower";

export type CustomIconGroup =
  | "System & Energi"
  | "Rum & Ytor"
  | "Klimat & Säkerhet"
  | "Belysning & Vitvaror"
  | "Avatar & Paneler";

export interface CustomIconMeta {
  id: CustomIconId;
  label: string;
  group: CustomIconGroup;
}

export const CUSTOM_ICON_LIST: CustomIconMeta[] = [
  // System & Energi
  { id: "sys_tibber_pulse", label: "Tibber Pulse", group: "System & Energi" },
  { id: "sys_zaptec", label: "Zaptec Laddbox", group: "System & Energi" },
  { id: "sys_nibe", label: "NIBE Värmepump", group: "System & Energi" },
  { id: "sys_elpris", label: "Elpris", group: "System & Energi" },
  { id: "sys_huvudsakring", label: "Huvudsäkring", group: "System & Energi" },

  // Rum & Ytor
  { id: "room_entre", label: "Entré / Hall", group: "Rum & Ytor" },
  { id: "room_vardagsrum", label: "Vardagsrum", group: "Rum & Ytor" },
  { id: "room_kok", label: "Kök", group: "Rum & Ytor" },
  { id: "room_matsal", label: "Matsal", group: "Rum & Ytor" },
  { id: "room_sovrum", label: "Sovrum", group: "Rum & Ytor" },
  { id: "room_barnrum", label: "Barnrum", group: "Rum & Ytor" },
  { id: "room_badrum", label: "Badrum", group: "Rum & Ytor" },
  { id: "room_kallare", label: "Källare", group: "Rum & Ytor" },
  { id: "room_trappa", label: "Trappa", group: "Rum & Ytor" },
  { id: "room_vind", label: "Vind", group: "Rum & Ytor" },
  { id: "room_pannrum", label: "Pannrum", group: "Rum & Ytor" },
  { id: "room_tvattstuga", label: "Tvättstuga", group: "Rum & Ytor" },
  { id: "room_matkallare", label: "Matkällare", group: "Rum & Ytor" },
  { id: "room_tradgard", label: "Trädgård", group: "Rum & Ytor" },
  { id: "room_altan", label: "Altan / Pergola", group: "Rum & Ytor" },
  { id: "room_vaxthus", label: "Växthus", group: "Rum & Ytor" },
  { id: "room_uppfart", label: "Uppfart", group: "Rum & Ytor" },
  { id: "room_garage", label: "Garage", group: "Rum & Ytor" },

  // Klimat & Säkerhet
  { id: "ctrl_netatmo", label: "Termostat", group: "Klimat & Säkerhet" },
  { id: "ctrl_temp", label: "Temperatur", group: "Klimat & Säkerhet" },
  { id: "ctrl_fukt", label: "Luftfuktighet", group: "Klimat & Säkerhet" },
  { id: "ctrl_rorelse", label: "Rörelse", group: "Klimat & Säkerhet" },
  { id: "ctrl_kamera", label: "Kamera", group: "Klimat & Säkerhet" },

  // Belysning & Vitvaror
  { id: "light_hue", label: "Lampa (Hue)", group: "Belysning & Vitvaror" },
  { id: "light_dimmer", label: "Dimmer", group: "Belysning & Vitvaror" },
  { id: "light_led", label: "Ljusslinga", group: "Belysning & Vitvaror" },
  { id: "light_vitvaror", label: "Vitvaror", group: "Belysning & Vitvaror" },
  { id: "light_media", label: "TV & Media", group: "Belysning & Vitvaror" },
  { id: "light_kontor", label: "Kontor / Skärm", group: "Belysning & Vitvaror" },
  { id: "dev_vattenkastare", label: "Vattenkastare", group: "Belysning & Vitvaror" },
  { id: "dev_utebelysning", label: "Utebelysning", group: "Belysning & Vitvaror" },
  { id: "ui_ha_status", label: "HA Status", group: "Belysning & Vitvaror" },

  // Avatar & Paneler
  { id: "avatar_parent", label: "Förälder", group: "Avatar & Paneler" },
  { id: "avatar_girl", label: "Tjej", group: "Avatar & Paneler" },
  { id: "avatar_boy", label: "Kille", group: "Avatar & Paneler" },
  { id: "avatar_pet", label: "Husdjur", group: "Avatar & Paneler" },
  { id: "avatar_tablet", label: "Väggplatta", group: "Avatar & Paneler" },
  { id: "avatar_kitchen_panel", label: "Kökspanel", group: "Avatar & Paneler" },
  { id: "avatar_hall_panel", label: "Hallpanel", group: "Avatar & Paneler" },
  { id: "avatar_heart", label: "Hjärta", group: "Avatar & Paneler" },
  { id: "avatar_star", label: "Stjärna", group: "Avatar & Paneler" },
  { id: "avatar_sun", label: "Sol", group: "Avatar & Paneler" },
  { id: "avatar_flower", label: "Blomma", group: "Avatar & Paneler" },
];

const CUSTOM_ICON_SET = new Set<string>(CUSTOM_ICON_LIST.map((i) => i.id));

export function isCustomIcon(name: string | null | undefined): name is CustomIconId {
  return Boolean(name && CUSTOM_ICON_SET.has(name));
}

const SAGE = "#6B8E6B";
const TERRACOTTA = "#C86D51";
const OCHRE = "#D49A42";

interface CustomIconProps extends SVGProps<SVGSVGElement> {
  id: CustomIconId;
}

export function CustomSvgIcon({ id, className = "h-5 w-5", ...props }: CustomIconProps) {
  const baseProps: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
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
          <circle cx="12" cy="12" r="9" fill={OCHRE} fillOpacity="0.18" />
          <path d="M13 6L8.5 12.5H12L11 18L15.5 11.5H12L13 6Z" fill={OCHRE} fillOpacity="0.35" stroke={OCHRE} />
        </svg>
      );
    case "sys_zaptec":
      return (
        <svg {...baseProps}>
          <rect x="6" y="3" width="12" height="17" rx="3" fill={SAGE} fillOpacity="0.18" />
          <path d="M12.5 7.5L10 11.5H12.5L11.5 15.5L14 11.5H11.5" stroke={SAGE} />
          <path d="M9 20V21.5M15 20V21.5" />
        </svg>
      );
    case "sys_nibe":
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={TERRACOTTA} fillOpacity="0.16" />
          <circle cx="12" cy="12" r="4.5" stroke={TERRACOTTA} />
          <path d="M12 7.5V12L15 14.5M12 12L9 14.5" stroke={TERRACOTTA} />
        </svg>
      );
    case "sys_elpris":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="9" fill={SAGE} fillOpacity="0.16" />
          <path d="M8.5 14.5V8.5M8.5 8.5L6.5 10.5M8.5 8.5L10.5 10.5" stroke={TERRACOTTA} />
          <path d="M15.5 9.5V15.5M15.5 15.5L13.5 13.5M15.5 15.5L17.5 13.5" stroke={SAGE} />
        </svg>
      );
    case "sys_huvudsakring":
      return (
        <svg {...baseProps}>
          <rect x="7" y="3" width="10" height="18" rx="2" fill={OCHRE} fillOpacity="0.16" />
          <rect x="9.5" y="7" width="5" height="6" rx="1" fill={TERRACOTTA} fillOpacity="0.3" stroke={TERRACOTTA} />
          <path d="M12 16V18" />
        </svg>
      );
    case "room_entre":
      return (
        <svg {...baseProps}>
          <path d="M6 21V5A2 2 0 0 1 8 3H16A2 2 0 0 1 18 5V21" fill={OCHRE} fillOpacity="0.18" />
          <path d="M4 21H20" />
          <circle cx="14.5" cy="12" r="1" fill={TERRACOTTA} stroke={TERRACOTTA} />
        </svg>
      );
    case "room_vardagsrum":
      return (
        <svg {...baseProps}>
          <path d="M5 11V8A2 2 0 0 1 7 6H17A2 2 0 0 1 19 8V11" fill={SAGE} fillOpacity="0.18" />
          <path d="M3 11H21V16A2 2 0 0 1 19 18H5A2 2 0 0 1 3 16V11Z" fill={OCHRE} fillOpacity="0.2" />
          <path d="M6 18V20M18 18V20" />
        </svg>
      );
    case "room_kok":
      return (
        <svg {...baseProps}>
          <rect x="4" y="4" width="16" height="16" rx="2" fill={TERRACOTTA} fillOpacity="0.15" />
          <path d="M4 9H20" />
          <circle cx="8" cy="6.5" r="0.6" fill="currentColor" />
          <circle cx="12" cy="6.5" r="0.6" fill="currentColor" />
          <circle cx="16" cy="6.5" r="0.6" fill="currentColor" />
          <rect x="7.5" y="12" width="9" height="5" rx="1" fill={OCHRE} fillOpacity="0.25" />
        </svg>
      );
    case "room_matsal":
      return (
        <svg {...baseProps}>
          <path d="M12 3V6M9 8H15L14 6H10L9 8Z" fill={OCHRE} fillOpacity="0.3" stroke={OCHRE} />
          <path d="M4 14H20M6 14V20M18 14V20" />
          <path d="M3 12H21" strokeOpacity="0.5" />
        </svg>
      );
    case "room_sovrum":
      return (
        <svg {...baseProps}>
          <path d="M3 18V9A2 2 0 0 1 5 7H19A2 2 0 0 1 21 9V18" fill={SAGE} fillOpacity="0.16" />
          <path d="M3 14H21M3 18V20M21 18V20" />
          <rect x="6" y="10" width="4.5" height="2.5" rx="1" fill={OCHRE} fillOpacity="0.28" />
          <rect x="13.5" y="10" width="4.5" height="2.5" rx="1" fill={OCHRE} fillOpacity="0.28" />
        </svg>
      );
    case "room_barnrum":
      return (
        <svg {...baseProps}>
          <path d="M3 18V8M3 14H21V18M21 18V12.5A2 2 0 0 0 19 10.5H10V14" fill={OCHRE} fillOpacity="0.18" />
          <circle cx="6.5" cy="10.5" r="1.5" fill={TERRACOTTA} fillOpacity="0.3" stroke={TERRACOTTA} />
          <path d="M16 6L16.6 7.4L18 8L16.6 8.6L16 10L15.4 8.6L14 8L15.4 7.4Z" stroke={OCHRE} />
        </svg>
      );
    case "room_badrum":
      return (
        <svg {...baseProps}>
          <path d="M4 12H20V15A4 4 0 0 1 16 19H8A4 4 0 0 1 4 15V12Z" fill={SAGE} fillOpacity="0.2" />
          <path d="M6 12V6A2 2 0 0 1 8 4H10" />
          <path d="M7 19V21M17 19V21" />
        </svg>
      );
    case "room_kallare":
      return (
        <svg {...baseProps}>
          <path d="M4 19H9V15H14V11H19V7H21" />
          <path d="M4 19L19 7V19H4Z" fill={TERRACOTTA} fillOpacity="0.18" stroke="none" />
        </svg>
      );
    case "room_trappa":
      return (
        <svg {...baseProps}>
          <path d="M4 20H8V16H12V12H16V8H20" />
          <path d="M6 11L13 4M13 4H9M13 4V8" stroke={SAGE} />
        </svg>
      );
    case "room_vind":
      return (
        <svg {...baseProps}>
          <path d="M3 12L12 4L21 12H3Z" fill={OCHRE} fillOpacity="0.18" />
          <rect x="7" y="15" width="4" height="4" rx="0.5" fill={TERRACOTTA} fillOpacity="0.22" />
          <rect x="13" y="15" width="4" height="4" rx="0.5" fill={SAGE} fillOpacity="0.22" />
        </svg>
      );
    case "room_pannrum":
      return (
        <svg {...baseProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" fill={TERRACOTTA} fillOpacity="0.16" />
          <circle cx="12" cy="11" r="3" stroke={TERRACOTTA} />
          <path d="M12 6.5V8M12 14V15.5M7.5 11H9M15 11H16.5" stroke={TERRACOTTA} />
          <path d="M9 18H15" />
        </svg>
      );
    case "room_tvattstuga":
      return (
        <svg {...baseProps}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill={SAGE} fillOpacity="0.15" />
          <path d="M4 8H20" />
          <circle cx="12" cy="14" r="3.5" fill={SAGE} fillOpacity="0.25" />
          <path d="M9.8 14C10.8 12.8 13.2 15.2 14.2 14" stroke={SAGE} />
        </svg>
      );
    case "room_matkallare":
      return (
        <svg {...baseProps}>
          <path d="M4 9H20M4 16H20" />
          <rect x="6" y="4.5" width="3.5" height="4.5" rx="1" fill={OCHRE} fillOpacity="0.28" />
          <rect x="11.5" y="5.5" width="3" height="3.5" rx="1" fill={TERRACOTTA} fillOpacity="0.28" />
          <rect x="15.5" y="11.5" width="3" height="4.5" rx="1" fill={SAGE} fillOpacity="0.28" />
          <rect x="7" y="12" width="4" height="4" rx="1" fill={OCHRE} fillOpacity="0.22" />
        </svg>
      );
    case "room_tradgard":
      return (
        <svg {...baseProps}>
          <path d="M12 20V11" />
          <path d="M12 13C12 8 16.5 6 20 6C20 10.5 16.5 13 12 13Z" fill={SAGE} fillOpacity="0.28" stroke={SAGE} />
          <path d="M12 15C12 11 7.5 9 4 9C4 13.5 7.5 15 12 15Z" fill={SAGE} fillOpacity="0.2" stroke={SAGE} />
        </svg>
      );
    case "room_altan":
      return (
        <svg {...baseProps}>
          <path d="M3 7H21M5 7V20M19 7V20" />
          <path d="M7 4V7M12 4V7M17 4V7" stroke={OCHRE} />
          <path d="M8 15H16M12 15V20" stroke={TERRACOTTA} />
        </svg>
      );
    case "room_vaxthus":
      return (
        <svg {...baseProps}>
          <path d="M4 20V10L12 4L20 10V20H4Z" fill={SAGE} fillOpacity="0.16" />
          <path d="M12 20V13" stroke={SAGE} />
          <path d="M12 15C12 12 15 11 16 11C16 13.5 14 15 12 15Z" fill={SAGE} fillOpacity="0.3" stroke={SAGE} />
        </svg>
      );
    case "room_uppfart":
      return (
        <svg {...baseProps}>
          <path d="M5 14L7 8H17L19 14" fill={OCHRE} fillOpacity="0.18" />
          <rect x="4" y="14" width="16" height="4" rx="1.5" fill={SAGE} fillOpacity="0.2" />
          <circle cx="7.5" cy="18" r="1.5" />
          <circle cx="16.5" cy="18" r="1.5" />
        </svg>
      );
    case "room_garage":
      return (
        <svg {...baseProps}>
          <path d="M3 9L12 3L21 9V20H3V9Z" fill={TERRACOTTA} fillOpacity="0.14" />
          <rect x="7" y="12" width="10" height="8" rx="1" fill={OCHRE} fillOpacity="0.2" />
          <path d="M7 15H17M7 17.5H17" />
        </svg>
      );
    case "ctrl_netatmo":
      return (
        <svg {...baseProps}>
          <rect x="6" y="4" width="12" height="16" rx="3" fill={TERRACOTTA} fillOpacity="0.16" />
          <circle cx="12" cy="11" r="3" stroke={TERRACOTTA} />
          <path d="M10 17H14" />
        </svg>
      );
    case "ctrl_temp":
      return (
        <svg {...baseProps}>
          <path d="M14 14.76V5A2 2 0 0 0 10 5V14.76A3.5 3.5 0 1 0 14 14.76Z" fill={TERRACOTTA} fillOpacity="0.22" />
          <circle cx="12" cy="17.5" r="1.5" fill={TERRACOTTA} stroke={TERRACOTTA} />
        </svg>
      );
    case "ctrl_fukt":
      return (
        <svg {...baseProps}>
          <path d="M12 3C12 3 6 10.2 6 14.5A6 6 0 0 0 18 14.5C18 10.2 12 3 12 3Z" fill={SAGE} fillOpacity="0.22" stroke={SAGE} />
          <path d="M9.5 15.5A2.5 2.5 0 0 0 12 18" />
        </svg>
      );
    case "ctrl_rorelse":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="6" r="2" fill={OCHRE} fillOpacity="0.3" stroke={OCHRE} />
          <path d="M9 11L12 9L15 11M12 9V15L9.5 20M12 15L14.5 20" />
          <path d="M5 8A8 8 0 0 1 5 16M19 8A8 8 0 0 0 19 16" stroke={SAGE} />
        </svg>
      );
    case "ctrl_kamera":
      return (
        <svg {...baseProps}>
          <path d="M3 9L15 5L18 13L6 17L3 9Z" fill={SAGE} fillOpacity="0.2" />
          <path d="M16.5 13.5L21 15V10L17 11.5" />
          <path d="M9 16V20H5" />
        </svg>
      );
    case "light_hue":
      return (
        <svg {...baseProps}>
          <path d="M9 18H15M10 21H14" />
          <path d="M15 14C16.5 12.8 17.5 11 17.5 9A5.5 5.5 0 1 0 6.5 9C6.5 11 7.5 12.8 9 14V15.5H15V14Z" fill={OCHRE} fillOpacity="0.32" stroke={OCHRE} />
        </svg>
      );
    case "light_dimmer":
      return (
        <svg {...baseProps}>
          <path d="M4 7H20M4 17H20" />
          <circle cx="9" cy="7" r="2.5" fill={OCHRE} fillOpacity="0.3" stroke={OCHRE} />
          <circle cx="15" cy="17" r="2.5" fill={SAGE} fillOpacity="0.3" stroke={SAGE} />
        </svg>
      );
    case "light_led":
      return (
        <svg {...baseProps}>
          <path d="M3 8C6 12 9 12 12 8C15 12 18 12 21 8" />
          <circle cx="6" cy="13.5" r="1.5" fill={OCHRE} stroke={OCHRE} />
          <circle cx="12" cy="11.5" r="1.5" fill={TERRACOTTA} stroke={TERRACOTTA} />
          <circle cx="18" cy="13.5" r="1.5" fill={SAGE} stroke={SAGE} />
        </svg>
      );
    case "light_vitvaror":
      return (
        <svg {...baseProps}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill={SAGE} fillOpacity="0.16" />
          <path d="M4 8H20" />
          <circle cx="12" cy="14" r="3.5" fill={OCHRE} fillOpacity="0.22" />
          <circle cx="8" cy="5.5" r="0.8" fill="currentColor" />
        </svg>
      );
    case "light_media":
      return (
        <svg {...baseProps}>
          <rect x="3" y="5" width="18" height="12" rx="2" fill={SAGE} fillOpacity="0.18" />
          <path d="M8 21H16M12 17V21" />
          <path d="M10.5 9.5L14.5 11.5L10.5 13.5V9.5Z" fill={OCHRE} stroke={OCHRE} />
        </svg>
      );
    case "light_kontor":
      return (
        <svg {...baseProps}>
          <rect x="3" y="4" width="18" height="12" rx="2" fill={OCHRE} fillOpacity="0.18" />
          <path d="M8 20H16M12 16V20" />
          <path d="M7 9H13M7 12H11" stroke={SAGE} />
        </svg>
      );
    case "dev_vattenkastare":
      return (
        <svg {...baseProps}>
          <path d="M4 10H14A3 3 0 0 1 17 13V14" />
          <path d="M9 7V10M7 7H11" />
          <path d="M17 17C17 17 15 19.3 15 20.5A2 2 0 0 0 19 20.5C19 19.3 17 17 17 17Z" fill={SAGE} fillOpacity="0.3" stroke={SAGE} />
        </svg>
      );
    case "dev_utebelysning":
      return (
        <svg {...baseProps}>
          <path d="M5 4V20" />
          <path d="M5 8H12L15 12H9L12 8" fill={OCHRE} fillOpacity="0.3" stroke={OCHRE} />
          <path d="M10 15V17M14 15V17" stroke={OCHRE} />
        </svg>
      );
    case "ui_ha_status":
      return (
        <svg {...baseProps}>
          <path d="M3 10L12 3L21 10V20H3V10Z" fill={SAGE} fillOpacity="0.18" />
          <path d="M7 14H9.5L11 11L13 17L14.5 14H17" stroke={SAGE} />
        </svg>
      );
    case "avatar_parent":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="8" r="4" fill={SAGE} fillOpacity="0.22" />
          <path d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20" fill={SAGE} fillOpacity="0.14" />
        </svg>
      );
    case "avatar_girl":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="9" r="3.8" fill={TERRACOTTA} fillOpacity="0.2" />
          <path d="M8 9C8 6 10 4.5 12 4.5C14 4.5 16 6 16 9" stroke={TERRACOTTA} />
          <path d="M7.5 11.5L6.5 14.5M16.5 11.5L17.5 14.5" stroke={TERRACOTTA} />
          <path d="M6 20C6 16.8 8.7 14.5 12 14.5C15.3 14.5 18 16.8 18 20" />
        </svg>
      );
    case "avatar_boy":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="9" r="3.8" fill={OCHRE} fillOpacity="0.22" />
          <path d="M8.5 7.5L12 5.5L15.5 7.5" stroke={OCHRE} />
          <path d="M6 20C6 16.8 8.7 14.5 12 14.5C15.3 14.5 18 16.8 18 20" />
        </svg>
      );
    case "avatar_pet":
      return (
        <svg {...baseProps}>
          <circle cx="7" cy="9" r="1.5" fill={OCHRE} stroke={OCHRE} />
          <circle cx="12" cy="7" r="1.5" fill={OCHRE} stroke={OCHRE} />
          <circle cx="17" cy="9" r="1.5" fill={OCHRE} stroke={OCHRE} />
          <path d="M8 15.5C8 13.5 9.8 12 12 12C14.2 12 16 13.5 16 15.5C16 17.5 14.5 19 12 19C9.5 19 8 17.5 8 15.5Z" fill={TERRACOTTA} fillOpacity="0.22" />
        </svg>
      );
    case "avatar_tablet":
      return (
        <svg {...baseProps}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill={SAGE} fillOpacity="0.18" />
          <path d="M7 9H13M7 13H11" stroke={SAGE} />
          <circle cx="17" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "avatar_kitchen_panel":
      return (
        <svg {...baseProps}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill={TERRACOTTA} fillOpacity="0.16" />
          <path d="M9 9V15M15 9V15M9 12H15" stroke={TERRACOTTA} />
        </svg>
      );
    case "avatar_hall_panel":
      return (
        <svg {...baseProps}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill={OCHRE} fillOpacity="0.18" />
          <path d="M12 8L16 11V16H8V11L12 8Z" stroke={SAGE} />
        </svg>
      );
    case "avatar_heart":
      return (
        <svg {...baseProps}>
          <path d="M12 20C12 20 4 14.8 4 9.2A4.2 4.2 0 0 1 12 7.2A4.2 4.2 0 0 1 20 9.2C20 14.8 12 20 12 20Z" fill={TERRACOTTA} fillOpacity="0.26" stroke={TERRACOTTA} />
        </svg>
      );
    case "avatar_star":
      return (
        <svg {...baseProps}>
          <path d="M12 3.5L14.6 8.8L20.5 9.6L16.2 13.8L17.2 19.6L12 16.9L6.8 19.6L7.8 13.8L3.5 9.6L9.4 8.8L12 3.5Z" fill={OCHRE} fillOpacity="0.28" stroke={OCHRE} />
        </svg>
      );
    case "avatar_sun":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="4.5" fill={OCHRE} fillOpacity="0.28" stroke={OCHRE} />
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M18.4 5.6L17 7M7 17L5.6 18.4" stroke={OCHRE} />
        </svg>
      );
    case "avatar_flower":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="2.5" fill={OCHRE} stroke={OCHRE} />
          <circle cx="12" cy="6.5" r="2.2" fill={SAGE} fillOpacity="0.22" />
          <circle cx="17.2" cy="10.2" r="2.2" fill={SAGE} fillOpacity="0.22" />
          <circle cx="15.2" cy="16.5" r="2.2" fill={SAGE} fillOpacity="0.22" />
          <circle cx="8.8" cy="16.5" r="2.2" fill={SAGE} fillOpacity="0.22" />
          <circle cx="6.8" cy="10.2" r="2.2" fill={SAGE} fillOpacity="0.22" />
        </svg>
      );
  }
}
