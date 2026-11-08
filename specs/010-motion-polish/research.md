# Research: Animaciones y pulido

## R1 · Transición de ruta con `<ViewTransition>`
- **Decision**: en `template.tsx` (se remonta en cada ruta, igual que un `page.tsx`), `<ViewTransition enter="page-in" exit="page-out" default="none">`. CSS: `::view-transition-old(.page-out)` 120 ms de desvanecimiento; `::view-transition-new(.page-in)` 180 ms de desvanecimiento con un retraso de 60 ms y `translate: 0 4px → 0` (total ≤ 300 ms). `::view-transition-old(root), ::view-transition-new(root) { animation: none }` deja el shell quieto; `::view-transition { pointer-events: none }` mantiene la página interactiva. Con movimiento reducido, duración 0.
- **Rationale**: es la guía oficial de Next (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`): las navegaciones ya son transiciones, sin configuración y sin bundle extra.
- **Alternatives**: la animación CSS de entrada actual (no tiene salida); framer-motion (prohibido por el spec 003).

## R2 · Revelado del contenido al cargar
- **Decision**: `ViewTransition` no se activa con la actualización síncrona de TanStack Query (no es una transición). `useRevealOnLoad(ref)` observa `main` con un `MutationObserver` (`childList`, `subtree`). En cada lote donde se elimina un nodo con `[aria-busy="true"]`, anima con `el.animate([{opacity:0, transform:'translateY(4px)'}, {opacity:1, transform:'none'}], {duration:200, easing: var(--ease-out-quint)})` los elementos agregados en ese mismo lote. Si `prefers-reduced-motion` está activo, no hace nada.
- **Rationale**: es genérico (cubre las 9 páginas sin tocarlas) y no tiene costo cuando no hay esqueleto. Solo anima opacidad y transform; `<Money>` ya está renderizado (y enmascarado si aplica) en el primer cuadro.

## R3 · Filas que entran y salen
- **Entrada**: `useNewRowIds(ids)` recuerda los ids de la primera carga y devuelve un `Set` con los que aparecen después; esas filas llevan `animate-row-in` (200 ms, opacidad + 4 px). Una fila restaurada con Deshacer cuenta como nueva.
- **Salida**: `pending-deletes` gana `leaving: ReadonlySet<string>`. `useDeferredDelete` marca `leaving` y, tras 180 ms (o de inmediato con movimiento reducido), agrega la entrada que oculta la fila. Las filas cuyo `kind:id` está en `leaving` llevan `animate-row-out` (`forwards`, opacidad → 0 y −4 px).
- **Rationale**: los stores con `useSyncExternalStore` no admiten transiciones (no hay `ViewTransition`). Retrasar el ocultamiento 180 ms es imperceptible para el deshacer de 6 s.

## R4 · Pulso al guardar
- **Decision**: `useUi` gana `flashed: { id: string; at: number } | null` y `flash(id)`. AddExpenseDialog y RegisterIncomeDialog lo llaman en el éxito de una edición. Las filas con ese id renderizan una capa con `key={at}` y `animate-balance-highlight`, para reiniciar la animación.

## R5 · Montos y metas
- **Decision**: extraer de BucketCard `useFlashOnChange(value)` → `{ key, className }` (no destella en el primer render). Usarlo en las tarjetas de metas (saldo ahorrado) y en las de Patrimonio. `ProgressBar` de GoalsPage: `origin-left` + `scaleX(mounted ? p : 0)` con `transition-transform duration-slow`, igual que BucketCard.

## R6 · Arrastre para cerrar
- **Decision**: `useDragToDismiss({ onDismiss, contentRef })` devuelve los handlers de puntero para el asa: `pointerdown` (captura) → `pointermove` (translateY = max(0, dy) con `transition: none`) → `pointerup`: si dy > 80 px o la velocidad ≥ 0.5 px/ms → `onDismiss()`; si no, vuelve a 0 con `transition: transform var(--duration-base)`. El asa tiene `touch-action: none`, un área de 44 px de alto, `aria-hidden` (Escape y el botón × siguen siendo la vía accesible). `onDismiss` hace clic en un `Close` oculto de Radix.

## R7 · Errores y a11y
- **Errores**: `@keyframes field-error-in { from { opacity: 0; transform: translateY(-2px) } }` 150 ms en `[data-slot=field-error]`; sin altura (spec 003).
- **Menús**: `DropdownMenuItem`: `pointer-coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring`.
- **Radio**: `pointer-coarse:after:-inset-[14px]` (16 + 28 = 44 px). **Switch**: `pointer-coarse:after:-inset-y-[13px]` (18 + 26 ≈ 44 px).
