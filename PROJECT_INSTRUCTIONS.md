# Almvägen Family Hub – Projektinstruktioner & Arkitektur

## Översikt
**Almvägen Family Hub** är en modern, responsiv smart hem-webbapp och PWA för väggmonterad surfplatta (kioskläge / Fully Kiosk Browser) och familjemedlemmars mobiltelefoner.

- **Produktion:** `https://hem.sidequestlabs.se`
- **Hosting:** Cloudflare Workers Static Assets / Cloudflare Pages (`output: "export"` i `next.config.ts`, `wrangler.jsonc` pekar på `./out`).
- **Ramverk:** Next.js 15 (App Router), React 19, TypeScript (`strict: true`), Tailwind CSS v4.
- **Backend & Auth:** Supabase (`@supabase/supabase-js`) med Row Level Security (RLS).
- **Smart Hem:** Home Assistant WebSocket API (`wss://almvagen.sidequestlabs.se/api/websocket`).

---

## Kärnprincip: Zero Hardcoding
- **Inga hårdkodade hus, våningar, rum eller `entity_id` får någonsin finnas i koden.**
- All struktur och alla enheter hämtas dynamiskt från Supabase och konfigureras via appens inbyggda Admin-gränssnitt (`src/components/admin/AdminPanel.tsx`).
- All visuell ikonografi använder `IconResolver.tsx` + `CustomIcons.tsx` baserat på ikon-ID sparat i databasen.

---

## Databasmodell (Supabase med RLS)
1. `profiles`: `id` (auto-genererat `gen_random_uuid()` om inget auth-konto finns), `display_name`, `avatar_url`, `avatar_icon`, `role` (`'admin' | 'tablet' | 'child'`), `allowed_room_ids` (`uuid[]`), `allowed_widget_ids` (`uuid[]`), `show_energy` (`boolean`), `show_scenes` (`boolean`), `show_family_board` (`boolean`), `default_floor_id` (`uuid | null`), `quick_pin`, `email`.
2. `properties`: `id`, `name`, `address`, `sort_order`.
3. `floors`: `id`, `property_id`, `name`, `icon`, `sort_order`.
4. `rooms`: `id`, `floor_id`, `name`, `icon`, `is_common_area`, `sort_order`.
5. `room_devices`: `id`, `room_id`, `ha_entity_id`, `display_name`, `widget_type` (`'light' | 'dimmer' | 'climate' | 'sensor' | 'switch' | 'camera' | 'energy'`), `sort_order`.
6. `dashboard_widgets`: `id`, `property_id`, `title`, `subtitle`, `ha_entity_id`, `unit`, `icon`, `widget_category` (`'energy' | 'climate' | 'scene' | 'security'`), `admin_only`, `sort_order`.
7. `family_notes`: `id`, `property_id`, `author_id`, `author_name`, `content`, `is_pinned`, `is_done`, `created_at`.

---

## Roller & Behörigheter
- **`admin`:** Full åtkomst till alla hus, rum, admin-widgets och `AdminPanel` ("Redigera hemmet"), inklusive att skapa familjemedlemmar och skräddarsydda väggplattor utan e-postkonto.
- **`tablet`:** Väggplatta/panel (t.ex. "Kökspanel", "Hallpanel"); anpassar synliga rum (`allowed_room_ids`), widgets (`allowed_widget_ids`), moduler (`show_energy`, `show_scenes`, `show_family_board`) och startvåning (`default_floor_id`).
- **`child`:** Familjemedlem/barn; ser sina tilldelade rum (`allowed_room_ids`), widgets, moduler samt gemensamma ytor enligt RLS och profilinställningar.
- **Panel-/Profilväxlare (`ProfileSwitcherModal.tsx`):** Låter en inloggad enhet växla aktiv profil/platta (skyddad med `quick_pin` om satt) och anpassar omedelbart gränssnittet.

---

## Home Assistant WebSocket-flöde (`src/lib/ha/`)
- `wsClient.ts` hanterar anslutning, autentisering med Long-Lived Access Token (från `localStorage` eller `NEXT_PUBLIC_HA_TOKEN`), `get_states`, prenumeration på `state_changed`, exponential backoff-återanslutning och `callService`.
- `HAProvider.tsx` + `useHomeAssistant.ts` exponerar `isConnected`, `entities`, `getEntity(id)` och `callService(domain, service, data)`.

---

## Verifiering före commit & push
Kör alltid:
```bash
npx tsc --noEmit
npx next lint
```
Båda måste gå igenom utan fel eller varningar innan push till `main`.
