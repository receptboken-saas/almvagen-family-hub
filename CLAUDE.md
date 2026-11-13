# CLAUDE.md – Almvägen Family Hub

Läs `PROJECT_INSTRUCTIONS.md`, `DESIGN_SYSTEM.md` och `AGENTS.md` innan du börjar arbeta.

## Snabbchecklista
- **Arkitektur:** Next.js App Router med `output: "export"` på Cloudflare (`hem.sidequestlabs.se`), Supabase RLS och Home Assistant WebSocket (`wss://almvagen.sidequestlabs.se/api/websocket`).
- **Noll hårdkodning:** Alla rum, enheter, widgets och profiler kommer från Supabase.
- **Dokumentation:** Uppdatera alltid `CHANGELOG.md` (och vid behov `BACKLOG.md`) vid nya features/commits.
- **Verifiering:** Kör `npx tsc --noEmit` och `npx next lint` innan commit & push till `main`.
