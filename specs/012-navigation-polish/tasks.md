# Tasks: Pulido visual de la navegación y del menú móvil

**Input**: `specs/012-navigation-polish/` (plan, spec, research, contracts/ui-contract.md)

**Formato**: `- [ ] T### [P] [USn] [Frente] descripción con ruta`. Frentes: **A** Shell · **B** Color/barra/aviso · **C** Tests. Los frentes A y B no comparten archivos y corren en paralelo; C va después. Solo UI: sin Docker, Supabase ni migraciones; e2e solo en modo demo. Rutas relativas a `src/` salvo `tests/`.

## Phase 1: Contrato

- [ ] T001 [A] Exportar `TILE_CLASS` (mismas clases que los mosaicos de la hoja ＋: `min-h-20 rounded-xl border bg-card …`) desde `src/components/layout/nav-items.ts`
- [ ] T002 [P] [A] Usar `TILE_CLASS` en los mosaicos de `src/components/layout/CreateSheet.tsx` (sin cambiar aspecto ni `data-testid`)

## Phase 2: US1 — "Más" compacto y barra que no tapa (P1)

- [ ] T003 [US1] [A] En `src/components/layout/AppShell.tsx`, reemplazar `NavGroups` en la hoja `more-sheet` por `MoreGrid` local: `grid grid-cols-3 gap-2` con 6 destinos usando `TILE_CLASS`; activo con `aria-current="page"` + `bg-nav-active text-nav-active-foreground`; sin `NavIndicator`; grupos como `<section class="contents">` + `<h2 class="sr-only">` + `<ul class="contents">` (el test `nav h2` = 4 debe seguir pasando; si VoiceOver pierde la lista, lista plana sin encabezados); Configuración como fila de ancho completo bajo un separador con `ChevronRight`; quitar `onNavigate` y el sufijo `-more` de `NavGroups`
- [ ] T004 [P] [US1] [A] En `AppShell.tsx`, `pb` de `main` móvil de `5rem` a `4.5rem` (+ área segura)
- [ ] T005 [P] [US1] [B] En `src/components/layout/MobileNav.tsx`, ＋ de `size-14 -mt-5 ring-4 ring-background shadow-[…]` a `size-12` sin margen negativo, anillo ni halo; conservar `relative z-10`, `bg-cta`, rotación 45° y `aria-*`

## Phase 3: US2 — Lima solo para acciones en neón (P1)

- [ ] T006 [P] [US2] [B] En `src/styles/tokens.css`: primitiva `--brand-acid-deep: #2d320c`; en `.neon` `--nav-active: var(--brand-acid-deep)` y `--nav-active-foreground: var(--brand-acid)`
- [ ] T007 [US2] [B] En `src/app/globals.css`, las reglas `.neon` de shimmer y `balance-highlight-neon` que usan `var(--nav-active)` pasan a `var(--primary)` (mismo aspecto)
- [ ] T008 [P] [US2] [B] `src/components/layout/CurrencyToggle.tsx` y `LanguageToggle.tsx`: seleccionado `bg-primary text-primary-foreground` → `bg-nav-active text-nav-active-foreground`
- [ ] T009 [P] [US2] [B] `src/features/goals/GoalsPage.tsx` y `src/features/settings/accounts/AccountsSettings.tsx`: botón "Agregar" con `variant="outline"`; grep de otros `<Button>` sin variante en `PageHeader actions`

## Phase 4: US3 — Shell sin recortes 320–1440 px (P1)

- [ ] T010 [US3] [A] En `AppShell.tsx`, `aside` `md:w-16 lg:w-60`; en `NavList` texto en `<span class="md:max-lg:sr-only">`, enlace `md:max-lg:justify-center md:max-lg:px-0`, `title={t(labelKey)}`; encabezados de grupo `md:max-lg:sr-only` + separador fino entre grupos en ese rango

## Phase 5: US4 — Header con contexto y aviso demo corto (P2)

- [ ] T011 [US4] [A] En `AppShell.tsx`, tras el logo: `<span aria-hidden class="header-title md:hidden truncate text-sm font-semibold">` con el `labelKey` del `NAV_ITEMS` activo (`isActiveRoute`; subpáginas de Configuración → "Configuración")
- [ ] T012 [P] [US4] [B] En `src/app/globals.css`, `.header-title`: `opacity: 0`; bajo `@supports (animation-timeline: scroll())` y `@media (prefers-reduced-motion: no-preference)`, animación solo de opacidad con `animation-timeline: scroll(root); animation-range: 3rem 6rem`; comentario `shortcut:` (sin soporte queda oculto)
- [ ] T013 [P] [US4] [B] Clave `demo.bannerShort` en `src/i18n/messages/es.json` ("Demo de solo lectura · datos ficticios") y `en.json` ("Read-only demo · sample data"); `src/components/layout/DemoBanner.tsx`: corto visible `< sm`, largo `hidden sm:inline` (sigue en el DOM), `data-testid="demo-banner"` intacto

## Phase 6: US5 — Cerrar sesión al sidebar (P3)

- [ ] T014 [US5] [A] En `AppShell.tsx`, quitar el `Button ghost` "Cerrar sesión" de la barra superior; `NavGroups` recibe `footerExtra` y lo pinta bajo Configuración (mismo estilo de fila; en el riel, icono con texto `sr-only`); móvil sigue en "Apariencia"
- [ ] T015 [P] [B] Borrar `nav.openMenu`, `nav.closeMenu`, `nav.preferences` de `src/i18n/messages/{en,es}.json` (0 usos; mantener paridad)

## Phase 7: Cierre de A y B (sesión principal)

- [ ] T016 Revisar diff de A y B; `pnpm exec tsc --noEmit`, `pnpm exec eslint` de sus archivos y `pnpm test`; commit + push por frente

## Phase 8: Frente C — Tests e2e en modo demo (después de A y B)

- [ ] T017 [P] [C] `tests/e2e/mobile.spec.ts`: el ＋ queda dentro del rectángulo de la barra; la hoja "Más" mide ≤ 50 % del alto y muestra los 7 enlaces; mosaicos ≥ 44 px de alto
- [ ] T018 [P] [C] `tests/e2e/navigation.spec.ts`: a 768×600, `main` sin desbordamiento horizontal y cada enlace del riel con nombre accesible; un solo `[data-variant="cta"]` visible (incluye `/goals` y `/settings/accounts`)
- [ ] T019 [C] Correr `E2E_MODES=demo` para `a11y`, `motion`, `us9-demo`, `mobile`, `navigation`; corregir lo que falle (sin editar archivos fuera de los dos specs salvo reportarlo)

## Phase 9: Gate, revisión visual y docs (sesión principal)

- [ ] T020 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] T021 `E2E_MODES=demo pnpm test:e2e`
- [ ] T022 `pnpm build && pnpm check:demo-bundle` (First Load de `/dashboard` no crece)
- [ ] T023 Capturas con `pnpm dev:demo` a 320/390/768/1440 px en neón, claro y oscuro: "Más", hoja ＋, Metas con scroll, Dashboard a 768 px
- [ ] T024 [P] Docs: `README.md` (viñeta "Mobile first": cuadrícula y riel), `docs/ux-roadmap.md` (sección spec 012), enmiendas en `specs/008-navigation-shell/spec.md` (FR-003, FR-006, FR-012, indicador en "Más")
- [ ] T025 Marcar tareas `[X]`, commit + push final

## Dependencias

- T001 → T003 (A). T006 → T007. T011 requiere T012 para verse (contrato `header-title`), pero no para compilar.
- A (T001–T004, T010, T011, T014) y B (T005–T009, T012, T013, T015) en paralelo; C (T017–T019) después de T016; Fase 9 al final.
