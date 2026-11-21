# Implementation Plan: Ingreso eventual a un solo bucket

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-income-to-bucket/spec.md`

## Summary

Un ingreso eventual puede sumarse entero a Necesidades, Gustos o Inversión de la quincena que financia, en vez de repartirse por reglas o quedar sin repartir. Sube el disponible de ese bucket (Inversión no entra al Safe-to-Spend).

**Enfoque**:
- **Datos**: ninguno. `distributed = true` + `rule_id = null` + una fila en `income_allocations` ya es válido y ya está probado en `tests/contract/data-provider.contract.ts`. La tabla exige `account_id` solo con `bucket = 'investment'`.
- **Dominio**: helper puro `singleBucketAllocation` en `splitter.ts`. `safe-to-spend.ts` y `net-worth.ts` no se tocan.
- **UI**: `RegisterIncomeDialog` pasa de 2 a 3 modos; el modo se deriva al editar (repartido y sin regla = un solo bucket).
- **Demo**: un ingreso eventual de ejemplo a Gustos.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`).

**Primary Dependencies**: Next.js 16.4, React 19.3, next-intl 4, TanStack Query 5, react-hook-form + zod, shadcn/ui. **Sin dependencias nuevas.** No toca APIs de Next.

**Storage**: sin cambios. **Sin migración**, así que no aplica la regla de migrar la nube antes del push.

**Testing**:
- Vitest: helper del dominio y esquema (pruebas que fallan primero), paridad i18n, consistencia del seed del demo.
- Contrato: ya cubre el caso sin regla; añadir uno con Inversión y vehículo si falta.
- Playwright: ampliar `us1-income-split.spec.ts` (demo y `@live`, EN y ES).

**Target Platform**: web en Vercel (personal y demo).

**Constraints**:
- Costo cero y cálculo en el cliente.
- Demo con escritura bloqueada; textos en EN/ES.
- Los ingresos existentes no cambian de comportamiento.

**Scale/Scope**: 1 usuario real. Sin archivos nuevos de código; unos 8 tocados.

## Constitution Check

| Principio | Cumplimiento |
| --------- | ------------ |
| I. Zero-cost | Sin servicios ni tablas nuevas. ✅ |
| II. TS estricto y stack | Helper puro con `Cents` enteros; formulario con react-hook-form + zod; componentes shadcn. ✅ |
| III. Supabase con RLS | Sin cambios de esquema ni de RPC. ✅ |
| IV. Demo aislado | El guardado pasa por el proveedor; el mock bloquea la escritura. ✅ |
| V. Privacidad / cliente | Montos con `<Money>`; todo se deriva en el cliente. ✅ |
| VI. i18n y multi-divisa | Llaves EN/ES con paridad. ✅ |

**Re-check post-diseño**: sin violaciones.

## Decisiones

- **D1 — Modo derivado, sin columna**: `distributed && ruleId == null` = un solo bucket. Alternativa descartada: columna `allocation_mode`, que exigiría migración sin aportar nada que no se derive.
- **D2 — Condición de la pregunta**: la frecuencia Eventual, que es donde hoy aparece `showSplitChoice`. Si el dueño prefiere el tipo de ingreso, cambia esa sola condición.
- **D3 — Schema**: el booleano `split` pasa a `allocation: "rules" | "bucket" | "none"`, con `bucket` y `vehicleId`. Un `superRefine` exige vehículo cuando `bucket = investment`. La salida mantiene `distributed`.
- **D4 — Bucket por defecto**: Gustos.
- **D5 — Vehículos**: cuentas de inversión activas (reusar el helper de `account-kind.ts` si encaja). Al editar se conserva visible el vehículo del ingreso aunque esté archivado.
- **D6 — Reintento**: el borrador de `notifySaveFailed` es un `Partial<IncomeFormInput>`; al cambiar la forma del formulario, el borrador de un guardado fallido ya trae los campos nuevos (FR-014). Verificarlo en la prueba.

## Project Structure

### Documentation (this feature)

```text
specs/015-income-to-bucket/
├── spec.md · plan.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/splitter.ts                           # + singleBucketAllocation()

src/features/income/
├── schemas.ts                  # allocation, bucket, vehicleId; superRefine
└── RegisterIncomeDialog.tsx    # 3 modos, selector de bucket y vehículo, vista previa,
                                # modo derivado al editar (recibe las allocations del ingreso)

src/data/mock/seed.ts                            # ingreso eventual de ejemplo a Gustos
src/i18n/messages/{en,es}.json                   # modos, bucket, vehículo, avisos

tests/
├── unit/domain/splitter.test.ts                 # helper: Σ = monto, investment lleva vehículo
├── unit/features/income-schema.test.ts          # modos, investment sin vehículo falla
└── e2e/us1-income-split.spec.ts                 # regalo a Gustos / a Inversión / editar
```

`IncomePage.tsx`, CSV, repos, mappers y migraciones no cambian.

**Structure Decision**: un solo proyecto Next.js con las capas que ya existen.

## Fases de implementación (para `/speckit-tasks`)

1. **Dominio**: pruebas que fallan primero → `singleBucketAllocation` (monto completo, `periodStart` de la quincena, vehículo solo con investment).
2. **Esquema**: `allocation` / `bucket` / `vehicleId` + pruebas; mantener la salida (`distributed`, `ruleId`).
3. **Dialog**:
   - Tres modos y selector de bucket.
   - Selector de vehículo con Inversión, estado deshabilitado sin cuentas y nota de que no sube el gasto.
   - Vista previa de una línea.
   - Guardar sin regla.
   - Modo derivado al editar: corregir `ruleFor`, que hoy re-repartiría por la regla vigente.
4. **i18n y demo**: llaves EN/ES con paridad; ingreso de ejemplo en el seed (`mock-seed-consistency` valida la suma).
5. **Cierre**:
   - e2e en demo y `@live`, EN y ES: regalo a Gustos sube Gustos; a Inversión no cambia el STS y sube el patrimonio; editar conserva bucket y vehículo.
   - Puertas: `typecheck`, `lint`, `format:check`, `test`, `build`, `test:contract:local`.
   - Check manual en la nube con un ingreso real pequeño.

## Complexity Tracking

Sin violaciones que justificar.
