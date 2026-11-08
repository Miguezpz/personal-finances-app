# Quickstart: validar el spec 009

Solo UI: sin Docker ni Supabase local. Los e2e `@live` (escrituras reales: recordar lo último usado, deshacer, reintentar) se omiten por decisión del usuario.

```bash
pnpm typecheck && pnpm lint && pnpm test
E2E_MODES=demo pnpm test:e2e
pnpm build && node scripts/measure-first-load.mjs
NEXT_PUBLIC_DEMO_MODE=true NEXT_DIST_DIR=.next-demo-check pnpm build && NEXT_DIST_DIR=.next-demo-check pnpm check:demo-bundle
```

| # | Pasos (demo) | Esperado |
|---|---|---|
| A | Nuevo gasto | Chips Hoy/Ayer/Otra, subcategorías recientes; "250,5" se valida |
| B | Borrar un gasto en demo | Aviso de solo lectura; la fila no desaparece |
| C | Gastos a 390 px | Filas tocables, agrupadas por día; tocar abre la edición con "Borrar" |
| D | Gastos → chip "Gustos" | Solo gastos de Gustos; el enlace lleva `?bucket=wants` |
| E | Bitácora → "Mes pasado" + buscar | El enlace lleva `preset` y `q`; recargar lo conserva |
| F | Dashboard → "Ver gastos" de Necesidades | Gastos con `bucket=needs` |
| G | Hoja ＋ → "Administrar" | Configuración → Gastos rápidos |
| H | Por cobrar a 390 px | Cuotas como tarjetas, sin scroll horizontal |
