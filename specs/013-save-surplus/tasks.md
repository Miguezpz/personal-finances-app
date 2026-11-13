# Tasks: Ahorrado de la quincena

**Input**: `specs/013-save-surplus/` (plan, spec, research, data-model, contracts/domain.md, contracts/data.md, quickstart)

**Formato**: `- [ ] T### [P] [USn] descripción con ruta`.
- Las pruebas de dominio se escriben primero y deben fallar.
- El contrato y pgTAP necesitan Supabase local (Docker).
- **La migración se aplica a la nube antes de hacer push del código que lee `save_surplus`, y solo con confirmación del dueño.**

## Phase 1: Fundacional (bloquea todo)

- [X] T001 Crear `supabase/migrations/0013_save_surplus.sql` según `contracts/data.md`: `alter table public.user_settings add column save_surplus boolean not null default false;` más el `comment on column`.
- [X] T002 [P] Crear `supabase/tests/save-surplus.test.sql` (pgTAP, mismo encabezado que `card-terms.test.sql`):
  - `has_column`, `col_not_null` y `col_default_is('public','user_settings','save_surplus','false')`.
  - Un usuario nuevo tiene `save_surplus = false`.
  - El dueño puede actualizarla y otro usuario no la ve (RLS).
- [X] T003 En `src/domain/types.ts`, agregar `UserSettings.saveSurplus: boolean` ("true = el sobrante de cada quincena va a Ahorrado; spec 013"). En `src/domain/settings.ts`, `DEFAULT_USER_SETTINGS.saveSurplus = false`.
- [X] T004 [P] En `src/data/supabase/database.types.ts`, agregar `save_surplus` a `user_settings`: `boolean` en `Row`; `boolean` opcional en `Insert` y `Update`. En `src/data/supabase/mappers.ts`, `toUserSettings` agrega `saveSurplus: r.save_surplus` y `fromSettings` agrega `save_surplus` cuando viene definido.
- [X] T005 [P] En `src/domain/csv.ts`, agregar la columna `save_surplus` a `settings.csv` (encabezado y valor). Actualizar `tests/unit/domain/csv.test.ts` si fija los encabezados.
- [X] T006 [P] Contrato:
  - `tests/contract/schemas.ts`: `saveSurplus: z.boolean()`.
  - `tests/contract/data-provider.contract.ts`: ida y vuelta de `settings.update({ saveSurplus: true })` y de vuelta a `false`.
- [X] T007 Correr `pnpm typecheck` y corregir los literales de `UserSettings` en pruebas y fixtures que pidan el campo nuevo.

## Phase 2: US1 — El sobrante se guarda y no infla la quincena siguiente (P1) 🎯 MVP

**Independent test**: con `saveSurplus: true`, un cierre de +$400 en Gustos da `carryIn = 0` y `saved.lastPeriod = 400`; un cierre de −$400 se sigue arrastrando.

- [X] T008 [US1] En `tests/unit/domain/safe-to-spend.test.ts`, nuevo `describe("save surplus (spec 013)")` con los casos de quickstart §1, que fallan primero:
  - Sobrante.
  - Faltante.
  - Buckets mixtos.
  - Tres quincenas (total 600 y quincena pasada 300).
  - Ajuste apagado da `saved === null`.
  - Datos del dueño: Necesidades 294,187 en `2026-11-16` y 250,794 en `2026-11-01`; Gustos 147,093 y 125,396; gastos de Necesidades por 112,900 y de Gustos por 30,500 en `2026-11-1`; Gym de 49,900 el día 18 con inicio el `2026-11-05`; hoy `2026-11-13`. Resultado esperado: Necesidades 244,287, Gustos 147,093 y quincena pasada 232,790.
- [X] T009 [US1] En `src/domain/safe-to-spend.ts` (según `contracts/domain.md` y R1/R2):
  - `SafeToSpendInput.settings` incluye `saveSurplus`.
  - Una función interna `carryChain(input, upTo)` hace la transferencia al entrar a cada quincena después de la primera: si el ajuste está encendido, por bucket `saved += max(balance, 0)` y `balance = min(balance, 0)`. Registra la última transferencia y el total.
  - `computeCarryChain` devuelve `carryChain(...).chain`, con la misma firma.
  - `SafeToSpend.saved` vale `{ lastPeriod, total }`, o `null` si el ajuste está apagado.
  - Actualizar las fórmulas del comentario de cabecera.
  - T008 debe pasar y la prueba de rendimiento debe seguir por debajo de 50 ms.
- [X] T010 [P] [US1] En `tests/unit/domain/net-worth.test.ts`, un caso con dos quincenas con sobrante: `computeNetWorth` es igual con `saveSurplus` encendido y apagado. Implementar en `src/domain/net-worth.ts`: `assets += sts.saved?.total ?? 0`, y actualizar el comentario de cabecera.

## Phase 3: US2 — Encender o apagar el ajuste (P1)

**Independent test**: en Preferencias, encender el interruptor y guardar; el Dashboard cambia sin recargar.

- [X] T011 [US2] En `src/features/settings/preferences/schema.ts`, agregar `saveSurplus: z.boolean()`. En `tests/unit/features/settings-schemas.test.ts`, el valor pasa sin cambios.
- [X] T012 [US2] En `src/features/settings/preferences/PreferencesForm.tsx`:
  - `defaultValues.saveSurplus = settings.saveSurplus`.
  - Un `Controller` con `Switch` (`id="pref-save-surplus"`, `data-testid="pref-save-surplus"`, mismo patrón que `AddExpenseDialog.tsx` ~L349) dentro de un `Field` con `FieldLabel` y `FieldDescription`, debajo de los días de pago.
  - Se guarda con el `onSubmit` que ya existe.
- [X] T013 [P] [US2] Agregar en `src/i18n/messages/es.json` y `en.json` las llaves `settings.saveSurplusLabel` y `settings.saveSurplusHint`, con los textos de la tabla en `contracts/domain.md`.

## Phase 4: US3 — Ver lo ahorrado (P2)

**Independent test**: el demo muestra `saved-card` con dos montos; con el modo privacidad están enmascarados.

- [X] T014 [US3] Crear `src/features/safe-to-spend/SavedCard.tsx`:
  - Una `Card` (`data-testid="saved-card"`) con título `dashboard.savedTitle`, ayuda `dashboard.savedHint` y dos filas `<dl>`: `saved-last` (`dashboard.savedLastPeriod`) y `saved-total` (`dashboard.savedTotal`), con `<Money>`.
  - Icono de Lucide `PiggyBank` con `aria-hidden`.
- [X] T015 [US3] En `src/features/safe-to-spend/Dashboard.tsx`, mostrar `<SavedCard saved={data.saved} />` debajo de la cuadrícula de buckets cuando `data?.saved` exista.
- [X] T016 [P] [US3] Agregar las llaves `dashboard.savedTitle`, `savedLastPeriod`, `savedTotal` y `savedHint` en `es.json` y `en.json`.
- [X] T017 [P] [US3] En `src/data/mock/seed.ts`, `settings = { ...DEFAULT_USER_SETTINGS, saveSurplus: true }`. Verificar `tests/unit/data/mock-seed-consistency.test.ts` y `third-party-isolation.test.ts`.

## Phase 5: Cierre

- [ ] T018 Crear `tests/e2e/us17-save-surplus.spec.ts`:
  - **Demo** (EN y ES): `saved-card` visible con `saved-last` y `saved-total`. Con el modo privacidad, sin montos legibles, con el mismo patrón que `READABLE_AMOUNT` de `matrix.spec.ts`. En `/settings/preferences`, cambiar `pref-save-surplus` y guardar muestra el aviso de solo lectura.
  - **Live**:
    - Se siembra con `currentQuincena(today)`: una asignación de Gustos de $1,000 en la quincena anterior y un gasto de $300 dentro de su rango.
    - Encender y guardar, y sin recargar el Dashboard: `saved-last` muestra $700 y el arrastre de Gustos es $0.
    - Apagar y guardar: `saved-card` desaparece.
- [ ] T019 Puertas: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`; `pnpm test:contract:local`; `pnpm db:test`; `E2E_MODES=demo pnpm test:e2e`; y `pnpm test:e2e:local tests/e2e/us17-save-surplus.spec.ts`.
- [ ] T020 [P] En `README.md`, mencionar en la fila de Safe-to-Spend el ajuste opcional "Guardar el sobrante": lo que sobra va a Ahorrado y no se arrastra.
- [ ] T021 **Nube (con confirmación del dueño)**:
  - Aplicar `0013` con el MCP de Supabase (`apply_migration`) al proyecto `potodtpkgadgsmeuuafx`.
  - Corregir la versión en `supabase_migrations.schema_migrations` al prefijo `0013`.
  - Verificar con `list_migrations`.
  - Solo entonces, commit y push del código y revisar el CI.
- [ ] T022 Verificación manual en la app personal (quickstart §3).

## Dependencies

- La Phase 1 bloquea todo. T001 va antes de T002. T003 va antes de T004, T005, T006 y T007.
- US1: T008 va antes de T009. T010 depende de T009.
- US2: T011 va antes de T012. T013 en paralelo.
- US3 depende de US1 (`SafeToSpend.saved`). T014 va antes de T015. T016 y T017 en paralelo.
- El cierre va al final. T021 va antes del push del código. Los commits de docs se pueden subir antes.

## Parallel examples

- Phase 1: T002 ∥ T004 ∥ T005 ∥ T006, después de T001 y T003.
- US2 y US3 en paralelo una vez cerrada US1 (no comparten archivos, salvo los JSON de i18n, que se editan en serie).

## Implementation strategy

- **MVP**: Phases 1 y 2, más T011 y T012, porque sin el interruptor no se puede encender.
- Después: la tarjeta (US3), las e2e, las puertas, la nube con tu confirmación y el push.
- Mientras la migración no esté en la nube, **el código se queda en commits locales sin push**.
