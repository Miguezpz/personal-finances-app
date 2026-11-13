# Implementation Plan: Ahorrado de la quincena

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-save-surplus/spec.md`

## Summary

Un ajuste de Preferencias, `saveSurplus`, apagado por defecto. Al encenderlo, el sobrante positivo de cada bucket al cerrar una quincena deja de arrastrarse y se acumula como **Ahorrado**. Los faltantes se siguen arrastrando. El Dashboard muestra una tarjeta "Ahorrado" con la quincena pasada y el total.

**Enfoque**:
- **Datos**: migración `0013` con la columna `user_settings.save_surplus boolean not null default false`. Se recorre el mismo camino que `emergencyFundMonths`: tipos, defaults, mappers, `database.types`, contrato y CSV.
- **Dominio**: la cadena de arrastre de `safe-to-spend.ts` hace la transferencia a Ahorrado al pasar de una quincena a la siguiente (R1). `SafeToSpend.saved` es `{ lastPeriod, total } | null`. `net-worth.ts` suma `saved.total` (R3).
- **UI**: un `Switch` en Preferencias, guardado con el `useUpdateSettings` optimista que ya existe (R4), y `SavedCard` en el Dashboard.
- **Demo**: el seed trae `saveSurplus: true` (R5).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase).

**Primary Dependencies**: Next.js 16.4, React 19.3, next-intl 4, TanStack Query 5, react-hook-form + zod, shadcn/ui (`Switch`). **Sin dependencias nuevas.**

**Storage**: Supabase Postgres. Migración `supabase/migrations/0013_save_surplus.sql`: una columna con default, sin políticas nuevas porque es la misma tabla con RLS.

**Testing**:
- Vitest: dominio (pruebas que fallan primero), esquema y formulario, paridad i18n, contrato mock/Supabase.
- pgTAP.
- Playwright: demo y `@live`, en EN y ES.

**Target Platform**: web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: la cadena de arrastre sigue siendo O(movimientos + quincenas). La prueba de 5 años sigue por debajo de 50 ms. El cambio del ajuste se ve al instante, porque la mutación es optimista (SC-003).

**Constraints**:
- Costo cero (Principio I) y cálculo en el cliente (Principio V).
- Demo con escritura bloqueada.
- Textos en diccionarios EN/ES.
- La migración se aplica a la nube **antes** de hacer push del código que la lee, solo con aprobación del dueño, y luego se corrige la versión en `list_migrations` (memoria `migration-before-push`).

**Scale/Scope**: 1 usuario real. Unos 3 archivos nuevos y unos 14 tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
| --------- | ------------ |
| I. Zero-cost | Una columna en una tabla existente. Sin servicios ni cron. ✅ |
| II. TS estricto y stack | Lógica pura en `safe-to-spend.ts`. Formulario con react-hook-form + zod; `Switch` de shadcn. ✅ |
| III. Supabase con RLS | Columna en `user_settings`, que ya tiene RLS por dueño. Migración versionada. pgTAP del default. ✅ |
| IV. Demo aislado | El seed enciende el ajuste. `settings.update` ya pasa por `denyWrite` en el mock. ✅ |
| V. Privacidad / cliente | Ahorrado se deriva en el cliente. Los montos van con `<Money>`, así que el modo privacidad los enmascara. ✅ |
| VI. i18n y multi-divisa | Llaves nuevas EN/ES con paridad. Los montos se muestran en la divisa elegida y no se persisten. ✅ |
| Flujo | Spec → plan → tareas. Safe-to-Spend y Patrimonio llevan pruebas antes de cerrarse. Verificación en normal y demo, EN y ES. ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/013-save-surplus/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/domain.md · contracts/data.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/0013_save_surplus.sql            # nuevo
supabase/tests/save-surplus.test.sql                 # nuevo pgTAP

src/domain/
├── types.ts            # UserSettings.saveSurplus
├── settings.ts         # default false
├── safe-to-spend.ts    # transferencia a Ahorrado en la cadena; SafeToSpend.saved
├── net-worth.ts        # + saved.total
└── csv.ts              # columna save_surplus

src/data/
├── supabase/database.types.ts · supabase/mappers.ts
└── mock/seed.ts        # demo con saveSurplus: true

src/features/
├── settings/preferences/schema.ts · PreferencesForm.tsx   # Switch
└── safe-to-spend/Dashboard.tsx · SavedCard.tsx (nuevo)

src/i18n/messages/{en,es}.json

tests/
├── unit/domain/safe-to-spend.test.ts · net-worth.test.ts · csv.test.ts
├── unit/features/settings-schemas.test.ts (+ prueba del formulario de Preferencias, si existe)
├── contract/schemas.ts · contract/data-provider.contract.ts
└── e2e/us17-save-surplus.spec.ts (nuevo; demo + live)
```

**Structure Decision**: un solo proyecto Next.js con las capas que ya existen.

## Fases de implementación (para `/speckit-tasks`)

1. **Fundacional**:
   - Migración `0013` y pgTAP.
   - `UserSettings.saveSurplus` en tipos, defaults, mappers, `database.types`, contrato y CSV.
2. **US1 (P1)**:
   - Pruebas de dominio que fallan primero.
   - Transferencia en la cadena y `SafeToSpend.saved`.
   - Patrimonio.
3. **US2 (P1)**: `Switch` en Preferencias (esquema y formulario), con el guardado optimista.
4. **US3 (P2)**: `SavedCard` en el Dashboard, i18n y seed del demo.
5. **Cierre**:
   - e2e demo y live.
   - Puertas: `typecheck`, `lint`, `format:check`, `test`, `build`, contrato local y pgTAP.
   - **Aplicar `0013` a la nube con confirmación y luego hacer push.**
   - README.

## Complexity Tracking

Sin violaciones que justificar.
