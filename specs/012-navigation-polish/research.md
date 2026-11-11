# Research — Spec 012

Todas las decisiones de diseño las fijó el dueño (2026-11-11); aquí solo las técnicas.

- **Cuadrícula "Más"**: mosaicos con la clase compartida `TILE_CLASS` (extraída de `CreateSheet`). Alternativa: lista compacta — descartada por el dueño. Grupos como `<section class="contents">` + `<h2 class="sr-only">` + `<ul class="contents">`; si VoiceOver pierde la semántica de lista con `display: contents`, caer a lista plana sin encabezados.
- **＋ en la barra**: `size-12`, sin `-mt-5`/anillo/halo; conserva `relative z-10` para que el indicador pase detrás. `main` baja de `5rem` a `4.5rem`.
- **Tinte de activo en neón**: `--nav-active: var(--brand-acid-deep)` (#2d320c), `--nav-active-foreground: var(--brand-acid)`; contraste ≈ 9.5:1 (lo valida `theme-contrast`). Las dos reglas `.neon` que mezclan `--nav-active` pasan a `--primary` para no cambiar su aspecto.
- **Riel tablet**: `aside md:w-16 lg:w-60`; texto en `md:max-lg:sr-only`; `title` nativo como tooltip. `NavIndicator` ya mide con `ResizeObserver`.
- **Título del header**: CSS puro, `animation-timeline: scroll(root)` dentro de `@supports` y `prefers-reduced-motion: no-preference`; sin JS. Sin soporte → oculto (no rompe el test "no animation is left running").
- **Aviso demo**: dos spans por breakpoint; el largo sigue en el DOM para `us9-demo`.
- **Cerrar sesión**: `NavGroups` recibe `footerExtra` y lo pinta bajo Configuración.
