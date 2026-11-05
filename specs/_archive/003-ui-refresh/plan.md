# Implementation Plan: Renovación visual "Fresh & Growth"

**Branch**: `main` (feature `003-ui-refresh`, sin rama propia) | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-ui-refresh/spec.md`

## Summary

Se sustituye el tema neutro por defecto de shadcn por una identidad propia con la paleta esmeralda
(#052E2B, #0F766E, #34D399, #A7F3D0, #ECFDF5) organizada en **tres capas de tokens CSS** (primitivos →
semánticos → componentes) dentro de Tailwind v4, con un **test unitario de contraste** que lee los tokens y
falla si algún par baja de WCAG AA. Se añade **tema oscuro** reutilizando el patrón existente de preferencias
(Zustand persistido + script inline antes del primer paint), con lo que se elimina `next-themes`. La identidad
llega con un logotipo SVG propio (`BrandMark`), íconos generados con las convenciones de metadatos de Next
(`icon.svg`, `apple-icon.tsx`, `favicon.ico` regenerado) y un `manifest.ts`. En móvil aparece una barra
inferior, un CTA flotante, un panel de preferencias y diálogos tipo bottom sheet **solo con CSS** (sin tocar
los 12 diálogos existentes). Las microinteracciones usan CSS para lo simple y Framer Motion (`LazyMotion` con
carga **asíncrona** de `domAnimation` + `MotionConfig reducedMotion="user"`) para la entrada escalonada y el
indicador de navegación, sin entrar en el JS de primera carga. Todo respeta el modo privacidad y
`prefers-reduced-motion`.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node.js 22

**Primary Dependencies**: Next.js 16.4 (App Router, `cacheComponents`), Tailwind CSS 4 + `tw-animate-css`,
shadcn/ui (`radix-nova`), Framer Motion 14.9 (ya instalado, hoy sin uso), Zustand 5, next-intl 4, Recharts 3,
sonner 2, Lucide. **Sin dependencias nuevas; se elimina `next-themes`.**

**Storage**: `localStorage` (`pfa:prefs:v1`), se añade el campo `theme`. Sin cambios en Supabase.

**Testing**: Vitest + Testing Library (unit), Playwright `demo-*`/`live-*` + `@axe-core/playwright` (e2e).

**Target Platform**: navegadores modernos de escritorio y móvil (iOS Safari 16+, Chrome/Edge/Firefox actuales).

**Project Type**: aplicación web (Next.js, un solo proyecto).

**Performance Goals**: presupuestos existentes (SC-002/003/004/010 de la spec 001) intactos; JS de primera
carga ≤ +20 kB respecto a la línea base (SC-006); animaciones solo con `transform`/`opacity`, ≤ 300 ms.

**Constraints**: WCAG 2.1 AA en ambos temas; sin destello de tema; ningún monto visible con privacidad activa
durante animaciones; demo sin rastros de Supabase; textos EN/ES (`react/jsx-no-literals`).

**Scale/Scope**: ~25 archivos de `src/` modificados, ~8 nuevos; 1 test unitario y 1 spec e2e nuevos, 1 spec e2e
ampliada.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Zero-Cost | Solo CSS, SVG y código cliente; los íconos se generan en build (`ImageResponse` estático); sin servicios ni dependencias nuevas. | ✅ |
| II. TS estricto / stack | Se mantiene Tailwind + shadcn/ui + Lucide y se **empieza a usar Framer Motion**, que la constitución exige y hoy no se usa. Tipos explícitos para `ThemePreference`. Zustand sigue siendo el estado global de preferencias. | ✅ |
| III. Supabase + RLS | Sin cambios de esquema ni de credenciales. | ✅ |
| IV. Aislamiento del demo | Los cambios son de presentación y no importan nada de `src/data/supabase/**`; `pnpm check:demo-bundle` sigue en el pipeline. | ✅ |
| V. Privacidad | `<Money>` sigue enmascarando con `••••`; la transición del blur solo se aplica al **quitar** la privacidad (al activarla es instantánea); sin conteos animados de cifras; la preferencia de tema no incluye datos financieros. | ✅ |
| VI. i18n | Textos nuevos (tema, "Más", "Preferencias", etiquetas) en `en.json`/`es.json`; el manifiesto usa el nombre en inglés (idioma por defecto). | ✅ |
| Restricciones (a11y) | Las skills `ui-ux-pro-max`/`impeccable` no están instaladas en el entorno (igual que en 001); se sustituyen por el test de contraste (T006) y axe en claro, oscuro y móvil (T029, T042). Ver Complexity Tracking. | ✅ con justificación |
| Flujo de calidad | Spec → plan → tareas → implementación; verificación en demo y live, EN y ES. | ✅ |

**Re-check post-diseño (Phase 1)**: una desviación justificada (auditoría de a11y sin las skills de diseño, ver Complexity Tracking). La eliminación de `next-themes` reduce dependencias; el
manifiesto en un solo idioma es una limitación del estándar (un manifiesto por origen), no una desviación; sus textos salen
del diccionario EN (idioma por defecto, Principio VI).

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-refresh/
├── plan.md              # este archivo
├── research.md          # Phase 0: decisiones técnicas
├── data-model.md        # Phase 1: preferencia de tema y modelo de tokens
├── quickstart.md        # Phase 1: guía de validación
├── contracts/
│   └── ui-theme.md      # Phase 1: tokens semánticos, variantes de botón, tema, testids, reglas de movimiento
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── styles/
│   └── tokens.css                      # NUEVO: primitivos de marca + semánticos :root/.dark + tokens de movimiento
├── app/
│   ├── globals.css                     # importa tokens.css; @theme inline (cta, success, surface-highlight);
│   │                                   #   tabular-nums en .money; reduced-motion global; keyframes (shimmer, highlight, fade)
│   ├── layout.tsx                      # viewport: themeColor claro/oscuro, viewportFit "cover"; color-scheme
│   ├── icon.svg                        # NUEVO: ícono de pestaña con variante oscura (media query interna)
│   ├── apple-icon.tsx                  # NUEVO: 180×180 con ImageResponse (estático en build)
│   ├── favicon.ico                     # REEMPLAZADO: generado desde el SVG de marca (scripts/generate-favicon.mjs)
│   ├── manifest.ts                     # NUEVO: nombre, colores, íconos 192/512 (icon-192/512 generados)
│   ├── providers.tsx                   # MotionProvider (LazyMotion async + MotionConfig reducedMotion="user")
│   └── (app)/template.tsx              # NUEVO: fundido CSS del contenido al navegar
├── components/
│   ├── brand/BrandMark.tsx             # NUEVO: logotipo SVG inline
│   ├── motion/MotionProvider.tsx       # NUEVO
│   ├── motion/features.ts              # NUEVO: export default domAnimation (chunk asíncrono)
│   ├── ui/button.tsx                   # variante `cta`; default teal; foco de marca; pointer-coarse ≥ 44 px
│   ├── ui/dialog.tsx                   # < sm: bottom sheet por CSS; ≥ sm: centrado
│   ├── ui/sonner.tsx                   # lee el tema del store (sin next-themes)
│   ├── ui/skeleton.tsx                 # shimmer en lugar de pulse
│   ├── ui/input.tsx                    # text-base en táctil (≥ 16 px)
│   └── layout/
│       ├── AppShell.tsx                # BrandMark, sidebar de marca, indicador activo, max-w-7xl, padding inferior móvil
│       ├── NavIndicator.tsx            # NUEVO: indicador deslizante (m.span, transform)
│       ├── MobileNav.tsx               # NUEVO: barra inferior (4 + "Más") + CTA flotante
│       ├── PreferencesSheet.tsx        # NUEVO: panel móvil con idioma, moneda, tema y cerrar sesión
│       ├── ThemeToggle.tsx             # NUEVO: menú radio Claro/Oscuro/Sistema
│       ├── nav-items.ts                # marca `primary` en los 4 destinos de la barra inferior
│       └── BootSkeleton.tsx            # usa los nuevos skeletons
├── store/
│   ├── preferences.ts                  # theme: ThemePreference ("system" por defecto), setTheme, selector
│   ├── effects.tsx                     # applyTheme (.dark, color-scheme, meta theme-color) + matchMedia; boot script con tema
│   └── ui.ts                           # dashboardIntroPlayed (entrada escalonada una vez por sesión)
├── features/
│   ├── safe-to-spend/{Dashboard,BucketCard,TrafficLightBadge}.tsx  # verde de marca, cifras destacadas, scaleX, realce, stagger, CTA
│   ├── net-worth/NetWorthChart.tsx     # bloque de realce detrás de la gráfica (series vía tokens)
│   ├── ledger/LedgerTable.tsx          # tarjetas apiladas < md
│   ├── auth/Landing.tsx                # BrandMark, gradiente, CTA demo
│   └── {income,expenses,goals,receivables}/…Page.tsx  # variante `cta` en la acción principal
└── i18n/messages/{en,es}.json          # theme.*, nav.more, nav.preferences, …

public/icons/icon-{192,512,maskable-512}.png  # NUEVOS: íconos del manifiesto (generados)
scripts/generate-favicon.mjs            # NUEVO (dev): SVG → PNG (next/og) → ICO 16/32/48 + PNG del manifiesto; se ejecuta a mano
tests/
├── unit/theme-contrast.test.ts         # NUEVO: parsea tokens.css y valida ratios en ambos temas
├── unit/preferences-theme.test.ts      # NUEVO: merge/validación de `theme` y applyTheme
└── e2e/
    ├── a11y.spec.ts                    # + tema oscuro + viewport móvil
    └── theme-motion.spec.ts            # NUEVO: sin destello, persistencia, reduced motion, móvil (barra, CTA, sin scroll horizontal)
```

**Structure Decision**: un solo proyecto Next.js; se añade `src/styles/` para los tokens y `src/components/{brand,motion}/`;
el resto son cambios en los módulos existentes siguiendo sus patrones (preferencias + boot script, toggles del header,
helpers de gráficas enmascaradas).

## Complexity Tracking

| Violación | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Framer Motion solo en el indicador de navegación, cargado en diferido; sin `MotionProvider` global (T008/T009 revertidos en T060) | SC-006: el proveedor estático y el `m.div` del dashboard sumaban ~20 kB gzip a la primera carga de todas las rutas | Proveedor global con `LazyMotion` asíncrono: el núcleo de `m`/`LazyMotion` igual entra en la primera carga (medido en `baseline.md`) |
| Auditoría de accesibilidad sin `ui-ux-pro-max`/`impeccable` (Restricciones Técnicas) | Las skills no están disponibles en el entorno (mismo caso documentado en `specs/001-personal-finances-core/plan.md`) | No hay alternativa equivalente instalable; se cubre con el test de contraste automático (T006, FR-039) + axe en claro, oscuro y móvil (T029, T042); T062 usa las skills si llegan a instalarse |
