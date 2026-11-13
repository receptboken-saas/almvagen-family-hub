# BACKLOG.md – Almvägen Family Hub

Framtida utveckling, integrationer och roadmap för **Almvägen Family Hub**.

| Status | Funktion / Integration | Beskrivning |
| :--- | :--- | :--- |
| **Pågår** | **Home Assistant på dedikerad Intel NUC** | Koppling mot live Home Assistant via `wss://almvagen.sidequestlabs.se/api/websocket` och konfigurering av alla husets rum och enheter via Admin-panelen (nästa steg vid hemkomst). |
| **UI klart** | **Google Kalender-koppling** | `FamilyCalendarCard.tsx` är byggd i *Familjen & Veckan* (redo för synk mot Google Kalender / `.ics`-flöde i nästa steg). |
| **UI klart** | **Sophämtningsschema** | `WasteScheduleCard.tsx` är byggd med datadrivet schema och automatisk påminnelse kvällen före tömning. |
| **UI klart** | **Skollov & lediga dagar** | Stöd för lovdagar/studiedagar är inbyggt i `FamilyCalendarCard.tsx`. |
| **Planerad** | **Gemini AI-assistent** | Inbyggd AI-assistent i hubben för smarta frågor om hemmet, energiråd (Tibber/NIBE) och röst-/textstyrning. |
| **UI klart** | **"Vad blir det till middag?"-modul** | `DinnerPlannerCard.tsx` är byggd med veckomatsedel och inline-redigering i Supabase (nästa steg: receptkoppling mot `koksnissen.se`). |
| **Klar** | **KISS & Plug & Play-etappen (Steg A–C)** | 3-sekunders `RoomCard` + `RoomDetailDrawer`, kontextfiltrerad `IconPicker`, rollanpassade Zero Noise-vyer och automatisk HA-konfiguration i Admin. |
