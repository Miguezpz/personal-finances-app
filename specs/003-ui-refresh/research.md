# Research: Renovación visual "Fresh & Growth"

Decisiones técnicas de la Phase 0. No quedan "NEEDS CLARIFICATION" en el Technical Context.

## R1. Arquitectura de tokens

- **Decision**: tres capas. (1) Primitivos de marca en HEX en `src/styles/tokens.css`; (2) semánticos de shadcn
  (`--background`, `--primary`, `--muted`, `--ring`, `--sidebar-*`, `--series-*`…) más `--cta`, `--cta-foreground`,
  `--success`, `--surface-highlight`, asignados con `var(--brand-*)` en `:root` y `.dark` del mismo archivo;
  (3) `@theme inline` en `globals.css` expone utilidades (`bg-cta`, `text-success`, `bg-surface-highlight`).
- **Rationale**: un solo lugar para los colores (FR-039); los componentes shadcn ya consumen los semánticos, así que
  la mayoría de pantallas cambia sin tocar su código. HEX (no OKLCH) para que el test de contraste los lea sin
  convertir espacios de color.
- **Alternatives considered**: `tailwind.config` con colores (Tailwind v4 prefiere CSS); OKLCH (exige convertir en el
  test); clases `emerald-*` de Tailwind (no coinciden con la paleta exacta y dispersan los colores).

## R2. Valores y contraste (calculados con la fórmula WCAG 2.1)

| Rol | Claro | Oscuro | Ratio clave |
|---|---|---|---|
| background / card | `#FFFFFF` / `#FFFFFF` | `#031F1D` / `#052E2B` | — |
| foreground | `#052E2B` | `#ECFDF5` | 14.66 / 16.37 |
| muted (superficie) | `#ECFDF5` | `#052E2B` | — |
| muted-foreground | `#4B635F` | `#8FB8AE` | 6.46 (blanco), 6.14 (mist) / 7.91 (deep), 6.73 (ink) |
| primary / primary-foreground | `#0F766E` / `#FFFFFF` | `#34D399` / `#031F1D` | 5.47 / 8.97 |
| primary hover | `#115E59` | mezcla 85 % emerald | ≥ 7 |
| cta / cta-foreground | `#34D399` / `#052E2B` | `#34D399` / `#031F1D` | 7.63 / 8.97 |
| ring (foco) | `#0F766E` | `#34D399` | 5.47 / 8.97 (≥ 3 no-texto) |
| surface-highlight | `#ECFDF5` (bloques) / `#A7F3D0` (nav activa) | `#052E2B` / `#0F766E` | — |
| success (texto) | `#0F766E` | `#34D399` | 5.20 sobre mist |
| destructive | `#B91C1C` | `#F87171` | 6.47 / 5.30 |

- `#34D399` sobre blanco es 1.92:1 → prohibido como texto o único indicador en claro (FR-004).
- `#0F766E` sobre `#A7F3D0` es 4.27:1 → en la nav activa el texto va en `#052E2B` (11.43:1).
- **Alternatives considered**: `#052E2B` como fondo de página oscuro (demasiado saturado en áreas grandes y sin
  jerarquía con las tarjetas) → se usa `#031F1D` derivado.

## R3. Test de contraste

- **Decision**: `tests/unit/theme-contrast.test.ts` lee `src/styles/tokens.css` con `fs`, extrae los bloques
  `:root` y `.dark`, resuelve un nivel de `var(--brand-*)` y comprueba una tabla de pares
  `[fg, bg, mínimo]` (texto 4.5, no-texto 3) por tema. La función de contraste vive en el propio test.
- **Rationale**: evita regresiones al retocar la paleta; no depende del navegador. axe sigue cubriendo los casos
  reales renderizados.
- **Alternatives considered**: solo axe (no detecta pares no presentes en la pantalla auditada).

## R4. Tema oscuro sin destello

- **Decision**: añadir `theme: "system" | "light" | "dark"` a `PersistedPreferences` (misma clave
  `pfa:prefs:v1`, `version: 1`; el `merge` valida y por defecto deja `"system"`, así que los datos guardados
  antiguos siguen siendo válidos). `PREFERENCES_BOOT_SCRIPT` lee `s.state.theme`, resuelve `system` con
  `matchMedia("(prefers-color-scheme: dark)")` y aplica `classList.toggle("dark")` + `style.colorScheme` antes del
  primer paint (el `BootSkeleton` ya sale en el tema correcto). `PreferencesEffects` aplica cambios y, en
  `system`, escucha `matchMedia(...).addEventListener("change")`. `sonner.tsx` toma el tema resuelto del store.
- **Rationale**: es el mismo mecanismo que ya evita el destello de idioma y de montos; una sola fuente de
  preferencias; `next-themes` solo se usaba en `sonner.tsx` y sin provider (siempre "system").
- **Alternatives considered**: `next-themes` con `ThemeProvider` (segunda persistencia, segundo script inline,
  duplicaría el patrón existente).

## R5. `theme-color` del navegador

- **Decision**: `viewport.themeColor` estático con dos entradas `media` (`#FFFFFF` claro, `#031F1D` oscuro) y
  `colorScheme: "light dark"`; cuando el usuario fija un tema manual, `applyTheme` reescribe el `content` de ambos
  `<meta name="theme-color">` con el color del tema elegido.
- **Rationale**: Next genera las metas con `media` (sigue al SO); el override manual necesita JS (FR-011).

## R6. Íconos y manifiesto

- **Decision**:
  - `src/app/icon.svg`: monograma (cuadrado redondeado tinta + 3 barras ascendentes esmeralda), con
    `<style>@media (prefers-color-scheme: dark){…}</style>` interno que aclara el borde del cuadrado para
    pestañas oscuras. Next lo enlaza con `sizes="any"`.
  - `src/app/apple-icon.tsx`: `ImageResponse` de `next/og`, 180×180, fondo tinta sólido (iOS no admite
    transparencia). Estático en build (no usa APIs de request).
  - `src/app/favicon.ico`: regenerado una vez con `scripts/generate-favicon.mjs` (renderiza el SVG a PNG 16/32/48
    con `ImageResponse` y los empaqueta en un contenedor ICO, que admite PNG embebido). El archivo resultante se
    commitea; el script no corre en build.
  - Íconos del manifiesto: `public/icons/icon-192.png`, `icon-512.png` e `icon-maskable-512.png` (con margen
    de seguridad del 20 %), generados por el mismo script y referenciados desde `manifest.ts`.
  - `src/app/manifest.ts`: `name` y `short_name` importados de `src/i18n/messages/en.json` (`common.appName`
    "Personal Finances", `common.appShortName` "Finances"; idioma por defecto, Principio VI: sin textos escritos a
    mano), `start_url: "/dashboard"`, `display: "standalone"`, `theme_color: "#0F766E"`, `background_color: "#ECFDF5"`.
- **Rationale**: convenciones de archivos de Next 16 (`app-icons.md`, `manifest.md`); `favicon` no se puede generar
  con código, por eso el script; PNG estáticos en `public/` evitan rutas extra en build.
- **Alternatives considered**: `generateImageMetadata` en `icon.tsx` (conflicto de nombre con `icon.svg` y más
  rutas dinámicas); dejar el `favicon.ico` de Next (rompe la identidad en navegadores que lo piden por defecto).

## R7. Logotipo

- **Decision**: `BrandMark` como SVG inline con `aria-hidden`, coloreado con `var(--brand-ink)` (cuadrado) y
  `var(--brand-emerald)` (barras), más un borde `var(--border)` para que el cuadrado se distinga sobre el fondo
  oscuro. El nombre de la app sigue como texto adyacente traducido.
- **Rationale**: Lucide no incluye marcas; SVG inline no hace peticiones y hereda tema.

## R8. Movimiento: CSS vs Framer Motion

- **Decision**:
  - **CSS** (sin JS): hover/active de botones, transición del blur de privacidad, crecimiento de la barra
    (`transform: scaleX` con `transform-origin: left` y `transition`), color del semáforo, shimmer de skeletons,
    realce de saldo (`@keyframes balance-highlight`, re-disparado con `key`), fundido de contenido en
    `(app)/template.tsx`, duraciones de `tw-animate-css` en diálogos y sheets.
  - **Framer Motion**: entrada escalonada de las tarjetas del dashboard (`m.div` + `variants` con `staggerChildren`)
    y el indicador de navegación (`m.span` que anima `y`/`x` a la posición medida del enlace activo; **no** se usa
    `layoutId`, que requiere `domMax`).
  - `MotionProvider`: `<LazyMotion features={() => import("./features").then(r => r.default)} strict>` +
    `<MotionConfig reducedMotion="user">`. `domAnimation` se descarga en un chunk aparte tras la hidratación.
- **Rationale**: lo simple en CSS no cuesta JS; `LazyMotion` asíncrono mantiene el JS de primera carga dentro de
  SC-006 (el componente `m` pesa ~5 kB; las features ~15 kB fuera de la primera carga). `strict` impide colar
  `motion.*` (que arrastraría todo el bundle).
- **Alternatives considered**: `motion.*` directo (~35 kB en primera carga); `layoutId` (requiere `domMax`, +10 kB);
  View Transitions API (soporte desigual en Firefox/Safari y choca con el gate de preferencias).

## R9. Movimiento reducido

- **Decision**: bloque global en `globals.css`:
  `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important;
  animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important } }`
  más `.animate-shimmer { animation: none }` y `MotionConfig reducedMotion="user"` (Framer desactiva
  transform/layout). Las variantes de la entrada escalonada usan `useReducedMotion()` para saltar también la
  opacidad (estado final directo).
- **Verificación**: e2e con `page.emulateMedia({ reducedMotion: "reduce" })`: tras cargar cada pantalla,
  `document.getAnimations().filter(a => a.playState === "running")` es `[]`.

## R10. Privacidad durante las transiciones

- **Decision**: `.money` tiene siempre `transition: filter 200ms` (se difumina y se aclara con transición en los dos
  sentidos), porque `<Money>` ya renderiza `••••` en el mismo render en que se activa la privacidad: lo que se
  difumina nunca es un monto real. En cambio, `transition: filter` sobre `input[data-money]` se declara **solo** en
  `html[data-privacy="off"] input[data-money]`: CSS usa la transición del estado de destino, así que al activar la
  privacidad los campos de monto se difuminan al instante y al desactivarla se aclaran con transición. No hay animaciones de conteo (FR-030) y el realce de saldo solo anima
  `background-color` de la tarjeta, nunca el texto.
- **Rationale**: los `input[data-money]` solo están protegidos por el blur; una transición de 200 ms al activarlo
  dejaría ver el valor parcialmente.

## R11. Diálogos como bottom sheet

- **Decision**: cambiar solo las clases de `DialogContent` en `src/components/ui/dialog.tsx`: por debajo de `sm`
  queda anclado abajo (`inset-x-0 bottom-0 top-auto translate-0`, `rounded-t-2xl`, `max-h-[90dvh]`,
  `overflow-y-auto`, `pb-[env(safe-area-inset-bottom)]`, `slide-in-from-bottom`); desde `sm` conserva el diálogo
  centrado actual. Sin arrastre para cerrar (no lo pide la spec).
- **Rationale**: los 12 diálogos existentes cambian sin tocarse; sigue siendo `role="dialog"` (e2e intactos); al
  cruzar el punto de corte no se desmonta nada, así que lo escrito se conserva (edge case de rotación).
- **Alternatives considered**: componente `ResponsiveDialog` que alterna `Dialog`/`Sheet` con `matchMedia`
  (remonta el contenido al rotar y obliga a editar 12 archivos).

## R12. Navegación móvil y header

- **Decision**: `MobileNav` (`md:hidden`, `fixed bottom-0`, `pb-[env(safe-area-inset-bottom)]`) con los 4
  `NAV_ITEMS` marcados `primary` + botón "Más" que abre el `Sheet` lateral existente. CTA flotante "Agregar gasto"
  (variante `cta`, `size-14`, encima de la barra) que abre `AddExpenseDialog`; se oculta al hacer scroll hacia abajo
  (listener pasivo de `scroll` con umbral de 8 px, `translate-y` CSS) y cuando un input tiene el foco
  (`:has(input:focus)` en el contenedor no aplica al body → se usa `focusin`/`focusout`). Por la aclaración de la
  spec, en móvil el CTA flotante es la única llamada a la acción destacada: los botones de página con
  `variant="cta"` vuelven al estilo `default` por debajo de `md` y el `add-expense` de Dashboard/Gastos se oculta. `main` recibe
  `pb-[calc(4rem+env(safe-area-inset-bottom))]` en móvil. En el header por debajo de `md`: `BrandMark`,
  `PrivacyToggle` y un botón "Preferencias" que abre `PreferencesSheet` (`side="bottom"`) con `LanguageToggle`,
  `CurrencyToggle`, `ThemeToggle` y cerrar sesión. En escritorio los toggles siguen en línea (mismos `data-testid`,
  así los e2e actuales de escritorio no cambian).
- **Rationale**: zona del pulgar; el panel de preferencias es un diálogo (no un menú con roles `menuitem`), así los
  toggles conservan su semántica de botones.
- **Alternatives considered**: `DropdownMenu` con los toggles dentro (mezcla roles de menú con grupos de botones).

## R13. Control de tema

- **Decision**: `ThemeToggle` = `DropdownMenu` con `DropdownMenuRadioGroup` (Claro / Oscuro / Sistema, íconos Sun /
  Moon / Monitor), botón disparador `icon-sm` con `aria-label` traducido y `data-testid="theme-toggle"`; opciones
  con `data-testid="theme-option-{light|dark|system}"`.
- **Rationale**: tres estados no caben en un botón binario; `menuitemradio` comunica la selección a lectores de
  pantalla.

## R14. Dashboard y tarjetas

- **Decision**: en `BucketCard` el saldo disponible pasa a cifra destacada (`text-[clamp(2rem,6vw,2.75rem)]`
  `font-semibold tabular-nums`) sobre bloque `bg-surface-highlight`; en `Dashboard` la rejilla es
  `grid gap-4 md:grid-cols-2` con contenido `max-w-7xl` y las alertas de cobro se mueven debajo de los buckets
  en móvil (`order-*`). Barra: `scaleX(percent/100)` con `transition-transform duration-slow` (300 ms, FR-034). Realce: cuando
  `data.available` cambia respecto al render previo (ref), se incrementa una `key` que reaplica la clase
  `animate-balance-highlight` (300 ms, `--duration-slow`, FR-034; es un fondo, no movimiento, pero también se anula con
  reduced motion).
  Entrada escalonada: solo si `useUi().dashboardIntroPlayed === false`; al terminar se marca `true`.
- **Rationale**: FR-026/027/029/030/031; el flag en `useUi` (no persistido) cumple "solo en el primer montaje de la
  sesión".

## R15. Gráficas

- **Decision**: `--series-1` (patrimonio neto) = `#048E84` / `#17AD7B`; `--series-2` (pasivos) = `#EB6834` /
  `#DC7611`; `--series-3` (activos) = `#2A78D6` / `#5195E9`. Todos ≥ 3:1 sobre su superficie (claro: 4.03 / 3.20 /
  4.42 sobre blanco y 3.83 / 3.04 / 4.19 sobre `#ECFDF5`; oscuro: 6.00 / 5.46 / 5.61 sobre `#031F1D` y
  5.10 / 4.64 / 4.77 sobre `#052E2B`). La leyenda con nombres existente se mantiene (la identidad nunca depende solo
  del color). El contenedor de la gráfica usa `bg-surface-highlight`.
- **Validación (T003, `dataviz/scripts/validate_palette.js --pairs all`)**: los valores propuestos al principio
  (`#0F766E`, `#EB6834`, `#2A78D6` / `#34D399`, `#FB923C`, `#60A5FA`) **sí** separaban teal y azul en deuteranopía
  (todos los pares ≥ 8 en protan/deutan), pero fallaban dos gates duros del validador: en claro, `#0F766E` está por
  debajo del piso de croma (C 0.086 < 0.10, se lee grisáceo como marca de serie); en oscuro, los tres quedaban por
  encima de la banda de luminosidad (L 0.71–0.77 > 0.67). Se buscaron los valores más cercanos (mismo tono OKLCH) que
  pasan los cinco gates en las dos superficies de cada tema:
  - Claro `#048E84, #EB6834, #2A78D6`: banda, croma, CVD (peor par naranja↔teal ΔE 10.3 protan), visión normal
    (peor par azul↔teal ΔE 15.9) y contraste → PASS.
  - Oscuro `#17AD7B, #DC7611, #5195E9`: banda, croma, CVD (peor par naranja↔verde ΔE 11.0 deutan), visión normal
    (peor par azul↔verde ΔE 20.2) y contraste → PASS.
  - Tritanopía (solo informativa en el validador): teal↔azul ΔE ≈ 3 en ambos temas; cubierto por la leyenda con
    nombres (codificación secundaria).
- **Note**: `--series-1` ya no es exactamente `--brand-teal`/`--brand-emerald` (siguen siendo los colores de marca
  para UI): es su variante de gráfica en el mismo tono. El orden del código es `netWorth → series-1`,
  `liabilities → series-2`, `assets → series-3`; no cambia, solo los valores de los tokens.

## R16. Objetivos táctiles e inputs

- **Decision**: variante `pointer-coarse:` de Tailwind v4 en `button.tsx` (`pointer-coarse:min-h-11
  pointer-coarse:min-w-11`) y en enlaces de navegación; `input.tsx` y `native-select.tsx` con
  `text-base md:text-sm` (16 px en móvil evita el zoom de iOS); los campos de monto ya usan `data-money`, se añade
  `inputMode="decimal"` donde falte.
- **Rationale**: WCAG 2.5.8 pide 24 px; 44 px es la recomendación de Apple/WCAG AAA y la meta de FR-025.
