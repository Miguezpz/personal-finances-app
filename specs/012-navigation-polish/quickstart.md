# Quickstart — Spec 012

1. `pnpm typecheck && pnpm lint && pnpm test`
2. `E2E_MODES=demo pnpm test:e2e` (sin Docker ni Supabase local)
3. `pnpm build && pnpm check:demo-bundle`
4. Visual: `pnpm dev:demo`; capturas a 320/390/768/1440 px en neón, claro y oscuro: "Más", hoja ＋, Metas con scroll, Dashboard a 768 px. Esperado: ≤ 50 % de alto en "Más", ＋ dentro de la barra, 1 solo lima sólido en neón, sin recortes a 768 px.
