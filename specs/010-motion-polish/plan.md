# Implementation Plan: Animaciones y pulido

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-motion-polish/spec.md`

## Summary

Motion dentro de las reglas del spec 003, sin dependencias nuevas:
- **Ruta**: `<ViewTransition enter="page-in" exit="page-out" default="none">` (React 19.3) en `src/app/(app)/template.tsx`, en lugar de `animate-content-in`. El root snapshot no se anima (el shell queda quieto) y el overlay deja pasar los clics.
- **Revelado**: `useRevealOnLoad()` en el template. Un `MutationObserver` sobre `main` detecta el cambio en que desaparece un `[aria-busy="true"]` y anima con WAAPI (`element.animate`: opacidad y 4 px, 200 ms) los elementos insertados en ese mismo cambio. Se omite con movimiento reducido.
- **Filas**: utilidad `animate-row-in` (CSS) aplicada solo a filas montadas después de la primera carga (hook `useNewRowIds`). La salida de fila es una fase `leaving` en `pending-deletes` que pinta `animate-row-out` durante 180 ms antes de ocultar; con movimiento reducido se oculta al instante.
- **Pulso al guardar**: `useUi.flash(id)` tras editar con éxito un gasto o un ingreso; la fila con ese id usa `animate-balance-highlight`.
- **Montos**: hook `useFlashOnChange(value)` extraído de `BucketCard` y usado en las tarjetas de metas y Patrimonio. `GoalsPage` `ProgressBar` crece con `scaleX` como `BucketCard`.
- **Hojas**: `SheetHandle` + `useDragToDismiss` (pointer events nativos) en `ui/sheet.tsx` (`side="bottom"`) y `ui/dialog.tsx` (solo < sm); cierra con un `Close` oculto.
- **Errores**: `FieldError` con `animate-field-error-in` (opacidad + 2 px).
- **A11y**: `DropdownMenuItem` `pointer-coarse:min-h-11` y `focus-visible:ring`; radio y switch con área táctil ampliada (`pointer-coarse:after:*`).

Detalle en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`).
**Primary Dependencies**: Next.js 16.4 (navegaciones = transiciones), React 19.3 (`ViewTransition`), Tailwind 4 + tw-animate-css, Zustand 5. **Sin dependencias nuevas**; framer-motion sigue solo en `NavIndicator`.
**Storage**: N/A.
**Testing**: Vitest (hooks `useDragToDismiss` y `useNewRowIds`, store `pending-deletes`), Playwright demo (`motion.spec.ts`: movimiento reducido, revelado, asa y arrastre, barra de metas, errores; `a11y.spec.ts`).
**Target Platform**: navegadores modernos; sin soporte de View Transitions la app funciona sin animación de ruta.
**Performance Goals**: animaciones ≤ 300 ms; First Load ≤ +20 kB (T001).
**Constraints**: spec 003 FR-030/031/034/035 (sin animar montos, solo opacidad/transform/fondo, kill-switch de movimiento reducido en `globals.css`).
**Scale/Scope**: ~6 archivos nuevos, ~15 tocados.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Sin dependencias ni servicios. ✅ |
| II. TS estricto y stack | Hooks tipados; Framer Motion se mantiene donde ya estaba; CSS/Tailwind. ✅ |
| III. RLS | Sin cambios de backend. ✅ |
| IV. Demo aislado | Sin efectos sobre datos; el demo rechaza borrar antes de la salida de fila. ✅ |
| V. Privacidad | Revelados y destellos animan contenedores; `<Money>` ya enmascara desde el primer cuadro (prueba de privacidad de motion). ✅ |
| VI. i18n | Solo `aria-label` del asa en EN/ES. ✅ |

## Project Structure

```text
src/app/(app)/template.tsx              # ViewTransition + useRevealOnLoad
src/app/globals.css                     # page-in/out, row-in/out, field-error-in, ::view-transition(root), reduced motion
src/components/motion/
├── use-reveal-on-load.ts               # nuevo
├── use-flash-on-change.ts              # nuevo (extraído de BucketCard)
├── use-new-row-ids.ts                  # nuevo
└── use-drag-to-dismiss.ts              # nuevo
src/components/ui/{sheet,dialog,field,dropdown-menu,radio-group,switch}.tsx
src/store/{pending-deletes,ui}.ts       # fase leaving; flash(id)
src/features/shared/use-deferred-delete.ts
src/features/expenses/ExpensesPage.tsx, src/features/income/IncomePage.tsx, src/features/recurring/RecurringPage.tsx
src/features/expenses/AddExpenseDialog.tsx, src/features/income/RegisterIncomeDialog.tsx   # flash tras editar
src/features/goals/GoalsPage.tsx, src/features/net-worth/NetWorthPage.tsx, src/features/safe-to-spend/BucketCard.tsx
src/i18n/messages/{en,es}.json
tests/unit/motion/*.test.ts(x); tests/e2e/motion.spec.ts, a11y.spec.ts
```

## Orden de implementación

1. Base: CSS (keyframes y utilidades), hooks de motion y pruebas unitarias.
2. US1: ruta y revelado → US2: filas y pulso → US3: montos y metas → US4: hojas → US5: errores y a11y.
3. Pulido: e2e de motion y a11y, gate completo, resumen final en `docs/ux-roadmap.md`.

## Complexity Tracking

Sin violaciones.
