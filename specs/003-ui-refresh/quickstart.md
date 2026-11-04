# Quickstart: validar la renovación visual

Guía para comprobar de punta a punta que la feature cumple la spec. Detalles de tokens, testids y reglas de
movimiento: [contracts/ui-theme.md](./contracts/ui-theme.md). Modelo de la preferencia: [data-model.md](./data-model.md).

## Prerrequisitos

- `pnpm install` (sin dependencias nuevas; `next-themes` debe haber desaparecido de `package.json`).
- Para e2e solo demo: nada más. Para `live-*`: Supabase local (`pnpm db:start`).

## 0. Línea base (antes de implementar)

```bash
pnpm build                          # anotar "First Load JS" de /dashboard y /
E2E_MODES=demo pnpm test:e2e        # todo en verde (punto de partida)
```

## 1. Gates automáticos

```bash
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                           # incluye theme-contrast.test.ts y preferences-theme.test.ts
E2E_MODES=demo pnpm test:e2e        # a11y (claro, oscuro, móvil), theme-motion, privacy, perf-budgets, matrix
pnpm test:e2e:local                 # demo + live con Supabase local (CI corre los 4 proyectos)
NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle
```

Esperado: todo en verde; `pnpm build` muestra un First Load JS de `/dashboard` ≤ línea base + 20 kB (SC-006).

## 2. Validación manual (`pnpm dev:demo`, http://localhost:3000)

| # | Escenario | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Abrir `/` y `/dashboard` en tema claro | Fondo blanco/bruma, texto tinta, logo propio, un solo botón esmeralda por pantalla | US1, FR-001…009, SC-007 |
| 2 | Mirar la pestaña del navegador (claro y oscuro) | Ícono de la marca legible | FR-010, SC-010 |
| 3 | Semáforo de un bucket en verde / ámbar / rojo | Verde de marca; ámbar y rojo como antes; siempre con ícono y texto | FR-012 |
| 4 | `/net-worth` | Tres series distinguibles con leyenda, sobre bloque claro | FR-013/014 |
| 5 | macOS en modo oscuro, borrar `localStorage`, recargar | Arranca en oscuro sin destello claro (incluido el skeleton) | US3, FR-015/016, SC-004 |
| 6 | Tema → "Claro", recargar | Persiste en claro aunque el SO esté en oscuro; barra del navegador móvil en blanco | FR-016, FR-011 |
| 7 | Tema → "Sistema", cambiar el SO de claro a oscuro | La app cambia en vivo | FR-017 |
| 8 | DevTools a 375 × 812 (modo táctil) | Barra inferior con 4 destinos + "Más"; CTA flotante; header con logo, privacidad y "Preferencias"; sin scroll horizontal | US2, FR-019…021, FR-024 |
| 9 | Pulsar el CTA flotante | El formulario de gasto sube desde abajo; teclado numérico en el monto | FR-022, FR-025, SC-003 |
| 10 | `/ledger` en 375 px | Movimientos como tarjetas apiladas | FR-023 |
| 11 | 320 px de ancho | Nada se desborda ni se solapa | Edge cases, FR-024 |
| 12 | 1440 × 900 | Sidebar fija, buckets lado a lado sin scroll | FR-026, SC-008 |
| 13 | Cambiar de sección | El indicador se desliza; el contenido aparece con fundido | FR-028 |
| 14 | Recargar el dashboard / volver a él | Entrada escalonada solo la primera vez en la sesión | FR-029 |
| 15 | (live) Guardar un gasto | La tarjeta afectada se realza; la cifra aparece ya con su valor final | FR-030 |
| 16 | Activar y desactivar privacidad | Al activar: montos a `••••` al instante (el blur entra con transición sobre `••••`) y campos de monto difuminados al instante; al desactivar, el blur se desvanece | FR-032 |
| 17 | Activar "Reducir movimiento" en macOS y repetir 13–16 | Ningún deslizamiento, escalado, brillo ni entrada; cambios instantáneos | FR-035, SC-005 |
| 18 | Instalar en un móvil real (Chrome Android / Safari "Añadir a inicio") | Nombre e ícono de la marca, splash en bruma | FR-010, SC-010 |
| 19 | Repetir 1, 8 y 13 con el idioma en ES | Todos los textos nuevos traducidos | FR-036, SC-009 |
| 20 | Navegar solo con teclado (escritorio) | Primer Tab = saltar al contenido; foco visible teal (claro) / esmeralda (oscuro) | FR-008, edge cases |

## 3. Lighthouse (opcional, build de producción)

```bash
NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm start
```

Lighthouse móvil en `/dashboard`: Accesibilidad ≥ 95; Rendimiento sin regresión respecto a la línea base.
