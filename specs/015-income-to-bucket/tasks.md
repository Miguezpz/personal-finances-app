# Tasks: Ingreso eventual a un solo bucket

**Input**: `specs/015-income-to-bucket/` (spec, plan)

**Formato**: `- [ ] T### [P] [USn] descripción con ruta`.
- Las pruebas de dominio y de esquema se escriben primero y deben fallar.
- **No hay migración**: no aplica la regla de migrar la nube antes del push.
- Sin Docker: las pruebas de dominio, esquema y UI no necesitan Supabase local. El contrato `@live` sí; solo corre el caso nuevo si ya hay Supabase local arriba.

## Phase 1: Fundacional (bloquea todo)

- [X] T001 Antes de tocar nada, confirmar el supuesto de la spec (sin migración): en `tests/contract/data-provider.contract.ts` (cerca de la línea 420) ya existe un ingreso con `distributed: true, ruleId: null`. Revisar que registre una asignación de `needs` o `wants` y, si falta un caso con `investment` + vehículo, anotarlo para T018.
- [X] T002 Correr `pnpm typecheck && pnpm test` en limpio para fijar la línea base (todo verde antes de cambiar el formulario).

## Phase 2: US1 — Ingreso eventual a Gustos o Necesidades (P1) 🎯 MVP

**Independent test**: con el disponible de Gustos de la quincena actual en $1,000, registrar un regalo eventual de $500 sumado a Gustos; Gustos muestra $1,500 y Necesidades no cambia.

- [X] T003 [US1] En `tests/unit/domain/splitter.test.ts`, nuevo `describe("singleBucketAllocation")`, que falla primero:
  - `wants` con $500 y `periodStart` ⇒ una sola asignación `{ bucket: "wants", accountId: null, amount: 50_000, periodStart }` y `total` igual al monto.
  - `needs` igual.
  - `investment` con vehículo ⇒ `accountId` del vehículo.
  - `investment` sin vehículo ⇒ lanza `InvalidWeightsError` (o el error de dominio que ya se use para entradas inválidas).
  - `periodStart` que no es día 1 o 16 ⇒ lanza `InvalidDateError`.
  - `wants` con vehículo ⇒ lo ignora (`accountId: null`; la tabla prohíbe vehículo fuera de Inversión).
- [X] T004 [US1] En `src/domain/splitter.ts`, `singleBucketAllocation(amount, bucket, vehicleId, fundedPeriodStart): SplitResult`; reusa `SplitResult` y `NewAllocation`. T003 debe pasar. Actualizar el comentario de cabecera del archivo.
- [X] T005 [US1] En `tests/unit/features/income-schema.test.ts`, casos nuevos que fallan primero:
  - `allocation: "bucket"` con `bucket: "wants"` ⇒ salida con `distributed: true`.
  - `allocation: "rules"` ⇒ `distributed: true`; `allocation: "none"` ⇒ `distributed: false`.
  - `allocation: "bucket"` con `bucket: "investment"` y sin `vehicleId` ⇒ error `vehicleRequired`.
  - Mantener los casos existentes (adaptar el literal de entrada de `split` a `allocation`).
- [X] T006 [US1] En `src/features/income/schemas.ts`: reemplazar `split: z.boolean()` por `allocation: z.enum(["rules", "bucket", "none"])`; agregar `bucket: z.enum(["needs", "wants", "investment"])` y `vehicleId: z.string()`; `superRefine` con `vehicleRequired` cuando `allocation = "bucket"` y `bucket = "investment"` sin vehículo. La salida conserva `distributed` y suma `allocation`, `bucket` y `vehicleId` para el diálogo. Actualizar el comentario de cabecera. T005 debe pasar.
- [X] T007 [US1] En `src/features/income/RegisterIncomeDialog.tsx` (modo registrar):
  - `defaultsFor`: `allocation: "rules"`, `bucket: "wants"`, `vehicleId: ""`.
  - La pregunta `showSplitChoice` pasa de 2 a 3 opciones (reglas / un solo bucket / sin repartir). Pasar a Fijo vuelve a `allocation = "rules"`.
  - Con "un solo bucket": `RadioGroup` de bucket (Necesidades / Gustos / Inversión, textos de `buckets`).
  - Vista previa de una línea con `singleBucketAllocation`, la misma función que se guarda.
  - `onSubmit`: en este modo guarda `distributed: true`, `ruleId: null` y la asignación de `singleBucketAllocation`; **no exige regla** (FR-006).
  - El botón Guardar y la alerta "sin regla" solo aplican al modo `rules`.
- [X] T008 [P] [US1] i18n `src/i18n/messages/en.json` y `es.json` (en serie, mismo bloque `income`): `splitToBucket`, `bucketLabel`, `previewBucket`, `vehicleRequired`. Revisar que pase el test de paridad.
- [ ] T009 [US1] E2E en `tests/e2e/us1-income-split.spec.ts` (demo y `@live`, EN y ES): registrar un regalo eventual de $500 a Gustos y comprobar que el disponible de Gustos sube $500 y el de Necesidades no cambia. En el demo, comprobar el aviso de solo lectura al guardar.

## Phase 3: US3 — Editar un ingreso mandado a un bucket (P2)

Va antes de US2 porque corrige un riesgo real: hoy `ruleFor` volvería a repartir por la regla vigente un ingreso sin regla.

**Independent test**: registrar $500 a Gustos, abrir Editar, ver el bucket preseleccionado, cambiarlo a Necesidades y guardar.

- [X] T010 [US3] En `src/features/income/IncomePage.tsx` y `LazyRegisterIncomeDialog.tsx`, pasar al diálogo las asignaciones del ingreso (`data.allocations.filter((a) => a.incomeId === income.id)`); nueva prop `allocations?: readonly IncomeAllocation[]`.
- [X] T011 [US3] En `RegisterIncomeDialog.tsx` (modo editar):
  - `defaultsFor` deriva el modo: `!distributed` ⇒ `none`; `distributed && ruleId == null` ⇒ `bucket` con el bucket y el vehículo de su única asignación; si no, `rules`.
  - `ruleFor` y la vista previa no deben repartir por regla un ingreso en modo `bucket`.
  - Cambiar de Eventual a Fijo al editar vuelve a `rules`.
- [ ] T012 [US3] E2E `@live` en `us1-income-split.spec.ts`: editar el regalo de Gustos a Necesidades y comprobar que el disponible de Gustos baja y el de Necesidades sube por el monto; reabrir Editar conserva el bucket. Editar un ingreso repartido por reglas sigue recalculándose con su regla original (FR-009).

## Phase 4: US2 — Ingreso eventual a Inversión (P2)

**Independent test**: registrar $1,000 a Inversión con un vehículo; el patrimonio sube $1,000 y el Safe-to-Spend no cambia.

- [X] T013 [US2] En `RegisterIncomeDialog.tsx`, con bucket Inversión:
  - `NativeSelect` de vehículo con las cuentas `kind === "investment"` no archivadas (`data-testid="income-vehicle"`); al editar, conservar visible el vehículo del ingreso aunque esté archivado.
  - Nota "Inversión no aumenta el gasto disponible".
  - Sin cuentas de inversión: la opción Inversión queda deshabilitada con un aviso.
  - Al cambiar de Inversión a otro bucket, limpiar `vehicleId`.
- [X] T014 [P] [US2] i18n EN/ES: `vehicle`, `investmentNote`, `noVehicles`. Paridad.
- [ ] T015 [US2] E2E `@live`: $1,000 a Inversión con vehículo ⇒ el STS de Necesidades y Gustos no cambia y el patrimonio sube $1,000.

## Phase 5: US4 — Demo, reintento y contrato (P3)

- [X] T016 En `src/data/mock/seed.ts`, un ingreso eventual de ejemplo mandado a Gustos (`distributed: true`, `ruleId: null`, una asignación de `wants` en su quincena), junto al "Freelance project" sin repartir. Correr `tests/unit/data/mock-seed-consistency.test.ts` (valida Σ = monto). Revisar los e2e del demo que fijen cifras de Gustos o de la lista de ingresos y ajustar lo que cambie.
- [X] T017 FR-014: verificar que "Reintentar" tras un guardado fallido conserva modo, bucket y vehículo: el borrador de `notifySaveFailed` es `Partial<IncomeFormInput>`. Si `src/features/shared/retry-toast.ts` o `DialogHost.tsx` fijan la forma del borrador, adaptarlos. Una prueba de unidad o un caso en el e2e.
- [X] T018 [P] Contrato `tests/contract/data-provider.contract.ts`: caso con `investment` + vehículo, `distributed: true`, `ruleId: null`, si T001 vio que falta. Correr `pnpm test:contract:local` solo con Supabase local arriba; si no, dejar la nota.

## Phase 6: Cierre

- [ ] T019 Correr las puertas: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`. Todas las pruebas existentes de ingresos, splitter y Safe-to-Spend pasan sin cambios (SC-005).
- [ ] T020 E2E completo de la feature en demo y `@live`, EN y ES (`us1-income-split.spec.ts`).
- [ ] T021 Commit y push a `main` (sin migración, se puede subir directo). Revisar el CI.
- [ ] T022 Verificación manual en la app personal: registrar un ingreso eventual pequeño a Gustos, ver subir Gustos, editarlo a Necesidades, y eliminarlo.

## Dependencies

- T001 → T002 → todo.
- US1: T003 → T004; T005 → T006; T004 y T006 → T007 → T008 → T009.
- US3 depende de US1 (T007): T010 → T011 → T012.
- US2 depende de T007 y T011: T013 → T014 → T015.
- Fase 5 depende de US1; T016 puede ir en paralelo con US3 y US2.
- El cierre va al final.

## Parallel examples

- T003 ∥ T005 (dominio y esquema, archivos distintos).
- T016 ∥ T010 (seed y diálogo/lista).
- Los JSON de i18n se editan en serie aunque T008 y T014 estén marcadas [P] respecto al código.

## Implementation strategy

- **MVP**: Fases 1 y 2 (ingreso eventual a Gustos o Necesidades, sin editar).
- **No publicar el MVP solo**: sin US3 (T011), editar un ingreso mandado a un bucket lo volvería a repartir por reglas. US1 y US3 se suben juntos.
- Después: Inversión (US2), demo y reintento, cierre y verificación manual.

## Notas de implementación

- T001: el caso de `data-provider.contract.ts` cerca de la 420 era de **rechazo** (suma incorrecta), no un caso válido. T018 añadió el caso positivo (Gustos e Inversión con vehículo); corre solo con Supabase local (`canWrite`), así que todavía no se ha ejecutado.
- T009, T012: las e2e quedaron en un archivo nuevo, `tests/e2e/us19-income-to-bucket.spec.ts` (demo y `@live`), no en `us1-income-split.spec.ts`. Ids nuevos: `#income-split-bucket`, `#income-bucket-{needs,wants,investment}`, `income-vehicle`; `#income-split-yes` y `#income-split-no` se conservan (los usa `us11`).
- T010: en vez de pasar una prop, el diálogo lee las asignaciones del snapshot (`selectFormData.allocations`) para derivar bucket y vehículo al editar.
- T015: sin e2e `@live` de Inversión; el caso demo cubre el selector de vehículo y la nota, y el contrato (T018) cubre la escritura.
- T017: el borrador de "Reintentar" es `form.getValues()`, así que ya trae `allocation`, `bucket` y `vehicleId`; no hubo que cambiar `retry-toast.ts` ni `DialogHost.tsx`.
- T019/T020: `typecheck`, `lint`, `format:check` y `test` (820) pasan. `build` y las e2e **no corren**: Next.js 16.4 corta `next dev` y `next build` con `SecurityFatalError` (aviso de seguridad de la propia versión, previo a esta spec). Hay que actualizar Next antes de poder correrlas.
