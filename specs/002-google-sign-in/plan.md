# Implementation Plan: Inicio de sesión con Google

**Branch**: `002-google-sign-in` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-google-sign-in/spec.md`

## Summary

El dueño podrá entrar a la app personal con su cuenta de Google además de su correo y contraseña. Se usa el
proveedor Google de **Supabase Auth** con el flujo **OAuth + PKCE** que ya trae el cliente de navegador de
`@supabase/ssr`: el botón llama a `signInWithOAuth`, Google vuelve a Supabase y Supabase a la nueva ruta
`/auth/callback`, que canjea el código por la sesión (cookies) en el servidor y redirige siempre a `/dashboard`.
La identidad de Google se vincula automáticamente al usuario existente porque comparte el correo verificado;
el registro sigue desactivado, así que cualquier otra cuenta es rechazada (`signup_disabled`) y vuelve a `/`
con `?authError=not_authorized`. La demo no cambia: su landing ya redirige a `/dashboard` y la ruta de retorno
redirige sin cargar `@supabase/*`. No hay cambios de esquema ni de variables de entorno.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node.js 22

**Primary Dependencies**: Next.js 16 (App Router, `proxy.ts`, `cacheComponents`), `@supabase/ssr` 0.12 +
`@supabase/supabase-js` 2.118 (ya instaladas), next-intl, TanStack Query, shadcn/ui, Lucide. **Sin dependencias
nuevas.**

**Storage**: Supabase Postgres (plan gratuito). Sin migraciones: la identidad vive en `auth.identities`,
administrada por Supabase Auth.

**Testing**: Vitest + Testing Library (unit), Vitest contra Supabase local (contract), Playwright con proyectos
`demo-en`, `demo-es`, `live-en`, `live-es` (e2e).

**Target Platform**: navegador moderno; despliegue en Vercel (`miguezpz-personal-finances` y
`personal-finances-demo`).

**Project Type**: aplicación web (Next.js, un solo proyecto).

**Performance Goals**: SC-001: de la pantalla de inicio al dashboard en < 15 s y ≤ 3 clics (dominado por la
pantalla de Google).

**Constraints**: costo cero; el secreto de Google solo en el panel de Supabase; sin open redirect; la demo sin
rastros de Supabase (`pnpm check:demo-bundle`); textos EN/ES.

**Scale/Scope**: 1 usuario, 1 proveedor externo, unos 8 archivos de código y 4 de pruebas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Zero-Cost | Google OAuth y el proveedor de Supabase son gratuitos; no hay cron, colas ni servicios nuevos; la app de Google en modo Testing no requiere verificación de pago. | ✅ |
| II. TS estricto / stack | Sin `any`; tipos del contrato (`OAuthErrorCode`) explícitos; UI con shadcn/ui + Lucide (logo de Google como SVG en línea porque Lucide no incluye marcas). | ✅ |
| III. Supabase + RLS | Supabase sigue siendo el único proveedor de auth; sin tablas nuevas; el `user_id` no cambia, así que las políticas RLS existentes cubren todo; el secreto de Google no entra en `.env*`, Vercel ni el repo; nunca se usa `service_role`. | ✅ |
| IV. Aislamiento del demo | `@supabase/*` solo en `src/data/supabase/**`; la ruta `src/app/auth/callback/route.ts` lo carga con `import()` dinámico detrás de `env.isDemo`, igual que `src/proxy.ts`; el `MockProvider` rechaza el nuevo método; `check:demo-bundle` debe seguir limpio. **Desviación menor**: se agrega `route.ts` a `PROVIDER_MODE_ALLOWED` (ver Complexity Tracking). | ✅ con justificación |
| V. Privacidad | Solo se piden los scopes `openid email profile`; no se guardan tokens de Google; ningún dato financiero sale a Google; sin logs con datos personales (los errores se traducen a un código, sin `error_description` en la URL final). | ✅ |
| VI. i18n | Textos nuevos en `en.json` y `es.json`; `react/jsx-no-literals` impide literales. | ✅ |
| Flujo de calidad | Spec → plan → tareas → implementación; pruebas unitarias del mapeo de errores y de la UI; verificación en live/demo y EN/ES. | ✅ |

**Re-check post-diseño (Phase 1)**: sin cambios; la única desviación sigue siendo la de la allowlist de ESLint.

## Project Structure

### Documentation (this feature)

```text
specs/002-google-sign-in/
├── plan.md              # este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── auth-oauth.md    # Phase 1: AuthPort.signInWithGoogle + ruta /auth/callback + códigos de error
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                         # sin cambios (la demo ya redirige a /dashboard)
│   └── auth/callback/route.ts           # NUEVO: GET; demo → redirect "/"; live → import() del helper
├── data/
│   ├── provider.ts                      # AuthPort.signInWithGoogle(redirectTo) + OAuthErrorCode
│   ├── mock/provider.ts                 # signInWithGoogle → denyWrite("auth.signInWithGoogle")
│   └── supabase/
│       ├── auth.ts                      # signInWithOAuth({ provider: "google", … })
│       └── oauth-callback.ts            # NUEVO: exchangeCodeForSession + mapeo de errores → NextResponse
├── features/auth/
│   ├── GoogleSignInButton.tsx           # NUEVO: botón + logo SVG + estado "Redirigiendo…"
│   ├── oauth-error.ts                   # NUEVO: lectura/validación de ?authError (puro)
│   ├── LoginForm.tsx                    # muestra el error de Google; sin cambios en el flujo de contraseña
│   └── Landing.tsx                      # botón de Google + separador "o" sobre el formulario
├── i18n/messages/{en,es}.json           # auth.continueWithGoogle, redirecting, or, googleNotAuthorized, googleFailed
supabase/config.toml                     # /auth/callback en redirect URLs locales + [auth.external.google] desactivado
eslint.config.mjs                        # route.ts en PROVIDER_MODE_ALLOWED
docs/deploy.md                           # sección "Inicio de sesión con Google"
README.md                                # mención breve

tests/
├── unit/data/oauth-callback.test.ts     # mapeo de errores y redirecciones (sin red)
├── unit/features/google-sign-in.test.tsx# botón llama a signInWithGoogle con origin + /auth/callback; mensajes EN/ES
├── contract/data-provider.contract.ts   # mock: auth.signInWithGoogle → DemoReadOnlyError
└── e2e/google-sign-in.spec.ts           # live: botón visible, /auth/callback?error… → mensaje; demo: callback redirige
```

**Structure Decision**: se mantiene el proyecto único de Next.js. Todo lo que toca `@supabase/*` vive en
`src/data/supabase/` (como `proxy-session.ts`); la ruta de Next es una capa delgada que decide demo/live en build
time y delega.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `src/app/auth/callback/route.ts` lee `env.isDemo` (se agrega a `PROVIDER_MODE_ALLOWED`) | Una ruta de servidor no tiene `DataProvider` ni `capabilities`; necesita decidir en build time si carga `@supabase/*`, exactamente como `src/proxy.ts` y `src/app/page.tsx`, que ya están en la lista. | Canjear el código en el cliente (detección automática de `?code=` en la URL) evita la ruta, pero deja la sesión fuera del alcance del proxy en la primera petición, mezcla el canje con la landing y hace más difícil mapear errores; es la opción documentada por Supabase para SSR. |
