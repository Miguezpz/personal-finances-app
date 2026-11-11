# Implementation Plan: Pulido visual de la navegación y del menú móvil

**Branch**: `main` (sin rama) | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

Pulido solo visual del shell de spec 008: panel "Más" en cuadrícula, ＋ dentro de la barra, token de "activo" en tinte para neón, riel de iconos en tablet, aviso demo corto, título de sección en el header móvil y "Cerrar sesión" al sidebar. Sin datos, sin dependencias. Se reparte en tres frentes con archivos exclusivos (ver Estructura) para que A y B corran en paralelo.

## Technical Context

**Language/Version**: TypeScript estricto, Next.js App Router, React

**Primary Dependencies**: Tailwind CSS, shadcn/ui, Lucide, next-intl (todas existentes; ninguna nueva)

**Storage**: N/A

**Testing**: Vitest (`pnpm test`, incl. `theme-contrast` y paridad i18n), Playwright e2e solo modo demo (`E2E_MODES=demo`)

**Target Platform**: Web, 320–1440 px, temas neón/claro/oscuro

**Project Type**: web-app (un solo paquete)

**Performance Goals**: First Load de `/dashboard` sin crecer (SC-007)

**Constraints**: movimiento solo opacidad/transform ≤ 300 ms; sin Docker/Supabase local; sin migraciones

**Scale/Scope**: ~12 archivos de UI + 2 de tests

## Constitution Check

| Principio | Estado |
|---|---|
| I Zero-Cost | OK: sin servicios ni dependencias |
| II Next/TS estricto, Tailwind/shadcn | OK. Framer Motion: no se añade movimiento nuevo con JS; el título del header usa CSS (spec 003 limita Framer al indicador) |
| III Supabase/RLS | N/A: sin cambios de esquema |
| IV Demo aislado | OK: todo funciona en demo; e2e en demo |
| V Privacidad | OK: no se tocan montos |
| VI i18n | OK: `demo.bannerShort` en ES y EN; claves muertas borradas; paridad |
| Accesibilidad/contraste | `theme-contrast` cubre el par `nav-active`; axe en e2e |

Sin violaciones. Re-evaluado tras el diseño: igual.

## Project Structure

### Documentation

```text
specs/012-navigation-polish/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ui-contract.md
└── tasks.md   # /speckit-tasks
```

### Source Code (por frente, sin archivos compartidos)

```text
A · Shell
  src/components/layout/AppShell.tsx    # MoreGrid, riel md:w-16 lg:w-60, header-title span, footerExtra, pb main
  src/components/layout/nav-items.ts    # exporta TILE_CLASS
  src/components/layout/CreateSheet.tsx # usa TILE_CLASS

B · Color, barra y aviso
  src/styles/tokens.css                 # --brand-acid-deep; .neon nav-active
  src/app/globals.css                   # .neon shimmer/balance → --primary; .header-title
  src/components/layout/MobileNav.tsx   # ＋ size-12 dentro de la barra
  src/components/layout/{CurrencyToggle,LanguageToggle,DemoBanner}.tsx
  src/features/goals/GoalsPage.tsx · src/features/settings/accounts/AccountsSettings.tsx
  src/i18n/messages/{en,es}.json

C · Tests
  tests/e2e/mobile.spec.ts · tests/e2e/navigation.spec.ts
```

**Structure Decision**: un solo paquete existente; el contrato entre frentes está en `contracts/ui-contract.md`.

## Complexity Tracking

Sin desviaciones. Un atajo documentado: el título del header depende de `animation-timeline` (`shortcut:` en el CSS); sin soporte queda oculto.
