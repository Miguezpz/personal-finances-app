# Quickstart: validación de Personal Finances Core

Guía para levantar el proyecto y comprobar de extremo a extremo que la funcionalidad cumple el [spec](./spec.md).
Detalle de tipos y esquema: [data-model.md](./data-model.md) y [contracts/](./contracts/README.md).

## Prerrequisitos

- Node.js 22 LTS y pnpm
- Docker (para Supabase local) y Supabase CLI
- Navegador evergreen; Playwright instala los suyos

## 1. Variables de entorno

Copiar `.env.example` a `.env.local` (ignorado por git). Variables:

| Variable | Modo demo | Modo personal/local |
|----------|-----------|---------------------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `false` |
| `NEXT_PUBLIC_DEMO_URL` | — | URL pública del demo (botón "Explorar Demo") |
| `NEXT_PUBLIC_SUPABASE_URL` | no se usa | URL del proyecto (local: la que imprime `supabase start`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no se usa | clave publicable (nunca `service_role`) |

## 2. Escenario A — Demo (sin Supabase)

```bash
pnpm install
pnpm dev:demo                              # http://localhost:3000
```

Verificar:

1. Entra directo al dashboard con ≈ 6 meses de datos ficticios (US9-4).
2. Intentar crear/editar/eliminar cualquier registro muestra el toast de "demo de solo lectura" y no cambia nada (FR-047, SC-012).
3. En DevTools → Network: **0 peticiones** a `*.supabase.co` (Principio IV).
4. Alternar EN/ES, MXN/USD/EUR y Modo Privacidad (ver escenarios D–F).
5. Al cargar cada ruta no aparece ningún toast ni error: los procesos automáticos (fijos, aportaciones, instantáneas, onboarding) no se ejecutan porque `capabilities.canWrite` es `false` (FR-047a).

## 3. Escenario B — Modo personal contra Supabase local

```bash
supabase start                              # imprime URL y claves locales
supabase db reset                           # aplica supabase/migrations
# crear el único usuario desde Studio (http://localhost:54323): signups están deshabilitados
pnpm dev                                    # NEXT_PUBLIC_DEMO_MODE=false
```

Verificar el flujo P1 con datos nuevos:

1. **Reglas** (Settings): 50% Needs / 30% Wants / 20% Inversión; sub-reglas 90% Bolsa / 10% Sofipos. Guardar con suma ≠ 100% debe rechazarse (US1-3).
2. **Ingreso** de $20,000 recibido el día 15: asignaciones 10,000 / 6,000 / 3,600 / 400 financiando la quincena 16–fin de mes (US1-1/2/5).
3. **Gasto fijo** "Renta $8,000, día 1, Needs": aparece como *pendiente* desde el primer día de la quincena y *aplicado* al llegar el día; el saldo no cambia en la transición (US3-1, FR-008a).
4. **Gasto manual** con subcategoría de Wants: hereda la bolsa y actualiza el saldo y el semáforo al instante (US2-3, US4-1).
5. **Quincena siguiente**: el sobrante o déficit se arrastra a la misma bolsa (US2-6).
6. **Tarjeta**: un gasto de $500 con tarjeta baja el Safe-to-Spend ese día; registrar el pago de la tarjeta no lo modifica (US4-4/5).
7. **MSI**: compra de $12,000 a 6 meses para un deudor → 6 mensualidades de $2,000 con cobro anterior al límite de pago; marcar una cobrada no cambia el Safe-to-Spend (US5-1/2/6).

## 4. Escenarios transversales

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| D | Cambiar a USD/EUR con patrimonio de $100,000 MXN y tasa de 17.00 | Se muestra $5,882.35 USD con tasa y fecha visibles; al volver a MXN los datos son idénticos (US6-1/5, SC-008) |
| D2 | Bloquear la API de FX en DevTools (Offline para el dominio) | La app sigue en MXN, avisa la falta de tasa y permite reintentar; con tasa previa la muestra como "no actualizada" (US6-3, SC-009) |
| E | Primera visita (limpiar `localStorage`) y activar ES | Interfaz inicia en EN; cambia a ES sin recargar ni perder un formulario a medias; la preferencia persiste (US7, SC-010) |
| F | Activar Modo Privacidad y recorrer todas las rutas | 0 importes legibles, incluidos ejes y tooltips de gráficas; persiste al recargar (US9-1/2, SC-011) |
| G | Exportar datos (Settings) | Descarga CSV UTF-8 con todo el historial en MXN, abre bien en Excel (US8-3, SC-013) |
| H | Cold start: pausar el contenedor de Postgres local y recargar | Skeletons y mensaje "despertando la base de datos", reintentos y recuperación sin error crudo (FR-050) |

## 5. Pruebas automatizadas

```bash
pnpm typecheck                 # tsc --noEmit (strict)
pnpm lint                      # incluye no-explicit-any y restricción de imports de @supabase
pnpm test                      # Vitest: dominio (propiedades), i18n (paridad EN/ES), CSV
pnpm test:contract:local       # suite del DataProvider contra Mock y contra Supabase local
supabase test db               # pgTAP: RLS, aislamiento entre usuarios, sumas exactas
pnpm test:e2e:local            # Playwright, matriz modo × idioma (demo-en, demo-es, live-en, live-es): flujos P1, toggles,
                               #   demo de solo lectura y 0 peticiones a Supabase
pnpm check:demo-bundle         # el bundle de la demo no contiene Supabase ni claves
pnpm check:no-uploads          # FR-044: sin <input type="file"> ni uso de Storage
```

Casos mínimos que deben fallar antes de implementar (Test-First del dominio):

- `allocateByWeights`: para cualquier total y pesos válidos, `Σ resultado === total` (fast-check).
- `dueOccurrences`: llamar dos veces con el mismo estado no produce duplicados; día 31 en febrero → 28/29.
- `computeSafeToSpend`: el arrastre positivo y negativo coincide con los escenarios US2-1 y US2-6.
- `buildCollectionSchedule`: `Σ amount === total` y `dueOn < cardDueOn` para toda mensualidad.
- RLS: un segundo usuario no puede leer, insertar ni referenciar filas del primero.

## 6. Criterios de salida del plan

- [x] Los escenarios A–H pasan en demo y en modo personal, en EN y ES (ver *Verificación* abajo).
- [x] Verde en local: typecheck, lint, formato, unit, contrato, pgTAP y e2e (demo y live × EN/ES).
      CI ejecuta las mismas puertas.
- [x] El bundle de la demo no contiene `@supabase/*` ni claves (`pnpm check:demo-bundle`, con variables canario).
- [x] Ninguna RPC ni consulta de la BD contiene lógica de negocio (revisión de migraciones; los cálculos viven en `src/domain`).

### Verificación (T155, 2026-11-03)

Cada escenario quedó como prueba e2e automatizada que corre en ambos idiomas (`*-en`, `*-es`), así que
la verificación se repite en cada ejecución en lugar de depender de una revisión manual única:

| Escenario | Modo | Prueba |
|-----------|------|--------|
| A — Demo: entrada directa, solo lectura, 0 peticiones a Supabase, sin procesos en segundo plano | demo | `us9-demo`, `us9-demo-background`, `matrix` |
| B1–B2 — Reglas (suma ≠ 100 % rechazada) e ingreso de $20,000 con asignaciones exactas | live | `us1-income-split`, `matrix` |
| B3 — Fijo pendiente → aplicado sin cambiar el saldo | live | `us3-recurring`, `matrix` |
| B4–B5 — Gasto manual, semáforo y arrastre | live / demo | `us2-safe-to-spend`, `us4-expenses` |
| B6 — Tarjeta: la compra baja el Safe-to-Spend, el pago no | live | `us4-expenses` |
| B7 — MSI a terceros: calendario y cobro fuera del Safe-to-Spend | live | `us5-receivables` |
| D / D2 — Divisa de visualización y degradación a MXN sin tasa | demo | `us6-currency`, `matrix` |
| E — Primera visita en EN, cambio en sitio, persistencia | demo | `us7-language`, `matrix` |
| F — Privacidad en todas las rutas, ejes y tooltips incluidos | demo / live | `us9-privacy`, `matrix` |
| G — Exportar datos (CSV y respaldo ZIP) | live | `us8-settings-ledger` |
| H — Cold start (503 y latencia simulados) y sin conexión | live | `cold-start` |

Diferencia con la guía: el escenario H se simula interceptando las respuestas de la API (503 + latencia)
en lugar de pausar el contenedor de Postgres, para que sea reproducible en CI.
