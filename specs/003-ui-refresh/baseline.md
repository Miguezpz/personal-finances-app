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

## Resultado final (T060)

Mismo método y mismo modo (live, `NEXT_DIST_DIR=.next-compare pnpm build`), tras la implementación:

| Ruta | Base (gzip) | Final (gzip) | Δ | Presupuesto (+20 kB) |
|---|---|---|---|---|
| `/` | 294.0 kB | 297.7 kB | **+3.7 kB** | ✅ |
| `/dashboard` | 331.6 kB | 337.4 kB | **+5.8 kB** | ✅ |

La primera medición tras US4 dio **+44.5 kB / +41.0 kB** (fuera de presupuesto). Causas: el `MotionProvider` estático
(`LazyMotion` + `MotionConfig`) metía ~10 kB del núcleo de Framer Motion en todas las rutas, el `m.div` del dashboard
otros ~10 kB, y el menú de Radix del `ThemeToggle` (ahora en header y landing) ~16 kB. Correcciones (research R8,
«Revisión T060»): Framer Motion solo vive en `NavIndicatorMotion`, cargado con `next/dynamic` (`ssr: false`); la
entrada escalonada pasa a CSS; `ThemeMenu` se carga en diferido detrás de un disparador idéntico. Verificado: ningún
script de primera carga de `/` ni `/dashboard` contiene código de Framer Motion ni del menú de Radix.

Build demo (`NEXT_PUBLIC_DEMO_MODE=true pnpm build`) + `pnpm check:demo-bundle`: ✅ «317 files scanned, no Supabase
code, URLs or keys».

## Revisión visual / Lighthouse (T062)

No ejecutado: las skills `ui-ux-pro-max`/`impeccable` no están instaladas y Lighthouse no está disponible en el
entorno (no se instaló). Cubierto en su lugar por: test de contraste (`tests/unit/theme-contrast.test.ts`, 56 pares),
axe en claro, oscuro y móvil (todas las rutas y diálogos principales, sin problemas graves ni críticos) y revisión
de capturas en 375 y 1440 px en ambos temas. Para completarlo:
`NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm start`, y Lighthouse móvil sobre `/dashboard`.
