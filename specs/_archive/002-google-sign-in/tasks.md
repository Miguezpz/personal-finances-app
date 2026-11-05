---

description: "Task list for Inicio de sesión con Google"
---

# Tasks: Inicio de sesión con Google

**Input**: Design documents from `/specs/002-google-sign-in/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-oauth.md, quickstart.md

**Tests**: INCLUIDAS. El flujo de calidad de la constitución exige verificar toda funcionalidad nueva en modo
normal y demo y en ambos idiomas, y el plan (R8) define pruebas unitarias, de contrato y e2e. Las pruebas de cada
historia se escriben primero y DEBEN fallar antes de implementar.

**Organization**: Setup (configuración externa y local) → Foundational (contrato `AuthPort`) → US1 (entrar con
Google) → US2 (rechazo de otras cuentas) → US3 (demo intacta) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: historia de usuario del spec (US1…US3)
- Rutas relativas a la raíz del repositorio `personal-finances-app/`
- "proyecto `live`" / "proyecto `demo`" = ambos idiomas de ese modo en Playwright

---

## Phase 1: Setup (configuración externa y local)

**Purpose**: dejar listo Google + Supabase y validar la suposición de vinculación (research R1) antes de escribir
código de la app.

- [x] T001 (Dueño, manual) Crear el cliente OAuth en Google Auth Platform según `specs/_archive/002-google-sign-in/quickstart.md` § Prerrequisitos 1: Audience *External / Testing* con el Gmail del dueño como único test user; scopes `openid`, `email`, `profile`; cliente *Web application* con origins `https://miguezpz-personal-finances.vercel.app` y `http://localhost:3000` y redirect URI `https://potodtpkgadgsmeuuafx.supabase.co/auth/v1/callback`
- [x] T002 (Dueño, manual) Activar el proveedor Google en Supabase con Client ID/Secret y configurar *URL Configuration* (Site URL `https://miguezpz-personal-finances.vercel.app`; Redirect URLs `https://miguezpz-personal-finances.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`), manteniendo "Allow new users to sign up" desactivado (quickstart § Prerrequisitos 2)
- [x] T003 Ejecutar el Escenario 0 de `specs/_archive/002-google-sign-in/quickstart.md` (URL `/auth/v1/authorize?provider=google`) y verificar por SQL que el dueño tiene identidades `email` y `google` con el mismo `user_id` y que `count(auth.users) = 1`; si falla con `signup_disabled`, detenerse y aplicar el plan B de research R1
- [X] T004 [P] Actualizar `supabase/config.toml`: añadir `http://localhost:3000/auth/callback`, `http://localhost:3100/auth/callback` y `http://localhost:3200/auth/callback` a `additional_redirect_urls`, y un bloque `[auth.external.google]` con `enabled = false`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` y `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` comentado como opcional para pruebas locales
- [X] T005 [P] Añadir `src/app/auth/callback/route.ts` a `PROVIDER_MODE_ALLOWED` en `eslint.config.mjs` con un comentario que remita al Complexity Tracking de `specs/_archive/002-google-sign-in/plan.md`

---

## Phase 2: Foundational (contrato compartido)

**Purpose**: ampliar el puerto de autenticación; bloquea a todas las historias.

- [X] T006 Añadir a `src/data/provider.ts` el tipo `export type OAuthErrorCode = "not_authorized" | "failed"` y el método `signInWithGoogle(redirectTo: string): Promise<void>` en `AuthPort`, con el JSDoc de `specs/_archive/002-google-sign-in/contracts/auth-oauth.md` § 1
- [X] T007 [P] Escribir prueba que falle en `tests/contract/data-provider.contract.ts`: añadir `["auth.signInWithGoogle", () => p.auth.signInWithGoogle("http://localhost/auth/callback")]` a la lista de escrituras que el mock rechaza con `DemoReadOnlyError`
- [X] T008 Implementar en `src/data/mock/provider.ts` `signInWithGoogle: () => denyWrite("auth.signInWithGoogle")` hasta que T007 pase
- [X] T009 [P] Añadir las claves de `contracts/auth-oauth.md` § 4 (`continueWithGoogle`, `redirectingToGoogle`, `or`, `googleNotAuthorized`, `googleFailed`) al namespace `auth` de `src/i18n/messages/en.json` y `src/i18n/messages/es.json` con los textos exactos de la tabla

**Checkpoint**: `pnpm typecheck` y `pnpm test:contract` (mock) en verde.

---

## Phase 3: User Story 1 - Entrar con mi cuenta de Google (Priority: P1) 🎯 MVP

**Goal**: el dueño pulsa "Continuar con Google", elige su cuenta y aterriza en `/dashboard` con sus datos.

**Independent Test**: en local (`pnpm dev` contra la nube) y en producción, cerrar sesión, entrar con Google y ver
los mismos datos que con contraseña (quickstart, Escenario A).

### Tests for User Story 1 ⚠️

- [X] T010 [P] [US1] Escribir prueba que falle en `tests/unit/data/oauth-callback.test.ts` para la función pura `resolveCallback(params, exchange, hasSession)`: con `code` y canje OK → `/dashboard`; con `code` y canje fallido → `/?authError=failed`; sin `code` ni `error` y con sesión → `/dashboard`; parámetros `next=https://example.com` o `redirect_to=…` se ignoran (el destino siempre es una ruta relativa del mismo origen)
- [X] T011 [P] [US1] Escribir prueba que falle en `tests/unit/features/google-sign-in.test.tsx`: `GoogleSignInButton` con un proveedor falso llama a `auth.signInWithGoogle` con `${window.location.origin}/auth/callback`, se deshabilita y muestra `redirectingToGoogle` mientras tanto; si la promesa rechaza con `ProviderError("OFFLINE")` muestra `common.offline` y se vuelve a habilitar; nombre accesible "Continue with Google" / "Continuar con Google" según el idioma

### Implementation for User Story 1

- [X] T012 [US1] Implementar `signInWithGoogle` en `src/data/supabase/auth.ts`: `db.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } })`; si devuelve `error`, lanzar `toProviderError(error)`
- [X] T013 [US1] Crear `src/data/supabase/oauth-callback.ts` con `resolveCallback` (puro, exportado para T010) y `handleOAuthCallback(request: NextRequest): Promise<NextResponse>`, que crea un `createServerClient` con el mismo adaptador de cookies que `src/data/supabase/proxy-session.ts`, llama a `exchangeCodeForSession(code)` y devuelve la redirección con las cookies de sesión copiadas, siempre construida desde `request.nextUrl` (mismo origen); hasta que T010 pase
- [X] T014 [US1] Crear `src/app/auth/callback/route.ts` con `export async function GET(request: NextRequest)`: si `env.isDemo`, `NextResponse.redirect(new URL("/", request.url))`; si no, `const { handleOAuthCallback } = await import("@/data/supabase/oauth-callback")` y devolver su resultado (patrón de `src/proxy.ts`)
- [X] T015 [P] [US1] Crear `src/features/auth/GoogleSignInButton.tsx` (cliente): `Button variant="outline"` de ancho completo con el logo "G" de Google como SVG en línea (`aria-hidden`), textos `auth.continueWithGoogle` / `auth.redirectingToGoogle`, y manejo de errores `OFFLINE` → `common.offline`, `COLD_START` → `common.wakingDatabase`, otro → `auth.googleFailed` en un `role="alert"`; hasta que T011 pase
- [X] T016 [US1] Integrar en `src/features/auth/Landing.tsx`: `GoogleSignInButton` arriba dentro del `CardContent`, un separador con el texto `auth.or`, y el `LoginForm` existente debajo (sin cambiar el flujo de contraseña, FR-001)
- [X] T017 [US1] Verificar a mano el Escenario A de `specs/_archive/002-google-sign-in/quickstart.md` en local (`pnpm dev`): entrar con Google → `/dashboard` con los mismos datos; recargar mantiene la sesión; cerrar sesión vuelve a `/`

**Checkpoint**: US1 funcional; el dueño entra con Google en local.

---

## Phase 4: User Story 2 - Rechazo claro de cualquier otra cuenta (Priority: P1)

**Goal**: cualquier fallo vuelve a `/` sin sesión y con un mensaje comprensible; una cuenta ajena ve "no tiene
acceso" y no se crea ningún usuario.

**Independent Test**: visitar `/auth/callback?error=access_denied&error_code=signup_disabled` y comprobar el
mensaje "no autorizado"; con otra cuenta de Google, `count(auth.users)` sigue en 1 (quickstart, Escenarios B y C).

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Ampliar `tests/unit/data/oauth-callback.test.ts` con pruebas que fallen: `error_code=signup_disabled` → `/?authError=not_authorized`; `error=access_denied` sin `error_code` → `/?authError=failed`; `error_code=provider_disabled` → `failed`; sin `code` ni `error` y sin sesión → `failed`; `error_description` nunca aparece en la URL de destino
- [X] T019 [P] [US2] Escribir prueba que falle en `tests/unit/features/oauth-error.test.tsx`: `parseOAuthError` devuelve `"not_authorized"` / `"failed"` para valores válidos y `null` para cualquier otro; `OAuthErrorAlert` con `?authError=not_authorized` muestra `auth.googleNotAuthorized` en `role="alert"` (EN y ES), con `failed` muestra `auth.googleFailed`, con un valor desconocido no muestra nada, y tras mostrarlo llama a `router.replace("/")`
- [X] T020 [P] [US2] Escribir prueba e2e que falle en `tests/e2e/google-sign-in.spec.ts` (proyecto `live`): el botón "Continuar con Google" es visible y operable con teclado en `/`; `/auth/callback?error=access_denied&error_code=signup_disabled` termina en `/` con el mensaje de "no tiene acceso"; `/auth/callback` sin parámetros termina en `/` con el mensaje genérico; `/auth/callback?next=https://example.com` nunca sale del origen — nota: escrita; la parte `live` se ejecuta en T028 con Supabase local (Docker)

### Implementation for User Story 2

- [X] T021 [US2] Completar el mapeo de errores en `resolveCallback` de `src/data/supabase/oauth-callback.ts` según la tabla de `contracts/auth-oauth.md` § 2 hasta que T018 pase
- [X] T022 [US2] Crear `src/features/auth/oauth-error.ts` (`parseOAuthError(value: string | null): OAuthErrorCode | null`) y `src/features/auth/OAuthErrorAlert.tsx` (cliente: `useSearchParams()` → mensaje en `role="alert"` → `router.replace("/")`) hasta que T019 pase
- [X] T023 [US2] Montar `OAuthErrorAlert` en `src/features/auth/Landing.tsx` dentro de un `<Suspense fallback={null}>` (research R5: la landing sigue prerenderizándose) encima del botón de Google, y hacer pasar T020

**Checkpoint**: US1 + US2 cumplen todos los requisitos de seguridad y mensajes.

---

## Phase 5: User Story 3 - La demo no cambia (Priority: P2)

**Goal**: sin botón de Google en la demo y `/auth/callback` sin Supabase.

**Independent Test**: `pnpm dev:demo` y build de demo con `pnpm check:demo-bundle` (quickstart, Escenario D).

- [X] T024 [P] [US3] Añadir a `tests/e2e/google-sign-in.spec.ts` pruebas del proyecto `demo`: ninguna pantalla de `APP_ROUTES` (`tests/e2e/app-routes.ts`) muestra "Continuar con Google"; `/auth/callback?code=x` termina en `/dashboard` sin peticiones a `*.supabase.co`
- [X] T025 [US3] Ejecutar `NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle` y corregir cualquier hallazgo (p. ej. un import estático de `@/data/supabase/oauth-callback` en `src/app/auth/callback/route.ts`) — nota: limpio (293 archivos). Los chunks de servidor del build demo incluyen supabase-js (código inalcanzable tras `env.isDemo`, igual que `proxy.ts`), sin URL ni clave; nunca llegan al navegador

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] Añadir a `docs/deploy.md` la sección "Inicio de sesión con Google" (configuración de Google Auth Platform y de Supabase según quickstart § Prerrequisitos, nota de que el secreto vive solo en Supabase y de que la app de Google queda en modo Testing) y un punto en la lista de verificación de seguridad: "La app de Google está en modo Testing con un único test user"
- [X] T027 [P] Mencionar el inicio de sesión con Google en `README.md` (sección de funcionalidades o modo personal)
- [x] T028 Ejecutar las puertas de calidad: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:contract:local`, `pnpm test:e2e:local` y `pnpm check:demo-bundle`, todas en verde
- [X] T029 Commit, push y merge a `main` (despliegue automático de los dos proyectos de Vercel); verificar en producción los Escenarios A–D de `specs/_archive/002-google-sign-in/quickstart.md` en EN y ES y marcar sus criterios de salida
  - 2026-11-05: código en `main` y desplegado en ambos proyectos. Verificado en producción sin sesión: Escenario C (`/auth/callback` sin código, con `code` inválido o con `next=https://example.com` → `/?authError=failed`; con `signup_disabled` → `/?authError=not_authorized`; nunca sale del origen), Escenario D (el demo no muestra botón de Google y `/auth/callback` vuelve al demo), la app personal muestra "Continue with Google", y en la nube `count(auth.users) = 1` con identidades `email` y `google`. Escenario A verificado por el dueño en producción (EN y ES); T017 cubierto por esa misma verificación.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003 (manuales, en orden). T004 y T005 son independientes.
- **Foundational (Phase 2)**: depende de nada del Setup salvo para la verificación manual; bloquea US1–US3.
- **US1 (Phase 3)**: tras Foundational. T017 requiere T001–T003.
- **US2 (Phase 4)**: tras T013 (amplía el mismo helper) y T016 (monta la alerta en la landing).
- **US3 (Phase 5)**: tras T014 (la ruta existe).
- **Polish (Phase 6)**: tras todas las historias.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Helper/servicio (`oauth-callback.ts`, `auth.ts`) → ruta → componentes → integración en la landing.

### Parallel Opportunities

- T004, T005, T007 y T009 en paralelo.
- T010 y T011 en paralelo; T015 en paralelo con T012–T014 (archivos distintos).
- T018, T019 y T020 en paralelo.
- T026 y T027 en paralelo.

## Parallel Example: User Story 1

```text
Task: "T010 Prueba de resolveCallback en tests/unit/data/oauth-callback.test.ts"
Task: "T011 Prueba de GoogleSignInButton en tests/unit/features/google-sign-in.test.tsx"
# luego
Task: "T012–T014 auth.ts → oauth-callback.ts → route.ts"
Task: "T015 GoogleSignInButton.tsx"
```

## Implementation Strategy

### MVP First

1. Setup (T001–T005), con el Escenario 0 en verde.
2. Foundational (T006–T009).
3. US1 (T010–T017) → **parar y validar**: el dueño entra con Google.
4. US2 en seguida: es P1 porque cierra la puerta de seguridad y da mensajes claros; no se despliega a producción
   sin ella.

### Incremental Delivery

US1 + US2 → US3 (verificación de la demo) → Polish y despliegue. Un único merge a `main` al final, porque
desplegar US1 sin US2 dejaría errores técnicos visibles.

## Notes

- [P] = archivos distintos, sin dependencias.
- No hay migraciones ni variables de entorno nuevas en Vercel.
- El paso por la pantalla real de Google no se automatiza (requiere credenciales); se verifica en T017 y T029.
