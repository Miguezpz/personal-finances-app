---

description: "Task list for 003-ui-refresh"
---

# Tasks: Renovación visual "Fresh & Growth"

**Input**: Design documents from `specs/003-ui-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-theme.md, quickstart.md

**Tests**: incluidos. La spec los pide explícitamente: verificación automática de contraste (FR-039), axe en tema
oscuro y móvil (FR-038), y SC-004/SC-005/SC-007 son verificables por e2e.

**Organization**: tareas agrupadas por historia de usuario; cada historia se puede probar por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1–US4) a la que pertenece

## Path Conventions

Proyecto Next.js único: `src/`, `tests/`, `scripts/`, `public/` en la raíz del repo.

---

## Phase 1: Setup

**Purpose**: punto de partida en `main`, línea base y validación previa de colores de gráficas.

- [x] T001 Confirmar el punto de partida: se trabaja directamente en `main` (decisión del usuario, sin rama de feature); `git status` limpio y `.specify/feature.json` apuntando a `specs/003-ui-refresh`
- [x] T002 Registrar la línea base en `specs/003-ui-refresh/baseline.md`: salida de `pnpm build` (tabla de rutas con First Load JS de `/` y `/dashboard`) y resultado de `E2E_MODES=demo pnpm test:e2e` (todo en verde); capturas de `/dashboard`, `/ledger` y `/net-worth` en 375 px y 1440 px opcionales en `specs/003-ui-refresh/baseline/`
- [x] T003 [P] Validar las series de la gráfica de patrimonio con el validador de CVD de la skill `dataviz` (claro: `#0F766E`, `#EB6834`, `#2A78D6`; oscuro: `#34D399`, `#FB923C`, `#60A5FA`, sobre `#FFFFFF`, `#ECFDF5`, `#031F1D`); si teal y azul no se distinguen en deuteranopía, ajustar `--series-3` y anotar el valor final en la sección R15 de `specs/003-ui-refresh/research.md` y en la tabla §1 de `specs/003-ui-refresh/contracts/ui-theme.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tokens, utilidades CSS, botón, infraestructura de movimiento y textos que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza hasta terminar esta fase.

- [x] T004 Crear `src/styles/tokens.css` con: los primitivos `--brand-*` de `data-model.md` §3 (`--brand-ink #052E2B`, `--brand-teal #0F766E`, `--brand-emerald #34D399`, `--brand-mint #A7F3D0`, `--brand-mist #ECFDF5`, `--brand-ink-soft #4B635F`, `--brand-teal-strong #115E59`, `--brand-deep #031F1D`, `--brand-sage #8FB8AE`, `--brand-white #FFFFFF`); los semánticos de `contracts/ui-theme.md` §1 en `:root` (claro) y `.dark` (oscuro), cada uno como `var(--brand-*)` o un único HEX (incluidos `--cta`, `--cta-foreground`, `--primary-hover`, `--success`, `--surface-highlight`, `--nav-active`, `--nav-active-foreground`, `--series-1..3`, `--sidebar-*`, `--chart-1..5` mapeados a la escala de marca, `--border #D1E7E0`/`#1A4541`, `--input #6B958A`/`#5B867C`, `--destructive #B91C1C`/`#F87171`); y los tokens de movimiento (`--duration-fast 150ms`, `--duration-base 200ms`, `--duration-slow 300ms`, `--ease-out-quint cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-in-out cubic-bezier(0.65, 0, 0.35, 1)`)
- [x] T005 Reescribir `src/app/globals.css`: importar `../styles/tokens.css`; quitar los bloques `:root`/`.dark` antiguos (OKLCH neutros y `--series-*`); ampliar `@theme inline` con `--color-cta`, `--color-cta-foreground`, `--color-primary-hover`, `--color-success`, `--color-surface-highlight`, `--color-nav-active`, `--color-nav-active-foreground`, `--duration-fast|base|slow` y `--ease-out-quint`; añadir `html { color-scheme: light }` y `.dark { color-scheme: dark }`; conservar las reglas de privacidad existentes (depende de T004)
- [x] T006 [P] Escribir `tests/unit/theme-contrast.test.ts`: leer `src/styles/tokens.css` con `node:fs`, extraer los bloques `:root` y `.dark`, resolver un nivel de `var(--brand-*)`, calcular el ratio WCAG 2.1 (luminancia relativa) y comprobar por tema los pares de `contracts/ui-theme.md` §1 «Pares verificados» (texto ≥ 4.5; no-texto ≥ 3); además, afirmar que ningún token de texto del tema claro (`--foreground`, `--muted-foreground`, `--primary` como enlace, `--success`, `--card-foreground`) vale `--brand-emerald` (FR-004)
- [x] T007 Actualizar `src/components/ui/button.tsx` según `contracts/ui-theme.md` §3: `default` → `bg-primary text-primary-foreground hover:bg-primary-hover`; nueva variante `cta` (`bg-cta text-cta-foreground` + sombra teñida que se intensifica en hover); nuevo tamaño `fab` (`size-14 rounded-full`); base con `active:scale-[.98]`, `transition-[color,background-color,box-shadow,transform] duration-fast`, `focus-visible:ring-3 focus-visible:ring-ring/60` y `pointer-coarse:min-h-11 pointer-coarse:min-w-11`; quitar `active:translate-y-px`
- [x] T008 [P] Crear `src/components/motion/features.ts` (`export default domAnimation` de `framer-motion`) y `src/components/motion/MotionProvider.tsx` (`"use client"`; `<LazyMotion features={() => import("./features").then((m) => m.default)} strict>` + `<MotionConfig reducedMotion="user">`)
- [x] T009 Envolver el árbol en `MotionProvider` dentro de `src/app/providers.tsx` (por dentro de `QueryClientProvider`, por fuera de `PreferencesGate`) (depende de T008)
- [x] T010 [P] Ampliar `src/store/ui.ts` con `dashboardIntroPlayed: boolean` (default `false`) + `markDashboardIntroPlayed()` y `preferencesOpen: boolean` (default `false`) + `setPreferencesOpen(open)`; ninguno se persiste (data-model.md §2)
- [x] T011 [P] Añadir los textos nuevos a `src/i18n/messages/en.json` y `src/i18n/messages/es.json`: `theme.toggle` ("Theme"/"Tema"), `theme.light` ("Light"/"Claro"), `theme.dark` ("Dark"/"Oscuro"), `theme.system` ("System"/"Sistema"), `nav.more` ("More"/"Más"), `nav.preferences` ("Preferences"/"Preferencias"), `nav.mobileLabel` ("Quick navigation"/"Navegación rápida"), `common.appShortName` ("Finances"/"Finanzas"); verificar que ambos archivos tienen las mismas claves

**Checkpoint**: `pnpm typecheck && pnpm lint && pnpm test` en verde (incluido el test de contraste); la app ya se ve con la paleta de marca en claro.

---

## Phase 3: User Story 1 - Identidad visual que inspira confianza (Priority: P1) 🎯 MVP

**Goal**: paleta aplicada a todas las pantallas, logotipo propio, íconos y manifiesto, semáforo y gráfica con la marca,
una sola llamada a la acción destacada por pantalla en escritorio.

**Independent Test**: en escritorio y tema claro, recorrer todas las rutas: solo colores de la paleta, logo propio en
header y landing, como mucho un botón `cta` por pantalla, ícono de marca en la pestaña, `/manifest.webmanifest`
válido, axe sin problemas graves.

### Tests for User Story 1

- [x] T012 [P] [US1] Crear `tests/e2e/brand.spec.ts` (sin tag: corre en los 4 proyectos): (a) `<head>` contiene `link[rel=icon][type="image/svg+xml"]`, `link[rel=apple-touch-icon]` y `link[rel=manifest]`; (b) `GET /manifest.webmanifest` devuelve `name` "Personal Finances", `theme_color` "#0F766E" e íconos 192/512; (c) `brand-mark` visible en el header de `/dashboard` y en `/` (en demo, `/` redirige: comprobar solo el header); (d) en viewport 1280×800, para cada ruta de `tests/e2e/app-routes.ts`, `page.locator('[data-variant="cta"]:visible')` cuenta ≤ 1 (SC-007)

### Implementation for User Story 1

- [x] T013 [P] [US1] Crear `src/components/brand/BrandMark.tsx`: SVG inline 24×24 (`viewBox="0 0 24 24"`), cuadrado redondeado `fill="var(--brand-ink)"` con trazo `var(--border)`, tres barras ascendentes `fill="var(--brand-emerald)"`; props `className`; `aria-hidden="true"`, `data-testid="brand-mark"`
- [x] T014 [P] [US1] Crear `src/app/icon.svg`: el mismo monograma simplificado para 16 px (2–3 barras gruesas, sin detalles finos) con `<style>@media (prefers-color-scheme: dark){ .frame{ stroke:#ECFDF5 } }</style>` para pestañas oscuras
- [x] T015 [US1] Crear `scripts/generate-favicon.mjs` (se ejecuta a mano, no en build): renderiza el monograma con `ImageResponse` de `next/og` a PNG 16/32/48 y los empaqueta en `src/app/favicon.ico` (contenedor ICO con PNG embebido), y escribe `public/icons/icon-192.png`, `public/icons/icon-512.png` y `public/icons/icon-maskable-512.png` (fondo `#052E2B` a sangre, monograma dentro del 80 % central); ejecutarlo y commitear los binarios resultantes (depende de T014 para el diseño)
- [x] T016 [P] [US1] Crear `src/app/apple-icon.tsx`: `ImageResponse` 180×180, fondo sólido `#052E2B`, barras `#34D399`; `export const size = { width: 180, height: 180 }`, `contentType = "image/png"`; sin APIs de request (estático en build)
- [x] T017 [P] [US1] Crear `src/app/manifest.ts` (`MetadataRoute.Manifest`) según `contracts/ui-theme.md` §7: `name` = `common.appName` y `short_name` = `common.appShortName` importados de `src/i18n/messages/en.json` (idioma por defecto, Principio VI: sin textos escritos a mano), `description` igual que el `metadata` del layout, `start_url` "/dashboard", `display` "standalone", `theme_color` "#0F766E", `background_color` "#ECFDF5", íconos `/icons/icon-192.png` (192x192), `/icons/icon-512.png` (512x512), `/icons/icon-maskable-512.png` (512x512, `purpose: "maskable"`)
- [x] T018 [US1] Actualizar `src/app/layout.tsx`: `viewport.themeColor = [{ media: "(prefers-color-scheme: light)", color: "#FFFFFF" }, { media: "(prefers-color-scheme: dark)", color: "#031F1D" }]`, `viewport.colorScheme = "light dark"`, `viewport.viewportFit = "cover"` (leer antes `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`)
- [x] T019 [P] [US1] Borrar el boilerplate de `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) tras confirmar con `grep -r` que nada los referencia
- [x] T020 [US1] Actualizar `src/components/layout/AppShell.tsx` (solo identidad, no móvil): `BrandMark` (`size-7`) en lugar de `Wallet` en el header; sidebar con `bg-sidebar`; enlace activo de `NavLinks` con `bg-nav-active text-nav-active-foreground font-semibold` e inactivos `text-muted-foreground hover:bg-muted hover:text-foreground`; contenedor `max-w-7xl` y sidebar `w-60` (depende de T013)
- [x] T021 [P] [US1] Actualizar `src/features/auth/Landing.tsx`: `BrandMark` (`size-12`) en lugar del recuadro con `Wallet`; fondo del `main` con gradiente sutil `bg-gradient-to-b from-surface-highlight to-background`; botón "Explorar demo" con `variant="cta"` (depende de T013)
- [x] T022 [P] [US1] Actualizar `src/features/safe-to-spend/TrafficLightBadge.tsx`: `green.badge` → `bg-surface-highlight text-success ring-success/25`, `green.bar` → `bg-primary`; `yellow`/`red` sin cambios (FR-012); quitar las clases `emerald-*`
- [x] T023 [US1] Actualizar `src/features/safe-to-spend/BucketCard.tsx` (identidad): saldo disponible en bloque `rounded-lg bg-surface-highlight p-4` con cifra `text-[clamp(2rem,6vw,2.75rem)] font-semibold tracking-tight`; ícono de recurrente aplicado `text-success` en lugar de `text-emerald-600`; título de tarjeta con eyebrow `text-xs font-semibold uppercase tracking-wide text-primary` (depende de T022)
- [x] T024 [P] [US1] Actualizar `src/features/net-worth/NetWorthChart.tsx`: envolver el `ResponsiveContainer` en un bloque `rounded-lg bg-surface-highlight p-3`; las series siguen usando `var(--series-1..3)` (los valores cambian en T004/T003); sin tocar los helpers de `src/components/charts/`
- [x] T025 [P] [US1] Sustituir colores sueltos por semánticos: en `src/features/ledger/LedgerTable.tsx` `text-emerald-700 dark:text-emerald-400` → `text-success`; en `src/features/receivables/ReceivablesPage.tsx` el estado `collected` → `bg-surface-highlight text-success`; mantener ámbar en `partial`, en `src/features/fx/FxStatus.tsx` y en `src/components/layout/DemoBanner.tsx` (alertas)
- [x] T026 [US1] Aplicar `variant="cta"` a la acción principal en escritorio: `add-expense` en `src/features/safe-to-spend/Dashboard.tsx` y `src/features/expenses/ExpensesPage.tsx`, `register-income` en `src/features/income/IncomePage.tsx`, `add-goal` en `src/features/goals/GoalsPage.tsx`, `add-receivable` en `src/features/receivables/ReceivablesPage.tsx`; comprobar que ninguna otra acción de esas pantallas usa `cta` (FR-006) (depende de T007)

**Checkpoint**: US1 completa en escritorio: `pnpm test` + `E2E_MODES=demo pnpm test:e2e` (brand, a11y, matrix) en verde.

---

## Phase 4: User Story 2 - Registrar y consultar desde el celular con una mano (Priority: P1)

**Goal**: barra inferior, CTA flotante como única llamada a la acción destacada en móvil, header compacto con panel de
preferencias, diálogos tipo bottom sheet, libro en tarjetas, objetivos táctiles ≥ 44 px, sin scroll horizontal.

**Independent Test**: en 375×812 con `hasTouch`, navegar con la barra inferior, abrir "Más", registrar un gasto desde
el CTA flotante (el diálogo sube desde abajo), ver el libro en tarjetas; en 320 px ninguna ruta tiene scroll horizontal.

### Tests for User Story 2

- [x] T027 [P] [US2] Crear `tests/e2e/mobile.spec.ts` con `test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })`: (a) `mobile-nav` visible con 4 enlaces + `mobile-nav-more`, navegar a Gastos marca `aria-current="page"`; (b) `mobile-nav-more` abre el sheet con el resto de secciones; (c) `fab-add-expense` abre un `role=dialog` cuyo `boundingBox().y + height` ≈ alto del viewport (anclado abajo) y el input de monto tiene `inputmode="decimal"`; (d) en cada ruta de `app-routes.ts`, `[data-variant="cta"]:visible` cuenta exactamente 1 (el FAB) y `add-expense` no es visible; (e) `preferences-open` abre `preferences-sheet` con `language-toggle` y `currency-toggle`; cambiar idioma desde ahí funciona; (f) `/ledger` muestra `ledger-card` y no `ledger-table`; (g) cada botón/enlace visible dentro de `mobile-nav` y del header mide ≥ 44×44
- [x] T028 [P] [US2] Añadir a `tests/e2e/mobile.spec.ts` un test de desbordamiento: con viewport 320×640 y luego 375×812, para cada ruta de `app-routes.ts`, `document.documentElement.scrollWidth <= window.innerWidth` (FR-024)
- [x] T029 [P] [US2] Ampliar `tests/e2e/a11y.spec.ts` con un `describe` en viewport 375×812 que repite la auditoría de todas las rutas y de los diálogos principales (abriéndolos con `fab-add-expense` y los botones de página)

### Implementation for User Story 2

- [x] T030 [P] [US2] Añadir `primary?: true` a `NavItem` en `src/components/layout/nav-items.ts` y marcar `/dashboard`, `/expenses`, `/income`, `/goals`; exportar `PRIMARY_NAV_ITEMS` y `SECONDARY_NAV_ITEMS`
- [x] T031 [US2] Crear `src/components/layout/MobileNav.tsx` (`"use client"`): `<nav aria-label={t("mobileLabel")} data-testid="mobile-nav">` `fixed inset-x-0 bottom-0 z-30 md:hidden border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]`; 4 enlaces de `PRIMARY_NAV_ITEMS` (ícono + etiqueta corta, `aria-current`, `data-testid="mobile-nav-{href sin /}"`, ≥ 44 px) + botón "Más" (`mobile-nav-more`, ícono `Ellipsis`) que llama a `setSidebarOpen(true)`; CTA flotante `Button variant="cta" size="fab"` con ícono `Plus`, `aria-label={tExpenses("addTitle")}`, `data-testid="fab-add-expense"`, `fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`, que abre `AddExpenseDialog`; se oculta (`translate-y-[200%]`, `transition-transform duration-base`) al hacer scroll hacia abajo más de 8 px (listener `scroll` pasivo) y mientras un `input`/`select`/`textarea` tiene el foco (`focusin`/`focusout` en `document`) (depende de T030, T007)
- [x] T032 [P] [US2] Crear `src/components/layout/PreferencesSheet.tsx`: botón `preferences-open` (`Button variant="ghost" size="icon-sm"`, ícono `SlidersHorizontal`, `aria-label={t("preferences")}`, `md:hidden`) que abre `Sheet side="bottom"` controlado por `useUi().preferencesOpen`, con `SheetTitle` = `nav.preferences`, `data-testid="preferences-sheet"`, y dentro `LanguageToggle`, `CurrencyToggle` y el botón de cerrar sesión (recibe `onSignOut?: () => void`) (depende de T010)
- [x] T033 [US2] Integrar en `src/components/layout/AppShell.tsx`: ocultar el botón de menú hamburguesa (el "Más" lo sustituye; el `Sheet` lateral se conserva y lo abre `MobileNav`); en el header, `LanguageToggle`, `CurrencyToggle` y cerrar sesión con `hidden md:flex` y `PreferencesSheet` visible solo en móvil; renderizar `<MobileNav />`; `main` con `pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6`; el `Sheet` lateral pasa a listar `SECONDARY_NAV_ITEMS` en móvil (depende de T031, T032, T020)
- [x] T034 [US2] Convertir `DialogContent` en bottom sheet por debajo de `sm` en `src/components/ui/dialog.tsx` (research R11): base `inset-x-0 bottom-0 top-auto max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10`; desde `sm:` restaurar el diálogo centrado actual (`sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:rounded-xl sm:zoom-in-95`); verificar a mano los 12 diálogos de `src/features/**` en 375 px
- [x] T035 [US2] Reglas de CTA en móvil (Clarifications Q2): en `Dashboard.tsx` y `ExpensesPage.tsx` el botón `add-expense` lleva `max-md:hidden`; en `IncomePage.tsx`, `GoalsPage.tsx` y `ReceivablesPage.tsx` el botón con `variant="cta"` añade `max-md:bg-primary max-md:text-primary-foreground max-md:shadow-none` (o una prop `ctaFrom="md"` en `button.tsx` que lo resuelva igual) para que en móvil el único `cta` sea el FAB (depende de T026, T031)
- [x] T036 [US2] Libro en tarjetas: en `src/features/ledger/LedgerTable.tsx` renderizar debajo de `md` una lista `<ul>` de tarjetas (`data-testid="ledger-card"`, misma `data-type`): descripción, categoría · cuenta, fecha y `Money` alineado a la derecha; la `Table` actual queda `hidden md:table` con su `data-testid="ledger-table"`; actualizar los e2e de `tests/e2e/us8-settings-ledger.spec.ts` si leen `ledger-row` en un viewport móvil (corren en escritorio: confirmar que no cambian)
- [x] T037 [P] [US2] Tamaño de campos: `src/components/ui/native-select.tsx` con `text-base md:text-sm` (16 px en móvil) como ya hace `input.tsx`; `pointer-coarse:h-11` en ambos; revisar que todos los inputs de monto (`input[data-money]` en `src/features/**`) tienen `inputMode="decimal"` y añadirlo donde falte
- [x] T038 [US2] Dashboard responsivo en `src/features/safe-to-spend/Dashboard.tsx`: rejilla `grid gap-4 md:grid-cols-2` para los dos `BucketCard`; en móvil los buckets van antes que `CollectionAlerts` y la alerta de exceso (`order-*` o reordenando el JSX), en escritorio se mantiene el orden actual; comprobar en 1440×900 que ambos buckets con saldo, semáforo y barra se ven sin scroll (SC-008) (depende de T023)
- [x] T039 [P] [US2] Enlaces de `NavLinks` en `src/components/layout/AppShell.tsx` y toggles (`src/components/layout/LanguageToggle.tsx`, `CurrencyToggle.tsx`, `PrivacyToggle.tsx`) con `pointer-coarse:min-h-11` (y `min-w-11` en los de solo ícono) para cumplir 44×44 en táctil (FR-025)

**Checkpoint**: US2 completa: `mobile.spec.ts` y a11y móvil en verde; los e2e existentes (escritorio) siguen igual.

---

## Phase 5: User Story 3 - Tema oscuro que respeta mi preferencia (Priority: P2)

**Goal**: preferencia de tema Claro/Oscuro/Sistema (default "Sistema"), sin destello, persistente, en vivo con el SO.

**Independent Test**: con `colorScheme: "dark"` emulado y `localStorage` vacío, la app arranca en oscuro antes de
hidratar; elegir "Claro" persiste tras recargar; en "Sistema", cambiar el esquema emulado cambia la app sin recargar;
axe en oscuro sin problemas graves.

### Tests for User Story 3

- [x] T040 [P] [US3] Crear `tests/unit/preferences-theme.test.ts`: `merge` acepta `"system" | "light" | "dark"` e ignora cualquier otro valor guardado (queda `"system"`); un estado guardado sin `theme` rehidrata con `"system"`; `resolveTheme("system", true) === "dark"`, `resolveTheme("system", false) === "light"`, `resolveTheme("light", true) === "light"`; `applyTheme("dark", true)` pone `class="dark"`, `style.colorScheme="dark"` y el `content` `#031F1D` en ambos `meta[name=theme-color]` (jsdom); `applyTheme("light", false)` restaura los `content` originales; ejecutar `PREFERENCES_BOOT_SCRIPT` con `new Function` en jsdom con distintos `localStorage` y `matchMedia` simulados y comprobar la clase `dark`
- [x] T041 [P] [US3] Crear `tests/e2e/theme.spec.ts` (sin tag): (a) `page.emulateMedia({ colorScheme: "dark" })` + `goto("/dashboard", { waitUntil: "domcontentloaded" })` → `html` ya tiene la clase `dark` y `BootSkeleton`/`body` con fondo `rgb(3, 31, 29)` (sin destello, SC-004); (b) `theme-toggle` → `theme-option-light`, recargar con esquema oscuro → sigue claro; (c) `theme-option-system` y luego `emulateMedia({ colorScheme: "light" })` → la clase `dark` desaparece sin recargar; (d) `localStorage["pfa:prefs:v1"]` con `theme: "neon"` → arranca según el sistema sin errores en consola
- [x] T042 [P] [US3] Ampliar `tests/e2e/a11y.spec.ts` con un `describe` que fija `theme: "dark"` en `localStorage` (vía `page.addInitScript`) y repite la auditoría de todas las rutas y diálogos principales en escritorio (FR-038)

### Implementation for User Story 3

- [x] T043 [US3] Ampliar `src/store/preferences.ts` (data-model.md §1): `export type ThemePreference = "system" | "light" | "dark"`, `export type ResolvedTheme = "light" | "dark"`; `theme: ThemePreference` en `PreferencesState` y en `PersistedPreferences` con default `"system"` en `DEFAULT_PREFERENCES`; `setTheme(theme)`; `partialize` incluye `theme`; `merge` valida con `isThemePreference` («si el valor guardado no es uno de los tres, se ignora y queda el default»); `selectTheme`; `export function resolveTheme(theme, prefersDark): ResolvedTheme`; sin cambiar `version: 1`
- [x] T044 [US3] Ampliar `src/store/effects.tsx`: `applyTheme(resolved, explicit)` según `contracts/ui-theme.md` §4 (guardar los `content` originales de los `meta[name=theme-color]` la primera vez para restaurarlos en "Sistema"); en `PreferencesEffects`, aplicar el tema al hidratar y en cada cambio de `theme`, y con `theme === "system"` suscribirse a `matchMedia("(prefers-color-scheme: dark)")` (`change`) y desuscribirse al cambiar; ampliar `PREFERENCES_BOOT_SCRIPT` para leer `s.state.theme`, resolver `system` con `matchMedia` (sin `matchMedia` → claro) y aplicar `classList.toggle("dark", …)` + `style.colorScheme` antes del primer paint, todo dentro del `try` existente (depende de T043)
- [x] T045 [US3] Crear `src/components/layout/ThemeToggle.tsx` (`"use client"`): `DropdownMenu` con disparador `Button variant="ghost" size="icon-sm"` (ícono `Sun`/`Moon`/`Monitor` según la preferencia, `aria-label={t("toggle")}`, `data-testid="theme-toggle"`) y `DropdownMenuRadioGroup` con `theme-option-light|dark|system` que llaman a `setTheme`; prop `className` (depende de T043, T011)
- [x] T046 [US3] Integrar `ThemeToggle`: en el header de `src/components/layout/AppShell.tsx` (junto a los demás toggles, `hidden md:flex`), en `src/components/layout/PreferencesSheet.tsx` y en `src/features/auth/Landing.tsx` (esquina superior derecha junto a `LanguageToggle`) (depende de T045, T033)
- [x] T047 [US3] Quitar `next-themes`: `src/components/ui/sonner.tsx` toma `resolveTheme(usePreferences(selectTheme), prefersDark)` (con un `useSyncExternalStore` sobre `matchMedia`) y lo pasa a `<Sonner theme>`; `pnpm remove next-themes`; `grep -r next-themes src` vacío (depende de T043)
- [x] T048 [P] [US3] Revisar en tema oscuro las clases `dark:` existentes y los fondos fijos: `src/features/safe-to-spend/TrafficLightBadge.tsx` (ámbar/rojo `dark:*-950` sobre `--card` `#052E2B`), `src/components/layout/DemoBanner.tsx`, `src/features/fx/FxStatus.tsx`, `src/features/receivables/ReceivablesPage.tsx`, `src/components/ui/button.tsx` (`dark:bg-input/30` del outline), `input.tsx`/`native-select.tsx` (`dark:bg-input/30`); ajustar solo lo que axe (T042) o la inspección visual marque

**Checkpoint**: US3 completa: `preferences-theme.test.ts`, `theme.spec.ts` y a11y oscuro en verde.

---

## Phase 6: User Story 4 - Una interfaz que se siente viva sin estorbar (Priority: P3)

**Goal**: microinteracciones de `contracts/ui-theme.md` §6, todas desactivadas con movimiento reducido, sin retrasar
datos ni mostrar montos con privacidad activa.

**Independent Test**: navegar, guardar un gasto (live) y alternar privacidad viendo las transiciones; con
`reducedMotion: "reduce"` no queda ninguna animación en curso tras cargar; `perf-budgets.spec.ts` y
`us9-privacy.spec.ts` en verde.

### Tests for User Story 4

- [ ] T049 [P] [US4] Crear `tests/e2e/motion.spec.ts` (sin tag): (a) con `page.emulateMedia({ reducedMotion: "reduce" })`, para cada ruta de `app-routes.ts`, tras `main [aria-busy='true']` = 0, `document.getAnimations().filter(a => a.playState === "running")` es `[]` (SC-005); (b) sin reduced motion, en `/dashboard` los saldos (`bucket-needs .money`) son visibles en el primer render aunque la entrada escalonada esté en curso (opacidad > 0 no requerida, pero el texto existe en el DOM y `toBeVisible` en < 1 s tras `aria-busy` = 0); (c) con privacidad activada mientras corre la entrada escalonada, todo `.money` tiene `data-masked="true"` en cada muestreo (`requestAnimationFrame` durante 400 ms)
- [ ] T050 [P] [US4] Ampliar `tests/e2e/us9-privacy.spec.ts`: al activar privacidad, el `filter` computado de un `input[data-money]` sin foco es `blur(5px)` inmediatamente (sin transición: `getComputedStyle(...).transitionDuration` para `filter` es `0s` con `data-privacy="on"`) (FR-032)

### Implementation for User Story 4

- [ ] T051 [US4] Añadir a `src/app/globals.css`: `@keyframes shimmer` + `.animate-shimmer` (gradiente `--muted` → `--surface-highlight` → `--muted`, `background-size: 200% 100%`, 1.5 s en bucle); `@keyframes balance-highlight` + `.animate-balance-highlight` (fondo `--nav-active` → transparente, `var(--duration-slow)` = 300 ms, FR-034); `@keyframes content-in` + `.animate-content-in` (opacity 0→1 y `translateY(4px)`→0, `--duration-fast`, `--ease-out-quint`); transición de privacidad: `.money { transition: filter var(--duration-base) }` siempre (en los dos sentidos; `<Money>` ya muestra `••••` al activarla) y `html[data-privacy="off"] input[data-money] { transition: filter var(--duration-base) }` solo con la privacidad desactivada (al activarla, los campos de monto se difuminan al instante, FR-032); bloque global `@media (prefers-reduced-motion: reduce)` de research R9 (`animation-duration`/`transition-duration` a `.01ms !important`, `animation-iteration-count: 1`, `scroll-behavior: auto`, `.animate-shimmer { animation: none }`)
- [ ] T052 [P] [US4] `src/components/ui/skeleton.tsx`: `animate-pulse bg-muted` → `animate-shimmer`; `src/components/layout/BootSkeleton.tsx` sin cambios de estructura (hereda el shimmer) (depende de T051)
- [ ] T053 [P] [US4] Crear `src/app/(app)/template.tsx`: envuelve `children` en `<div className="animate-content-in">` (se remonta en cada navegación); confirmar que no rompe el foco de `main#main` ni el skip link (`tests/e2e/a11y.spec.ts`) (depende de T051)
- [ ] T054 [US4] Crear `src/components/layout/NavIndicator.tsx`: `m.span` absoluto `aria-hidden` con `bg-nav-active rounded-md`, que recibe la caja del enlace activo (medida con `getBoundingClientRect` relativa a la lista, recalculada en cambios de ruta y `ResizeObserver`) y anima `y`+`height` (vertical) o `x`+`width` (horizontal) con `transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}`; usarlo en `NavLinks` de `src/components/layout/AppShell.tsx` (los enlaces pasan a fondo transparente y `relative z-10`) y en `src/components/layout/MobileNav.tsx` (depende de T009, T031)
- [ ] T055 [US4] Entrada escalonada en `src/features/safe-to-spend/Dashboard.tsx`: contenedor `m.div` con `variants` (`staggerChildren: 0.04`) e hijos `m.div` (`opacity 0→1`, `y 8→0`, 200 ms) alrededor de cada `BucketCard`; `initial={introPlayed || reduced ? false : "hidden"}` con `useUi().dashboardIntroPlayed` y `useReducedMotion()`; `onAnimationComplete` → `markDashboardIntroPlayed()`; los datos se renderizan siempre en el primer render (solo cambia la opacidad/transform) (depende de T009, T010, T038)
- [ ] T056 [US4] Realce de saldo y barra en `src/features/safe-to-spend/BucketCard.tsx`: guardar `data.available` previo en un `useRef`; si cambia (y no es el primer render), incrementar una `key` del bloque de saldo con `animate-balance-highlight` (solo `background-color`, nunca el texto); barra de progreso: el hijo pasa a `w-full origin-left transition-transform duration-slow ease-out-quint` (300 ms, FR-034) con `style={{ transform: \`scaleX(${percent / 100})\` }}`, montando primero con `scaleX(0)` (estado `mounted` tras `requestAnimationFrame`); `transition-colors duration-base` en la barra y el badge para el cambio de semáforo (depende de T051, T023)
- [ ] T057 [P] [US4] Ajustar duraciones de `tw-animate-css` a 150–200 ms en `src/components/ui/dialog.tsx` (overlay y contenido: `duration-base`), `src/components/ui/sheet.tsx` (`duration-200` → `duration-base`) y `src/components/ui/dropdown-menu.tsx` (`duration-fast`) (después de T034)
- [ ] T058 [P] [US4] Animación del check del toast de éxito en `src/components/ui/sonner.tsx`: el ícono `CircleCheckIcon` con `animate-in zoom-in-50 duration-base` (desactivada por la regla de reduced motion) (después de T047)

**Checkpoint**: US4 completa: `motion.spec.ts`, `us9-privacy.spec.ts` y `perf-budgets.spec.ts` en verde.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T059 Ejecutar todos los gates: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && E2E_MODES=demo pnpm test:e2e`, luego `pnpm test:e2e:local` (demo + live con Supabase local) y `NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle`
- [ ] T060 Comparar `pnpm build` con `specs/003-ui-refresh/baseline.md`: First Load JS de `/` y `/dashboard` ≤ línea base + 20 kB (SC-006); si se pasa, comprobar que `domAnimation` está en un chunk asíncrono y que no se importa `motion.*` en ningún archivo (`grep -rn "motion\." src`); anotar el resultado en `baseline.md`
- [ ] T061 Recorrer los 20 escenarios manuales de `specs/003-ui-refresh/quickstart.md` §2 con `pnpm dev:demo` (y 15 en live) en EN y ES; anotar en `quickstart.md` cualquier desviación encontrada y corregirla
- [ ] T062 [P] Revisión visual con las skills de diseño de la constitución (`ui-ux-pro-max`, `impeccable`) si están disponibles; si no, Lighthouse móvil en `/dashboard` del build de producción (Accesibilidad ≥ 95) y registrar el resultado en `baseline.md`
- [ ] T063 [P] Actualizar `README.md`: sección de diseño (paleta, tema oscuro, movimiento reducido) y capturas nuevas de escritorio y móvil para el portafolio
- [ ] T064 [P] Actualizar el contrato histórico `specs/001-personal-finances-core/contracts/ui-store.ts` con `theme: ThemePreference` en `PersistedPreferences` y los nuevos campos de `UiState` (`dashboardIntroPlayed`, `preferencesOpen`), con un comentario que remita a `specs/003-ui-refresh/data-model.md`
- [ ] T065 Marcar `[x]` las tareas completadas en este archivo y hacer el commit final de `003-ui-refresh` en `main`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup (T003 puede cambiar `--series-3` antes de T004). Bloquea todas las historias.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational; T033 depende de T020 (US1) y T035 de T026 (US1) porque tocan los mismos archivos → hacer US1 antes de US2.
- **US3 (Phase 5)**: depende de Foundational; T046 depende de T033 (US2) para el panel de preferencias. El resto de US3 es independiente de US1/US2.
- **US4 (Phase 6)**: depende de Foundational; T054 depende de T031 (US2), T055 de T038 (US2), T056 de T023 (US1), T057 de T034 (US2), T058 de T047 (US3).
- **Polish (Phase 7)**: depende de todas las historias que se quieran entregar.

### User Story Dependencies

```text
Setup → Foundational ─┬─▶ US1 (P1) ──▶ US2 (P1) ──┐
                      │                            ├─▶ US4 (P3) ──▶ Polish
                      └─▶ US3 (P2) ────────────────┘
                          (solo T046 espera a T033 de US2)
```

### Within Each User Story

- Tests primero (deben fallar antes de implementar).
- Componentes nuevos [P] antes de su integración en `AppShell.tsx` / páginas.
- Tareas que tocan el mismo archivo (`AppShell.tsx`, `BucketCard.tsx`, `Dashboard.tsx`, `dialog.tsx`, `sonner.tsx`) son secuenciales en el orden de los IDs.

### Parallel Opportunities

- Phase 2: T006, T008, T010, T011 en paralelo tras T004/T005.
- US1: T012, T013, T014, T016, T017, T019 en paralelo; luego T021, T022, T024, T025 en paralelo.
- US2: T027, T028, T029 (tests) y T030, T032, T037, T039 en paralelo.
- US3: T040, T041, T042 (tests) en paralelo; T048 en paralelo con T045–T047.
- US4: T049, T050 (tests) en paralelo; T052, T053, T057, T058 en paralelo tras T051.
- US3 puede desarrollarse en paralelo con US1/US2 (otra persona/rama) salvo T046.

---

## Parallel Example: User Story 1

```text
# Tests e identidad base a la vez:
T012 tests/e2e/brand.spec.ts
T013 src/components/brand/BrandMark.tsx
T014 src/app/icon.svg
T016 src/app/apple-icon.tsx
T017 src/app/manifest.ts
T019 limpieza de public/

# Después de T013 y T022:
T021 src/features/auth/Landing.tsx
T024 src/features/net-worth/NetWorthChart.tsx
T025 LedgerTable.tsx + ReceivablesPage.tsx
```

## Parallel Example: User Story 3

```text
T040 tests/unit/preferences-theme.test.ts
T041 tests/e2e/theme.spec.ts
T042 tests/e2e/a11y.spec.ts (tema oscuro)
# luego, en secuencia: T043 → T044 → T045 → T046; T047 y T048 en paralelo
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) + Phase 2 (Foundational).
2. Phase 3 (US1): paleta, logo, íconos, semáforo, gráfica, CTA únicos.
3. **Parar y validar**: test de contraste + `brand.spec.ts` + a11y en escritorio; demo desplegable con la nueva identidad.

### Incremental Delivery

1. Setup + Foundational → la paleta ya se ve en toda la app.
2. US1 → identidad completa (MVP, demostrable en el portafolio).
3. US2 → experiencia móvil (la otra P1; prioridad inmediata tras el MVP).
4. US3 → tema oscuro.
5. US4 → microinteracciones y movimiento reducido.
6. Polish → presupuestos, revisión manual, README.

Cada incremento deja verdes los gates existentes (a11y, privacy, perf-budgets, matrix, check:demo-bundle).

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- Los e2e existentes corren en "Desktop Chrome": los cambios móviles no deben alterarlos; los nuevos specs fijan su propio viewport.
- `react/jsx-no-literals` está activo: todo texto visible nuevo sale de `en.json`/`es.json` (T011).
- No usar `motion.*` (solo `m.*` dentro de `LazyMotion strict`), ni animar texto de montos, ni `transition` sobre `filter` con privacidad activa.
- Todo se hace en `main` (sin rama de feature); commit en `main` al cerrar cada fase/checkpoint.
