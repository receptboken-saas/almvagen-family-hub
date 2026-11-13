# AGENTS.md – Almvägen Family Hub

Läs alltid `PROJECT_INSTRUCTIONS.md`, `DESIGN_SYSTEM.md`, `BACKLOG.md` och `CHANGELOG.md` innan du gör ändringar.

## Obligatoriska kodregler
1. **Zero Hardcoding:** Lägg aldrig till hårdkodade hus, våningar, rum eller Home Assistant `entity_id` i koden. Allt ska komma från Supabase och Home Assistant WebSocket.
2. **TypeScript Strict:** Ingen `any` utan skäl; all ny kod ska passera `npx tsc --noEmit`.
3. **Designsystem:** Använd alltid CSS-variablerna (`--bg-canvas`, `--bg-card`, `--bg-subtle`, `--border-subtle`, `--text-primary`, `--text-secondary`) och våra jordnära accenter (`#6B8E6B`, `#C86D51`, `#D49A42`) så att både Ljust Linne och Mörk Valnöt fungerar.
4. **Cloudflare Static Export:** Appen exporteras statiskt (`output: "export"`). Använd inga server-side Next.js-funktioner (API routes, `cookies()`, SSR).
5. **Versionshantering:** Uppdatera alltid `CHANGELOG.md` (och vid behov `BACKLOG.md`) vid varje ny feature eller commit.
6. **Verifiering före push:** Kör alltid `npx tsc --noEmit` och `npx next lint` (0 errors, 0 warnings).
