# CHANGELOG.md – Almvägen Family Hub

Alla större ändringar, funktioner och releaser dokumenteras här. Varje AI-agent och utvecklare ska uppdatera denna fil vid nya funktioner eller commits.

## [0.6.0] – 2026-11-13 (KISS & Plug & Play)
- **Steg A (3-sekundersregeln):** Uppstädat `RoomCard.tsx` (ikon, namn, rumstemperatur, tända lampor + "Tänd alla" / "Släck alla") och ny responsiv `RoomDetailDrawer.tsx` med ljusstyrkereglage (0–100 %), brytare och klimatsensorer.
- **Steg B (Zero Noise & Kontextikoner):** Kontextfiltrerad `IconPicker.tsx` (`avatar`, `room`, `device`, `widget`), 11 nya mjuka duotone-avatarer/panelikoner i `CustomIcons.tsx`, samt rollanpassade vyer (`child` med direkt `ChildRoomView.tsx`, `tablet` med panelstyrda moduler/widgets/rum och `admin`).
- **Steg C (Plug & Play-autokonfiguration):** Automatisk gissning av `display_name` (rensat från rumsnamn), `widget_type`, `widget_category`, `unit` och `icon` via `haAutoConfig.ts`, samt **"Snabb-lägg till flera enheter"** i `AdminPanel.tsx`.
- Lade till `BACKLOG.md` och `CHANGELOG.md` i projektroten.

## [0.5.0] – 2026-11-13 (Familjens Anslagstavla, PWA & Hanterade Profiler)
- Lade till `FamilyBoard.tsx` (`family_notes` i Supabase) för delade familjelappar.
- Stöd för hanterade familje- och väggplatteprofiler i `profiles` (utan krav på e-postkonto) med `allowed_room_ids`, `allowed_widget_ids`, `show_energy`, `show_scenes`, `show_family_board`, `default_floor_id` och `quick_pin`.
- Lade till `ProfileSwitcherModal.tsx` ("Välj panel / profil") och ljusa jordnära PWA-ikoner med transparent RGBA.

## [0.4.0] – 2026-11-13 (Jordnära Designsystem & Duotone-ikoner)
- Införde `Fraunces` + `Plus Jakarta Sans` (`tabular-nums`) samt temaväxlare (`Ljust Linne #F6F2EC` / `Mörk Valnöt #1C1917` / `Auto`).
- Skapade custom duotone SVG-ikonpaket i `CustomIcons.tsx` och `IconResolver.tsx`, samt cirkulär `EnergyGauge.tsx` och `QuickScenes.tsx`.

## [0.3.0] – 2026-11-13 (Supabase Auth & Datadriven Modell)
- Införde Supabase Auth + Row Level Security (RLS) för `profiles`, `properties`, `floors`, `rooms`, `room_devices` och `dashboard_widgets`.
- Tog bort all hårdkodad rumsdata och byggde den dynamiska Admin-konfiguratorn i `AdminPanel.tsx`.

## [0.2.0] – 2026-11-13 (Home Assistant WebSocket)
- Implementerade `wsClient.ts`, `HAProvider.tsx` och `useHomeAssistant.ts` med automatisk återanslutning, `get_states`, `state_changed` och `callService`.

## [0.1.0] – 2026-11-13 (Grund & Cloudflare Pages)
- Initierade Next.js 15 App Router-projektet med TypeScript (`strict: true`), Tailwind CSS v4 och statisk export (`output: "export"`) för Cloudflare (`hem.sidequestlabs.se`).
