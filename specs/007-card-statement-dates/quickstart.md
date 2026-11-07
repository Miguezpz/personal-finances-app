# Quickstart: validar spec 007

## Prerrequisitos

- Docker en marcha y Supabase local con `pnpm db:start`. Esta feature agrega una función SQL (`0010`), así que toca la capa de datos.
- Nunca correr pruebas, seeds ni `db reset` contra la nube.

## 1. Puertas automáticas

```bash
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                       # business-days, card-terms, credit, installments, esquema, CardTermsFields, paridad i18n
pnpm db:reset                   # aplica 0001…0010 en local
pnpm db:types                   # regenera database.types.ts con la función nueva
pnpm db:test                    # pgTAP: card-terms.test.sql + suites existentes
pnpm test:contract:local        # contrato mock + Supabase (C1–C7)
pnpm test:e2e:local             # us14 live + demo, EN/ES, a11y
pnpm check:demo-bundle
```

## 2. Escenarios manuales (local, `pnpm dev`)

| # | Escenario | Resultado esperado |
|---|---|---|
| A | Nueva tarjeta: corte 22 nov 2026, límite 7 dic 2026 | "Corte el día 22 · vence 15 días después" y 3 estados; al guardar, la lista de cuentas dice "día 22 · 15 días" |
| B | Las 6 tarjetas de [spec.md](spec.md) US1-3 | Cada una deriva exactamente su día y sus días |
| C | Límite = corte, o 61 días después | Error traducido; no se guarda |
| D | Nu, corte 23 sep 2026 → límite 5 oct 2026 | Aviso "pudo haberse recorrido…"; se puede guardar |
| E | Editar BBVA (día 5, 20) el 7 nov 2026 | Prellenado 5 nov / 25 nov; guardar sin cambios no cambia nada; la vista previa muestra 25 nov, **24 dic** (recorrido), 25 ene |
| F | "Capturar los números a mano" | Los campos numéricos de hoy, con la misma vista previa |
| G | Gastos › tarjeta con límite nominal en sábado | Muestra el viernes anterior; "Vencida" y "pago para no generar intereses" usan esa fecha |
| H | Tarjeta con MSI a 3 meses, 1.ª mensualidad cobrada; cambiar el corte | Por cobrar: las mensualidades 2 y 3 cambian su fecha; la 1 no |
| I | Cambiar solo el nombre de esa tarjeta | Las mensualidades no cambian |
| J | Cambiar la anticipación de cobro en Ajustes y recargar | Las fechas de cobro de las mensualidades pendientes se alinean (BackgroundSync) |
| K | Idioma ES y EN | Todos los textos y fechas en su idioma |

## 3. Demo (`pnpm dev:demo`)

- Editar una tarjeta del demo: fechas prellenadas y vista previa; guardar muestra el aviso de solo lectura.
- Los límites del seed se muestran ajustados (FR-014, US2-5).

## 4. Nube (solo con aprobación del usuario)

1. Aplicar `0010_update_card_terms.sql` al proyecto `potodtpkgadgsmeuuafx`. La app anterior no llama a la función, así que es seguro aplicarla antes del despliegue.
2. Revisar los advisors de seguridad: la función es `security invoker` y no tiene `search_path` mutable.
3. Desplegar el frontend desde git.
4. Abrir la app una vez. El `BackgroundSync` reprograma la única mensualidad pendiente (Banregio):
   - `card_due_on`: sáb 5 dic 2026 → **vie 4 dic 2026**;
   - `due_on`: 2 dic → **1 dic** (anticipación 3).

   Verificar con SQL de solo lectura.
5. Las 6 tarjetas conservan sus términos (SC-006).
