# Research: Inicio de sesión con Google

## R1 · Vinculación con la cuenta existente estando el registro desactivado

- **Decision**: confiar en la **vinculación automática** de Supabase Auth (identidades con el mismo correo
  verificado se vinculan al mismo usuario) y validarla con una prueba manual antes de implementar (quickstart,
  escenario 0).
- **Rationale**: la documentación de Supabase indica que "Supabase Auth automatically links identities with the
  same email address to a single user" y que, al entrar con OAuth, busca un usuario existente con ese correo. El
  usuario del dueño tiene correo confirmado e igual a su Gmail (verificado en `auth.users` el 2026-11-03), y
  Google entrega correos verificados. `disable_signup` solo bloquea la **creación** de usuarios.
- **Alternatives considered**: vinculación manual (`linkIdentity`) desde Configuración con la sesión de
  contraseña iniciada — requiere activar "Manual linking" (beta) y una pantalla extra; queda como **plan B** si
  la prueba falla. Activar el registro temporalmente — rechazado: abre una ventana en la que cualquiera podría
  crear cuenta.

## R2 · Flujo OAuth: PKCE con canje en el servidor

- **Decision**: `signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback,
  queryParams: { prompt: "select_account" } } })` desde el cliente de navegador de `@supabase/ssr` (que ya usa
  `flowType: "pkce"` y guarda el `code_verifier` en cookies), y canje con `exchangeCodeForSession(code)` en un
  Route Handler `GET /auth/callback` usando `createServerClient` con el mismo adaptador de cookies que
  `proxy-session.ts`.
- **Rationale**: es el patrón documentado por Supabase para Next.js con SSR; las cookies de sesión quedan
  escritas en la respuesta de redirección, así que el proxy ve la sesión desde la primera petición a
  `/dashboard`. PKCE protege contra la intercepción del código (FR-002).
- **Alternatives considered**: flujo implícito (tokens en el fragmento de la URL) — menos seguro y no llega al
  servidor; canje en el cliente — ver Complexity Tracking del plan; Google One Tap / Identity Services —
  fuera de alcance y requiere el script de Google en la página.

## R3 · Destino tras el inicio de sesión (open redirect)

- **Decision**: la ruta redirige **siempre** a `/dashboard` (éxito) o a `/` (error), construyendo la URL a
  partir de `request.nextUrl` (mismo origen); ignora cualquier parámetro `next`, `redirect_to`, etc.
- **Rationale**: FR-005/SC-004 sin necesidad de validar listas de destinos; la app tiene un único destino útil.
- **Alternatives considered**: aceptar `next` con validación de ruta relativa — más superficie para un beneficio
  nulo en una app de un solo usuario.

## R4 · Mapeo de errores

- **Decision**: la ruta traduce el resultado a un código público estable en `?authError=`:
  - `not_authorized` ← `error_code=signup_disabled` (cuenta de Google sin usuario asociado; Supabase Auth
    redirige a `redirectTo` con `error`, `error_code` y `error_description` en la query).
  - `failed` ← todo lo demás: `error=access_denied` sin código (cancelación en Google), `provider_disabled`,
    ausencia de `code`, y errores de `exchangeCodeForSession` (`bad_code_verifier`, `flow_state_expired`,
    `flow_state_not_found`, red/cold start).
  - Si ya hay sesión y no hay `code`, redirige a `/dashboard` (edge case "ya tiene sesión").
- **Rationale**: FR-006 pide distinguir al menos "no autorizado" de "genérico"; `error_description` nunca se
  propaga (Principio V, sin detalles técnicos). Los códigos vienen de `@supabase/auth-js` 2.118
  (`lib/error-codes.d.ts`).
- **Alternatives considered**: reenviar `error_description` — expone textos técnicos en inglés y rompe i18n.

## R5 · Mostrar el error en la landing con `cacheComponents`

- **Decision**: un componente cliente pequeño lee `?authError` con `useSearchParams()` dentro de un
  `<Suspense>` (la landing sigue prerenderizándose), valida el valor contra `OAuthErrorCode` (valores
  desconocidos → se ignoran) y, tras mostrarlo, limpia la query con `router.replace("/")` para que el mensaje no
  reaparezca al recargar.
- **Rationale**: es la recomendación de `node_modules/next/dist/docs/.../use-search-params.md` para rutas
  prerenderizadas (sin `Suspense` el build de producción falla).
- **Alternatives considered**: leer `searchParams` en `page.tsx` — vuelve dinámica toda la landing; usar
  `window.location` en un efecto — funciona pero esquiva las APIs del router.

## R6 · Visibilidad en la demo

- **Decision**: sin capacidad nueva en el `DataProvider`. La landing (y con ella el botón) solo existe en live:
  `src/app/page.tsx` ya hace `redirect("/dashboard")` en demo. El `MockProvider` implementa
  `signInWithGoogle` con `denyWrite` para cumplir el contrato. La ruta `/auth/callback` en demo redirige a `/`
  (que a su vez lleva a `/dashboard`) sin `import()` de Supabase.
- **Rationale**: FR-009 se cumple por construcción; añadir `capabilities.oauth` sería código muerto.
- **Alternatives considered**: `capabilities.signInWithGoogle: boolean` — redundante mientras la demo no tenga
  landing.

## R7 · Configuración externa

- **Decision**:
  - Google Auth Platform: Audience **External / Testing** con el dueño como único test user; scopes
    `openid`, `email`, `profile`; cliente **Web application** con origins
    `https://miguezpz-personal-finances.vercel.app` y `http://localhost:3000`, y redirect URI
    `https://potodtpkgadgsmeuuafx.supabase.co/auth/v1/callback`.
  - Supabase: proveedor Google activado con Client ID/Secret; *URL Configuration* → Site URL de producción y
    Redirect URLs `https://miguezpz-personal-finances.vercel.app/auth/callback` y
    `http://localhost:3000/auth/callback`; registro desactivado.
  - Local (`supabase/config.toml`): `/auth/callback` en `additional_redirect_urls` para los puertos de dev y e2e,
    y `[auth.external.google] enabled = false` con `client_id`/`secret` vía `env(...)`, documentado para quien
    quiera probarlo localmente.
- **Rationale**: modo Testing = segunda barrera (solo el dueño pasa la pantalla de Google) y sin verificación de
  Google; los tokens de refresco de Google caducan a los 7 días en Testing, pero la app no los usa (la sesión es
  de Supabase).
- **Alternatives considered**: publicar la app de Google ("In production") — requiere verificación de marca y no
  aporta nada a un solo usuario.

## R8 · Pruebas

- **Decision**: unit para el mapeo de errores de la ruta (helper puro que recibe la URL y un "exchanger"
  inyectable), para el botón (llama a `signInWithGoogle` con `${origin}/auth/callback`, deshabilita y muestra
  "Redirigiendo…") y para los mensajes EN/ES; contract para el mock; e2e live para botón visible y
  `/auth/callback?error=…&error_code=signup_disabled` → mensaje "no autorizado", y e2e demo para la redirección
  del callback. El paso real por Google se verifica a mano (quickstart) porque requiere credenciales reales.
- **Rationale**: cubre todo lo determinista sin automatizar credenciales de Google.
