# BACKLOG.md – Almvägen Family Hub

Framtida utveckling, integrationer och roadmap för **Almvägen Family Hub**.

| Status | Funktion / Integration | Beskrivning |
| :--- | :--- | :--- |
| **Pågår** | **Home Assistant på dedikerad Intel NUC** | Koppling mot live Home Assistant via `wss://almvagen.sidequestlabs.se/api/websocket` och konfigurering av alla husets rum och enheter via Admin-panelen (nästa steg vid hemkomst). |
| **Klar** | **Google Kalender-koppling** | `FamilyCalendarCard.tsx` + `calendarClient.ts` visar `weekly_events` (lovdagar & lediga dagar) automatiskt och stöder tvåvägssynk mot gemensam Google Kalender via Google OAuth (kräver Google-provider aktiverad i Supabase Auth). |
| **Klar** | **Sophämtningsschema** | `WasteScheduleCard.tsx` med kommun- & kärlinställning, Gemini-synk (`sync_waste_schedule`), manuell fallback samt automatiska påminnelser 0–2 dagar före tömning i både kortet och `HomeSummariesBar.tsx`. |
| **Klar** | **Skollov & lediga dagar** | Skola/Kommun per profil i Admin + Gemini-synk via `gemini-hub-assistant` och visning i `ThisWeekCard.tsx` (`weekly_events`). |
| **Klar** | **Gemini AI-assistent** | Inbyggd AI-assistent via `gemini-hub-assistant` med tre lägen: *Fråga Almvägen* (`ask_house` i `AskHouseCard.tsx`), smart tolkning i `FamilyBoard.tsx` (`parse_family_input`) och lovdagssynk i `AdminPanel.tsx` (`sync_school_and_waste`). |
| **Klar** | **"Vad blir det till middag?" & "Händer idag"** | `AdminDinnerTab.tsx` + `DinnerPlannerCard.tsx` (admin redigerar, övriga ser *"Vad blir det till middag idag?"*) samt `HappeningTodayCard.tsx` (*"Händer idag"*) för väggplattor i kök/hall. |
| **Klar** | **KISS & Plug & Play-etappen (Steg A–C)** | 3-sekunders `RoomCard` + `RoomDetailDrawer`, kontextfiltrerad `IconPicker`, rollanpassade Zero Noise-vyer och automatisk HA-konfiguration i Admin. |
