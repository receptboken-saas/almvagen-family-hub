# CHANGELOG.md – Almvägen Family Hub

Alla större ändringar, funktioner och releaser dokumenteras här. Varje AI-agent och utvecklare ska uppdatera denna fil vid nya funktioner eller commits.

## [0.10.0] – 2026-11-13 (Skola/Kommun, Denna Vecka, Middagskort & Gemini-tolkning)
- **Databas & Typer (`types.ts`, `useHomeData.ts`):** Lade till `school_name` och `municipality` på `Profile` samt nya typer och hämtning för `household_settings`, `weekly_events` (från idag och framåt) och `dinner_plans` (innevarande vecka mån–sön).
- **Admin-inställningar & Gemini-synk (`AdminPanel.tsx`):** Lade till **Skola**, **Kommun** och knappen **"Synka lovdagar med Gemini"** (`gemini-hub-assistant` med `action: 'sync_school_and_waste'`) per profil, samt **Kommun** och valfri **Sophämtnings-sensor i HA** (`waste_ha_entity_id`) under *Hus & Inställningar*.
- **Minimalistisk `"Denna vecka"`-widget (`ThisWeekCard.tsx`):** Filtrerar `weekly_events` för innevarande vecka + aktiv HA-sophämtningssensor; döljs helt när det är 0 händelser.
- **KISS `"Vad blir det till middag?"`-kort (`DinnerPlannerCard.tsx`):** Visar enbart *Idag* och *Imorgon* (med klickbar `recipe_url`) i standardvyn, samt utökad Mån–Sön-redigering sparad direkt i `dinner_plans`.
- **Smart Gemini-tolkning (`FamilyBoard.tsx`):** Ny toggle *"✨ Tolka med Gemini"* (på som standard) som skickar inmatning till `gemini-hub-assistant` (`action: 'parse_family_input'`), visar bekräftelsetoast och faller tillbaka till vanlig lapp i `family_notes` vid behov.

## [0.9.0] – 2026-11-13 (Multi-funktions Rumskort, Rums-hubb & Hus-sammanfattningar)
- **Multi-funktions `RoomCard.tsx`:** Kompakt 3-sekundersvy utan dubbel våningstext eller `"0 enheter"`-brus. Renderar enbart aktiva funktions-piller (temperatur + värmeindikator `#C86D51`, antal tända lampor `#D49A42`, öppna säkerhetssensorer, aktiv media) samt kompakta **Tänd** / **Släck**-knappar. Tomma rum visar endast `+ Koppla enheter` för `admin`.
- **Flikindelad Rums-hubb (`RoomDetailDrawer.tsx` & `RoomDeviceControls.tsx`):** Dynamiska funktionsflikar (*Ljus & Brytare*, *Värme & Klimat* med `−` / `+` 0.5°-steg via `climate.set_temperature`, *Säkerhet & Sensorer* med senaste ändring, samt *Övrigt & Energi*) – visar enbart flikar med kopplade enheter.
- **Hus-sammanfattningar (`HomeSummariesBar.tsx`):** Klickbar pill-rad (dold i `child`-läget) för *Lampor: X på* (med lista per rum och "Släck alla tända"), *Klimat: XX.X° snitt*, *Säkerhet: Tryggt / X öppna* och *Energi: XXXX W*.
- **Våningsgruppering (`page.tsx`):** I läget "Alla våningar" grupperas rummen automatiskt under våningsrubriker sorterade efter `sort_order` med kompakta kort så 9–12 rum syns direkt.

## [0.8.0] – 2026-11-13 (Kompakta Widgets, Fönsterväljare & Familjemoduler)
- **Kompakta översikts-widgets & anslagstavla:** Döljer tom widget-platshållare för icke-admin (endast diskret `+ Lägg till widget`-knapp för admin), kompakt horisontell pill-rad högst upp på `< 640px` i `EnergyOverview.tsx`, fällbar/kompakt `FamilyBoard.tsx` på mobil med `+ Lapp`-knapp, samt balanserat 2-spalts rutnät för *Översikt & Snabbscener* + *Anslagstavla* på uppfälld Fold 8 (`640px–1024px`).
- **Fönsterväljare (`ViewTabs.tsx`):** Taktil flikväljare direkt under toppmenyn på surfplattor (`role === 'tablet'`) och större skärmar (`>= 768px`) med vyerna *Hem & Styrning*, *Familjen & Veckan* och *Energi & Drift*.
- **Valbart startfönster:** Admin kan nu välja startfönster per profil/väggplatta i `AdminPanel.tsx` (sparat datadrivet via `familyMeta.ts` i Supabase `family_notes` + `localStorage`).
- **Förberedda Familjemoduler (`src/components/family/`):** Lade till `FamilyCalendarCard.tsx` (Familjekalender & Lovdagar), `DinnerPlannerCard.tsx` ("Vad blir det till middag?" med inline-redigering) och `WasteScheduleCard.tsx` (Sophämtning med påminnelsebadge kvällen före tömning).

## [0.7.0] – 2026-11-13 (Minimalistisk Toppmeny & Responsiv Layout)
- **Minimalistisk Toppmeny (`Header.tsx`):** Bantade sidhuvudet till en enda ren rad (56–64 px) med husets namn i `Fraunces` + diskret HA-statusprick till vänster (klickbar för `admin` för att öppna `HAConfigModal`) och två ankarpunkter till höger: kompakt `ThemeToggle` och Profil-pill.
- **Profil-snabbmeny (`ProfileQuickMenu.tsx`):** Ny responsiv meny (popover på tablet/desktop, bottom-sheet på mobil) med *Byt profil / panel*, *Min profil & avatar*, *Redigera hemmet* (admin), *HA-anslutning & status* (admin) samt *Logga ut* med Admin-PIN-skydd när aktiv profil är `tablet`.
- **Responsiva brytpunkter:** Horisontell våningsmeny direkt under toppmenyn på `< 1024px` (dold i `child`-läget), 1-spalts tumvänliga rumskort på mobil (`< 640px`), 2-spalts rutnät för både översikts-widgets (`QuickScenes`, `EnergyOverview`, `FamilyBoard`) och rumskort på `640px–1024px` (uppfälld Fold / mini-tablet), samt fast vänstermeny + 3-spalts rutnät med luftig typografi på `>= 1024px` (väggplatta/desktop).

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
