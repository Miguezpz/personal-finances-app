# Baseline: antes de la renovación visual (T002)

Fecha: 2026-11-04 · commit `64a4fd7` (`main`).

## First Load JS (SC-006)

Next 16 ya no imprime la columna "First Load JS" en la tabla de `pnpm build`, así que se mide con
`node scripts/measure-first-load.mjs <distDir>`: suma (gzip nivel 9) de todos los `<script src>` que carga el HTML
prerenderizado de la ruta.

Build: `NEXT_DIST_DIR=.next-baseline pnpm build` (modo live, `NEXT_PUBLIC_DEMO_MODE` sin definir).

| Ruta | Scripts | Raw | gzip |
|---|---|---|---|
| `/` | 17 | 940.6 kB | 294.0 kB |
| `/dashboard` | 20 | 1050.6 kB | 331.6 kB |

Presupuesto de la feature: cada ruta ≤ línea base + 20 kB (gzip).

Tabla de rutas: las 16 rutas de `(app)` y `/` prerenderizadas como estáticas (`○`), `/auth/callback` dinámica (`ƒ`),
más el Proxy.

## E2E (demo)

`E2E_MODES=demo pnpm test:e2e` → **34 passed** (1.2 min), demo-en + demo-es.

## Paleta de gráficas (T003)

Ver `research.md` R15: los valores iniciales fallaban el piso de croma (claro) y la banda de luminosidad (oscuro) del
validador de `dataviz`; se fijaron `#048E84 / #EB6834 / #2A78D6` (claro) y `#17AD7B / #DC7611 / #5195E9` (oscuro).
