# BACKLOG.md – Almvägen Family Hub

Framtida utveckling, integrationer och roadmap för **Almvägen Family Hub**.

| Status | Funktion / Integration | Beskrivning |
| :--- | :--- | :--- |
| **Pågår** | **Home Assistant på dedikerad Intel NUC** | Koppling mot live Home Assistant via `wss://almvagen.sidequestlabs.se/api/websocket` och konfigurering av alla husets rum och enheter via Admin-panelen (nästa steg vid hemkomst). |
| **UI klart** | **Google Kalender-koppling** | `FamilyCalendarCard.tsx` är byggd i *Familjen & Veckan* (redo för synk mot Google Kalender / `.ics`-flöde i nästa steg). |
| **Klar** | **Sophämtningsschema** | `WasteScheduleCard.tsx` med kommun- & kärlinställning, Gemini-synk (`sync_waste_schedule`), manuell fallback samt automatiska påminnelser 0–2 dagar före tömning i både kortet och `HomeSummariesBar.tsx`. |
| **Klar** | **Skollov & lediga dagar** | Skola/Kommun per profil i Admin + Gemini-synk via `gemini-hub-assistant` och visning i `ThisWeekCard.tsx` (`weekly_events`). |
| **Klar** | **Gemini AI-assistent** | Inbyggd AI-assistent via `gemini-hub-assistant` med tre lägen: *Fråga Almvägen* (`ask_house` i `AskHouseCard.tsx`), smart tolkning i `FamilyBoard.tsx` (`parse_family_input`) och lovdagssynk i `AdminPanel.tsx` (`sync_school_and_waste`). |
| **Klar** | **"Vad blir det till middag?"-modul** | `DinnerPlannerCard.tsx` sparar direkt i Supabase `dinner_plans` med KISS-standardvy (*Idag*/*Imorgon*) + veckoredigering och valfri receptlänk. |
| **Klar** | **KISS & Plug & Play-etappen (Steg A–C)** | 3-sekunders `RoomCard` + `RoomDetailDrawer`, kontextfiltrerad `IconPicker`, rollanpassade Zero Noise-vyer och automatisk HA-konfiguration i Admin. |
