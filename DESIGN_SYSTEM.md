# Almvägen Family Hub – Design System

Jordnära, skandinavisk designprofil anpassad för både väggmonterad surfplatta och mobiltelefoner.

---

## Typografi (`layout.tsx` & `globals.css`)
- **Rubriker (husnamn, rumsnamn, modaltitlar):** `Fraunces` (Google Font, `.font-display`).
- **Brödtext, knappar, flikar & siffror:** `Plus Jakarta Sans` (Google Font) med `.tabular-nums` på alla mätvärden och effekt-/temperatursiffror.

---

## Teman & Bakgrundstexturer (`ThemeProvider.tsx` & `globals.css`)
Växlas i sidhuvudet mellan **Linne** (`light`), **Valnöt** (`dark`) och **Auto** (mörkt läge 20:00–06:00).

### 1. Ljust Linne / Sand (Standard)
- **Bakgrund (`--bg-canvas`):** `#F6F2EC` med subtil linne-/kalktextur (SVG-mönster).
- **Kort (`--bg-card`):** `#FFFDF9`
- **Sekundär yta (`--bg-subtle`):** `#EDE7DD`
- **Ram (`--border-subtle`):** `#E2D9CC`
- **Primär text (`--text-primary`):** `#292421` (varm espresso)
- **Sekundär text (`--text-secondary`):** `#6E635B`

### 2. Mörk Valnöt / Espresso (Kväll & Väggplatta)
- **Bakgrund (`--bg-canvas`):** `#1C1917` med subtil mörk träådrings-textur (SVG-mönster).
- **Kort (`--bg-card`):** `#26211D`
- **Sekundär yta (`--bg-subtle`):** `#161311`
- **Ram (`--border-subtle`):** `#3A322C`
- **Primär text (`--text-primary`):** `#F4EFEA` (gräddvit)
- **Sekundär text (`--text-secondary`):** `#B5AAA0`

---

## Jordnära Accentfärger
- **Salviagrön (`#6B8E6B`):** Aktiv status, billigt elpris, påslagna brytare, primärknappar.
- **Varm Terrakotta (`#C86D51`):** Värme (NIBE/Netatmo), hög effektbelastning, temperatur & nålade lappar.
- **Ockra / Honungsguld (`#D49A42`):** Varmt belysningssken (Hue/dimmers) och mellanbelastning.

---

## Custom SVG Icon Pack (`src/components/icons/CustomIcons.tsx`)
Alla 37 ikoner har mjuka, rundade linjer (`strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`) och duotone-fyllnad i salviagrönt, terrakotta och ockra.

### System & Energi
- `sys_tibber_pulse`, `sys_zaptec`, `sys_nibe`, `sys_elpris`, `sys_huvudsakring`

### Rum & Ytor
- `room_entre`, `room_vardagsrum`, `room_kok`, `room_matsal`, `room_sovrum`, `room_barnrum`, `room_badrum`, `room_kallare`, `room_trappa`, `room_vind`, `room_pannrum`, `room_tvattstuga`, `room_matkallare`, `room_tradgard`, `room_altan`, `room_vaxthus`, `room_uppfart`, `room_garage`

### Klimat & Säkerhet
- `ctrl_netatmo`, `ctrl_temp`, `ctrl_fukt`, `ctrl_rorelse`, `ctrl_kamera`

### Belysning, Vitvaror & UI
- `light_hue`, `light_dimmer`, `light_led`, `light_vitvaror`, `light_media`, `light_kontor`, `dev_vattenkastare`, `dev_utebelysning`, `ui_ha_status`
