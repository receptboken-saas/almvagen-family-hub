# CHANGELOG.md – Almvägen Family Hub

Alla större ändringar, funktioner och releaser dokumenteras här. Varje AI-agent och utvecklare ska uppdatera denna fil vid nya funktioner eller commits.

## [0.18.5] – 2026-11-13 (Direktsynk mot Tibber API, Gemini payload-fix & EnergyGauge-fix)
- **Direktsynk mot Tibber GraphQL API (`tibberClient.ts`, `energyConfig.ts`, `energyEngine.ts`, `EnergyDashboard.tsx`, `EnergyConfigModal.tsx`):** Lade till valfri `Tibber API-token` under *Energiinställningar → Huvudmätare & Pris*. När den är ifylld hämtas exakta månadssiffror (kWh & kr från 1:a i månaden), timtoppar, nattlig baslast och dagens/morgondagens timpriser direkt från Tibber — så siffrorna matchar Tibber-appen även om Home Assistant-servern bara har ett par dagars lokal historik.
- **Fix för Gemini Energirådgivare (`EnergyGeminiAdvisor.tsx`, `EnergyConfigModal.tsx`):** Wrappade `question` och `house_context` i `payload` precis som `gemini-hub-assistant` kräver, vilket löser `Cannot destructure property 'question' of 'payload'`.
- **Fix för `EnergyGauge.tsx`:** Säkerställde att mätaren aldrig väljer en elprissensor (`kr`/`öre`) som effektmätare (`WATT`).

## [0.18.4] – 2026-11-13 (Fix för Tibber "Denna månad", timvägd kostnad & Gemini Edge Function)
- **"Denna månad" i stället för rullande 30 dagar (`energyConfig.ts`, `energyStats.ts`, `EnergyDashboard.tsx`):** Räknar från den 1:a i innevarande månad kl 00:00 fram till nu så att kWh-totalen matchar Tibber-appens vy för innevarande månad.
- **Exakt timvägd kostnadsberäkning (`energyStats.ts`, `energyEngine.ts`):** Hämtar även timhistorik för elprissensorn och multiplicerar varje timmes förbrukning (`kWh`) med just den timmens spotpris + nätavgift.
- **Fix för Gemini Edge Function 500 (`EnergyGeminiAdvisor.tsx`, `EnergyConfigModal.tsx`):** Skickar komplett `house_context`-struktur (`rooms`, `widgets`, `weekly_events`, `dinner_plans`) till `gemini-hub-assistant` och extraherar tydliga felmeddelanden vid eventuella anropsfel.

## [0.18.3] – 2026-11-13 (Elnätsleverantör & Kommun med Gemini-hämtning av nätavgift & effekttariff)
- **Elnätsleverantör & Kommun (`energyConfig.ts`, `EnergyConfigModal.tsx`, `page.tsx`):** Lade till fält för `gridOperator`, `municipality` (förifylls automatiskt från `household_settings.municipality`) och `gridTariffSummary` samt knappen **"Hämta uppgifter med Gemini"** som slår upp och fyller i aktuell överföringsavgift + energiskatt (`kr/kWh`) samt effekttariff-modell.
- **Skräddarsydda effekttoppar & AI-råd (`EnergyDashboard.tsx`, `EnergyGeminiAdvisor.tsx`):** Visar elnätsbolag och tariffmodell direkt i *Effekttoppar*-kortet och skickar med uppgifterna till **Gemini Energirådgivare**.

## [0.18.2] – 2026-11-13 (Träffsäkrare kategorisering & filtrering av passiva sensorer)
- **Fix för felmatchade kategorier (`energyConfig.ts`, `energyDiscovery.ts`):** Bytte delsträngsmatchningen `"ev"` / `"bil"` mot exakta ordgränser (`\bev\b`, `elbil`, `laddbox`, `laddare`, `zaptec`, `easee`) så vanliga enheter med t.ex. *"level"* eller *"device"* inte råkar hamna under *Elbilsladdning*.
- **Renare enhetslista (`energyEngine.ts`):** Passiva temperatur-, fukt-, rörelse- och kamerasensorer utan egen W/kWh-mätare eller märkeffekt filtreras bort från *Energi & Drift* så siffror och enhetsantal enbart speglar verkliga elförbrukare.

## [0.18.1] – 2026-11-13 (1-klicks "Skanna Home Assistant" för Energi & Drift)
- **Automatisk enhetsupptäckt (`energyDiscovery.ts`):** Läser HA:s `device_registry`, `entity_registry` och `area_registry` via WebSocket och grupperar automatiskt varje pryls effekt- (`W`), energi- (`kWh`), pris- och driftstatus-sensorer (t.ex. *"Laddar"*, *"Värmer"*, *"Tvättar"*).
- **1-klicks konfiguration (`EnergyConfigModal.tsx`, `energyConfig.ts`, `energyEngine.ts`, `EnergyDashboard.tsx`):** Ny flik *"✨ Smart Skanna HA"* där Admin kan skanna och aktivera upptäckta prylar (även om de inte ligger i ett rum i Supabase) samt sätta schablon (9 W) på alla lampor utan elmätare med ett klick.

## [0.18.0] – 2026-11-13 (Smart Energi & Drift: Grupper, Kostnad, Effekttoppar & Gemini Energirådgivare)
- **Home Assistant-statistik (`wsClient.ts`, `HAProvider.tsx`, `energyStats.ts`):** Lade till generisk `sendCommand`-metod på WebSocket-klienten samt hämtning av historik via `recorder/statistics_during_period` för tidsperioderna *Just nu*, *Idag*, *7 dagar* och *30 dagar*, inklusive beräkning av månadens 3 högsta effekttoppar, nattlig baslast (00:00–05:00) och billigaste 2h/3h-prisfönster.
- **Datadriven energimotor & konfigurering (`energyConfig.ts`, `energyEngine.ts`, `EnergyConfigModal.tsx`):** 100 % datadriven kategorisering (*Belysning* med uppdelning per våning, *Uppvärmning & Klimat*, *Vitvaror & Tvätt*, *Elbilsladdning*, *Övrig drift & Baslast*) med stöd för huvudmätare, elpris + nätavgift, huvudsäkringsvakt (A), enskilda W/kWh-sensorer och märkeffekt (W) för enheter utan egen elmätare.
- **Ny *Energi & Drift*-vy (`EnergyDashboard.tsx`, `EnergyGeminiAdvisor.tsx`, `page.tsx`):** Komplett översikt med kostnad och kWh per grupp, våning, rum och enskild enhet, samt integrerad **Gemini Energirådgivare** (`gemini-hub-assistant`) som cachar analys + 3 konkreta spartips i Supabase och stöder följdfrågor.

## [0.17.1] – 2026-11-13 (Tydligare felhantering & manuell lovdags-fallback i Admin)
- **Skola & Lovdagar (`AdminPanel.tsx`):** Visar ett tydligt svenskt felmeddelande i terrakotta (`#C86D51`) när `gemini-hub-assistant` har tillfälligt hög belastning/timeout, samt lägger till knappen **"Lägg till manuellt"** under varje profil för att spara enskilda lovdagar/studiedagar direkt till `weekly_events` (`category: 'school_off'`).

## [0.17.0] – 2026-11-13 (Google Kalender-koppling via OAuth & automatiska lovdagar i Familjekalendern)
- **Automatisk visning av lovdagar & händelser (`FamilyCalendarCard.tsx`, `page.tsx`):** `Familjekalender & Lovdagar` visar nu automatiskt alla skollov, lediga dagar (`school_off`) och kalenderhändelser från `weekly_events` samt sparar nya händelser direkt dit (så de även syns i `Denna vecka` och `Händer idag`).
- **Google Kalender-koppling via Google-inloggning (`calendarClient.ts`, `FamilyCalendarCard.tsx`):** Admin (`isAdmin`) kan logga in/koppla med Google OAuth (`linkIdentity` / `signInWithOAuth`), välja er gemensamma familjekalender, hämta händelser till `weekly_events` (så alla surfplattor och familjemedlemmar ser dem), skicka upp barnens lovdagar till Google Kalender samt automatiskt spegla nya händelser som Admin lägger till direkt in i er gemensamma Google Kalender.

## [0.16.0] – 2026-11-13 (Middagsplanering för Admin, "Vad blir det till middag idag?" & "Händer idag"-widget för surfplattor)
- **Ny `"Händer idag"`-widget för väggplattor (`HappeningTodayCard.tsx`):** Visas på startvyn (*Hem & Styrning*) på surfplattor i kök/hall och desktop (`>= 640px`). Samlar dagens datum, *"Vad blir det till middag idag?"* (med snabbredigering för `admin`), dagens händelser från `weekly_events` (lovdagar, sophämtning, kalender/påminnelser), morgondagens sophämtningspåminnelse, live HA-sophämtningssensor samt upp till 3 nålade familjelappar.
- **Rollstyrd `"Vad blir det till middag idag?"` (`DinnerPlannerCard.tsx`, `page.tsx`):** Redigering kräver nu `canEdit={isAdmin}`. För övriga familjemedlemmar, surfplattor och barn (`child`-vyn med kompakt kort) visas den som en ren läs-widget med titeln *"Vad blir det till middag idag?"*, anteckningar och klickbar receptlänk.
- **Admin-flik för veckans middagar (`AdminDinnerTab.tsx`, `AdminPanel.tsx`):** Ny flik *"Veckans middag"* i `Redigera hemmet` där admin kan planera Mån–Sön för både *Denna vecka* och *Nästa vecka* (maträtt, anteckning/tillbehör och receptlänk) direkt mot `dinner_plans`.
- **Utökat middagsfönster (`useHomeData.ts`):** Hämtar `dinner_plans` för både innevarande och nästa vecka (`mondayStr`–`nextSundayStr`) så söndagens *"Imorgon"* och nästa veckas planering alltid fungerar.

## [0.15.0] – 2026-11-13 (Smart Sophämtning med Kommun, Gemini-synk & 1–2 dagars påminnelse)
- **Kommun- & kärlinställning direkt på kortet (`WasteScheduleCard.tsx`):** Visar sparad kommun från `household_settings`, har fällbar panel *"Ställ in kommun & kärl"* med textfält för kommun och område/kärl samt knappen *"Hämta schema med Gemini"* (`gemini-hub-assistant` med `action: 'sync_waste_schedule'`) och manuell knapp *"+ Lägg till enstaka tömning"*.
- **Automatiska påminnelser 0, 1 och 2 dagar innan (`WasteScheduleCard.tsx`):** Visar de 4 närmaste kommande `waste`-händelserna från `weekly_events` med tydliga badges (*"Töms idag!"* med pulsande ikon, *"Imorgon – ställ ut tunnan!"*, *"Om 2 dagar"*) samt radering av enstaka rader.
- **Startvy-påminnelse (`HomeSummariesBar.tsx`):** Visar en klickbar påminnelse-pill i hus-sammanfattningarna när en sophämtning ligger inom 0–2 dagar som leder direkt till *Familjen & Veckan*.

## [0.14.0] – 2026-11-13 (Taktil Post-it-anslagstavla med färgval & namnmärkning)
- **Databas & Typer (`types.ts`):** Lade till `NoteColor` (`'ochre' | 'sage' | 'terracotta' | 'linen'`), `note_color`, `target_profile_id` och `target_name` på `FamilyNote`.
- **Snabb Post-it-skapning (`FamilyBoard.tsx`):** Tog bort Gemini-kryssrutan för blixtsnabb inmatning med textfält (*"Skriv en kom-ihåg-lapp..."*), 4 färgprickar (*Honungsgul*, *Salviagrön*, *Terrakotta*, *Linnevit*), dynamiska mottagar-piller (`Alla` + familjeprofiler där `role !== 'tablet'`) och knappen **"+ Sätt upp"**.
- **Taktil anslagstavla (`FamilyBoard.tsx`):** Varm kork-/linneinramning, responsivt rutnät (2 kolumner på mobil/Fold, 2–3 kolumner på tablet/desktop), pappersbakgrund i vald färg för både Ljust Linne och Mörk Valnöt, häftstiftsdetalj, diskret papperslutning, `Till: <Namn>`/`Till: Alla`-badge, avsändarens avatar + `✓ Klar` / ta bort-knappar samt tydlig markering av lappar riktade till barnet i barnvyn.

## [0.13.0] – 2026-11-13 ("Fråga Almvägen" & Verifierad Gemini-hjärna)
- **Ny `"Fråga Almvägen"`-komponent (`AskHouseCard.tsx`):** Kompakt AI-kort i jordnära linne-/valnötstema med inmatningsfält, tre snabbfråge-piller (*"Vilka lampor lyser?"*, *"Hur ser veckan ut?"*, *"Vad blir det till middag?"*) och tydlig svarsruta. Döljs helt för `child`-profiler, visas fullt ut i *Familjen & Veckan* och som fällbar fråge-pill under *Hem & Styrning* på mobil/tablet (`< 1024px`).
- **Realtidskontext (`house_context`):** Sammanställer automatiskt rums- och enhetsstatus från Home Assistant (`useHomeAssistant`), dashboard-widgets, `weekly_events` och `dinner_plans` utan hårdkodade `entity_id` och anropar `gemini-hub-assistant` (`action: 'ask_house'`).
- **Verifierad lovdagssynk & anslagstavla (`AdminPanel.tsx`, `FamilyBoard.tsx`):** Förbättrad felåterkoppling för `sync_school_and_waste` med omedelbar `refetch` av `weekly_events`, samt tydlig varm bekräftelsetoast i `FamilyBoard.tsx` efter `parse_family_input` med realtidsuppdatering av `family_notes`, `dinner_plans` och `weekly_events`.

## [0.12.0] – 2026-11-13 (Fristående Snabb-PIN via RPC & Edge Function)
- **Direkt Snabb-PIN utan föregående admin-inlogg (`LoginScreen.tsx`):** Startskärmen hämtar familjemedlemmar och surfplattor direkt via `supabase.rpc('get_pin_profiles')` även i oinloggat läge och visar klickbara avatar-kort med roll-badge och PIN-status (`Saknar PIN` om PIN saknas).
- **Riktig Supabase-session via `pin-login` (`LoginScreen.tsx`):** Vid 4-siffrig PIN anropas Edge Function `pin-login` (med fallback till `bright-responder`), returnerad `token_hash` verifieras via `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` och `active_profile_id` sparas i `localStorage`.
- **PIN-sessionsstöd i `AuthProvider.tsx`:** Läser `user_metadata.profile_id` för `@family.almvagen.local`-sessioner och sparad `active_profile_id` / `almvagen_active_profile_id` från `localStorage`, samt rensar låsstatus vid `SIGNED_IN` och håller profilväxling i `ProfileSwitcherModal` synkad med `baseProfile`.

## [0.11.0] – 2026-11-13 (Klickbar Snabb-PIN per familjemedlem & surfplatta)
- **Klickbara profilkort i Snabb-PIN (`LoginScreen.tsx`):** När en enhet är auktoriserad hämtas alla profiler från `public.profiles` och visas som taktila avatar-kort med namn, roll-badge (`Admin` / `Väggplatta` / `Familjemedlem`) och PIN-indikator. Klick på en profil med `quick_pin` öppnar sifferknappsatsen för just den personen (`switchProfile`), medan profiler utan PIN aktiveras direkt med ett tryck.
- **Tydlig onboarding för nya enheter (`LoginScreen.tsx`):** Om enheten saknar aktiv familjesession visas en tydlig vägledning under Snabb-PIN-fliken om att logga in med e-post och lösenord första gången.
- **Stabil profilpersistens (`AuthProvider.tsx`):** Rensar `almvagen_active_profile_id` vid nytt e-post-/lösenordsinlogg och gör `unlockWithPin` säker mot dubblett-PIN med `.limit(1)`.

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
