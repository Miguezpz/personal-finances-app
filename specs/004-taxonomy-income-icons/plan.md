# Implementation Plan: Taxonomía completa, tipos de ingreso e íconos

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-taxonomy-income-icons/spec.md`

## Summary

La taxonomía del dueño (26 categorías: sus 25 de la nube más Previous Balances) pasa a ser el default de la app, del demo y de las cuentas nuevas; cada ingreso gana un tipo obligatorio de una lista fija de 9; categorías y subcategorías ganan un ícono opcional (la subcategoría hereda el de su categoría), y la app suma íconos decorativos, un estado vacío y un encabezado de página compartidos.

Enfoque: una migración `0008` (enum `income_type`, columna `icon`, RPCs de ingreso y una función interna de backfill probada con pgTAP), cambios en el dominio y en los dos proveedores de datos cubiertos por la suite de contrato, mapas estáticos de íconos Lucide con imports nombrados, y UI en el editor de taxonomía, el formulario de ingreso y las superficies de FR-014. Detalle de decisiones en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase)

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query, Zustand, zod 4, shadcn/ui, Tailwind, Framer Motion, lucide-react 1.66, @supabase/supabase-js 2. **Sin dependencias nuevas.**

**Storage**: Supabase Postgres (nube free plan en producción; local con Docker para pruebas). Migración nueva `supabase/migrations/0008_taxonomy_income_icons.sql`.

**Testing**: Vitest (unitarias y contrato mock/Supabase), pgTAP (`supabase/tests/`), Playwright (e2e normal/demo, EN/ES, a11y con axe).

**Target Platform**: Web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: primera carga de `/` y `/dashboard` crece < 5 KB gzip (SC-005), medido con `scripts/measure-first-load.mjs`.

**Constraints**: costo cero; demo sin backend; RLS en toda tabla; todo texto visible en diccionarios; migraciones a la nube solo con aprobación y una por vez.

**Scale/Scope**: 1 usuario real; 26 categorías y 68 subcategorías por defecto; ~40 íconos de categoría y ~35 decorativos; ~20 archivos de UI tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Sin servicios ni dependencias nuevas; solo texto (claves de ícono), nada de imágenes ni archivos. El CSV gana columnas. ✅ |
| II. TS estricto y stack | Tipos `IncomeType` y `CategoryIconKey` derivados de tuplas `as const`; el mapa de íconos usa `satisfies` para que falte un ícono sea error de compilación. Solo Lucide, shadcn y Tailwind. ✅ |
| III. Supabase con RLS | Columnas nuevas en tablas que ya tienen RLS; RPCs siguen `security invoker`; la función de backfill vive en un esquema `private` no expuesto y sin `execute` para `anon`/`authenticated`. Migración versionada. ✅ |
| IV. Demo aislado | El mock implementa los mismos campos; seed ficticio; escrituras bloqueadas con el aviso de solo lectura; `check:demo-bundle` en las puertas. ✅ |
| V. Privacidad | Los íconos no muestran montos; el modo privacidad no cambia. Sin llamadas externas. ✅ |
| VI. i18n y multi-divisa | Categorías y tipos de ingreso en EN/ES con paridad probada. Las subcategorías por defecto se muestran con su nombre guardado (Clarificación C): son datos, como los nombres que escribe el dueño, no texto de interfaz hardcodeado. ✅ (ver Complexity Tracking) |
| Flujo | Spec → plan → tareas; type-check, lint y pruebas; verificación en normal y demo, EN y ES. ✅ |

**Re-check post-diseño**: sin cambios; ninguna violación.

## Project Structure

### Documentation (this feature)

```text
specs/004-taxonomy-income-icons/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── data-provider.md
│   └── ui-components.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/0008_taxonomy_income_icons.sql      # nuevo
└── tests/taxonomy-income-icons.test.sql           # nuevo (pgTAP)

src/domain/
├── types.ts                 # Category.icon, Subcategory.icon, Income.incomeType
├── income-types.ts          # nuevo: INCOME_TYPES
├── icons.ts                 # nuevo: CATEGORY_ICON_KEYS, isCategoryIconKey, resolveTaxonomyIcon
├── default-taxonomy.ts      # 26 categorías (research R1), subcategorías sin nameKey
└── csv.ts                   # income_type, icon

src/data/
├── provider.ts                              # icon en taxonomía, incomeType en ingresos
├── supabase/{mappers.ts,database.types.ts}  # regenerar tipos con pnpm db:types
├── supabase/repos/{taxonomy.ts,incomes.ts}
└── mock/{provider.ts,seed.ts,fixtures/catalog.ts}

src/components/
├── icons/{category-icons.ts,income-type-icons.ts,domain-icons.ts,CategoryIcon.tsx}  # nuevos
├── ui/empty-state.tsx                       # nuevo
└── layout/{PageHeader.tsx,nav-items.ts,PreferencesSheet.tsx}

src/features/
├── settings/onboarding.ts                   # dedup de subcategorías por nombre
├── settings/taxonomy/{TaxonomyEditor.tsx,IconPicker.tsx,schema.ts,hooks.ts}
├── income/{RegisterIncomeDialog.tsx,IncomeTypeField.tsx,IncomePage.tsx,schemas.ts,hooks.ts}
└── … superficies de FR-014: accounts, buckets (dashboard), ledger, receivables, goals,
      expenses, recurring, net-worth, credit

src/i18n/messages/{en,es}.json

tests/
├── unit/{domain,features,data,i18n}/…
├── contract/{data-provider.contract.ts,schemas.ts}
└── e2e/…                                    # tipo de ingreso, selector de ícono, demo, a11y
```

**Structure Decision**: proyecto único existente; los íconos se agrupan en `src/components/icons/` y la lógica pura (claves válidas, resolución por herencia, tipos de ingreso) en `src/domain/`, siguiendo la separación actual entre dominio, datos y UI.

## Orden de implementación

1. **Base (bloquea todo)**: migración `0008` + pgTAP en local → `pnpm db:types` → dominio (`types`, `income-types`, `icons`) → `provider.ts`, repos Supabase, mappers y mock → suite de contrato en verde.
2. **US1 Taxonomía (P1)**: `DEFAULT_TAXONOMY`, i18n de categorías, onboarding por nombre, catálogo y seed del demo, `private.apply_taxonomy_004`.
3. **US2 Tipo de ingreso (P1)**: `IncomeTypeField`, schema, sugerencia de etiqueta, lista de ingresos, CSV.
4. **US3 Íconos de categoría (P2)**: mapa, `CategoryIcon`, `IconPicker` en el editor, visualización en gastos, ledger, recurrentes e ingresos.
5. **US4 Íconos de apoyo (P3)**: mapas decorativos, `EmptyState`, `PageHeader`.
6. **Cierre**: puertas de calidad, peso de primera carga, demo, y aplicar `0008` en la nube **solo con aprobación** (quickstart § 4).

US2 no depende de US1; US3 depende de la base y de los íconos asignados en US1; US4 solo de la base.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Frontend antiguo en producción entre aplicar `0008` y desplegar | RPCs con `coalesce(..., 'other')`; columnas nuevas nulables o con default. Orden: migración → despliegue inmediato. |
| El backfill no empareja una categoría por diferencias de nombre | Nombres copiados exactos de la nube (research R1); la verificación SQL del quickstart exige `sin_clave = 0`. |
| El set de íconos engorda la primera carga | Imports nombrados, mapas solo en páginas que los usan; medición antes/después (SC-005). |
| Cambiar los ids del mock rompe pruebas que los fijan | `subcategoryId(categoryKey, name)` y ajuste de `mock-seed-consistency.test.ts`. |

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada |
|---|---|---|
| Esquema `private` con `apply_taxonomy_004` | Permite probar el backfill con pgTAP e invocarlo de forma idempotente | `update` sueltos en la migración: no se pueden probar sobre una base sin usuarios |
| Subcategorías por defecto sin traducir (Clarificación C) | Decisión del dueño; evita 68 traducciones | Traducirlas: rechazado por el dueño en clarify |
