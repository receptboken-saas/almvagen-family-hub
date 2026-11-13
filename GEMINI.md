# GEMINI.md – Almvägen Family Hub

Läs `PROJECT_INSTRUCTIONS.md`, `DESIGN_SYSTEM.md` och `AGENTS.md` innan du gör ändringar.

## Viktiga regler
- **100 % datadrivet:** Inga hårdkodade rum, våningsplan eller `entity_id`.
- **Tema & Ikoner:** Följ `DESIGN_SYSTEM.md` (Fraunces + Plus Jakarta Sans, Ljust Linne / Mörk Valnöt, duotone SVG-ikoner i `CustomIcons.tsx`).
- **Statisk export:** Undvik server-endast Next.js-API:er eftersom appen byggs med `output: "export"`.
- **Verifiering:** Kör alltid `npx tsc --noEmit` och `npx next lint` före commit och push.
