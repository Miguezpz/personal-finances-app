# Quickstart: validar el spec 010

Solo UI: sin Docker ni Supabase local. Las animaciones que dependen de escrituras (alta, baja y pulso) se prueban con pruebas unitarias; su e2e `@live` queda omitido por decisión del usuario.

```bash
pnpm typecheck && pnpm lint && pnpm test
E2E_MODES=demo pnpm test:e2e
pnpm build && node scripts/measure-first-load.mjs
NEXT_PUBLIC_DEMO_MODE=true NEXT_DIST_DIR=.next-demo-check pnpm build && NEXT_DIST_DIR=.next-demo-check pnpm check:demo-bundle
```

| # | Pasos (demo) | Esperado |
|---|---|---|
| A | Gastos → Metas | Salida y entrada breves; el encabezado no se mueve |
| B | Recargar Gastos | La lista aparece con desvanecimiento al terminar de cargar |
| C | Metas | Las barras crecen desde cero |
| D | 390 px: hoja ＋ → arrastrar el asa 120 px | Se cierra; con 30 px vuelve a su lugar |
| E | Formulario con error | El mensaje aparece suave |
| F | Movimiento reducido | Todo instantáneo; sin animaciones activas |
