# Contract: Inicio de sesión con Google

## 1. `AuthPort.signInWithGoogle` (`src/data/provider.ts`)

```ts
/** Códigos públicos que la ruta de retorno pone en `/?authError=`. */
export type OAuthErrorCode = "not_authorized" | "failed";

export interface AuthPort {
  // …métodos existentes sin cambios (getSession, signIn, signOut, onChange)…

  /**
   * Inicia el flujo OAuth (PKCE) con Google y NAVEGA fuera de la app: la promesa solo se resuelve si el
   * navegador no llega a salir. `redirectTo` MUST ser `${window.location.origin}/auth/callback`.
   * Supabase: signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } }).
   * Demo: rechaza con DemoReadOnlyError("auth.signInWithGoogle").
   * Errores: OFFLINE / COLD_START / UNKNOWN según el mapeo existente (toProviderError).
   */
  signInWithGoogle(redirectTo: string): Promise<void>;
}
```

| Proveedor | Comportamiento |
|---|---|
| `SupabaseProvider` | Llama a `db.auth.signInWithOAuth` (el cliente redirige el navegador). Si devuelve `error`, lanza `toProviderError(error)`. |
| `MockProvider` | `denyWrite("auth.signInWithGoogle")` (nunca se invoca: la demo no tiene landing). |

## 2. Ruta `GET /auth/callback` (`src/app/auth/callback/route.ts`)

**Entrada** (query, la pone Supabase Auth): `code` en éxito; `error`, `error_code`, `error_description` en fallo.
Cualquier otro parámetro (`next`, `redirect_to`, …) se **ignora**.

**Salida**: siempre `307/303` al **mismo origen**; nunca renderiza HTML.

| Modo | Condición | Redirección | Efecto |
|---|---|---|---|
| demo | cualquiera | `/` (que lleva a `/dashboard`) | No importa `@supabase/*` |
| live | `error_code=signup_disabled` | `/?authError=not_authorized` | Sin sesión |
| live | `error` presente (otro código o sin código) | `/?authError=failed` | Sin sesión |
| live | `code` presente y `exchangeCodeForSession` OK | `/dashboard` | Cookies de sesión en la respuesta |
| live | `code` presente y el canje falla | `/?authError=failed` | Sin sesión |
| live | sin `code` ni `error`, con sesión válida | `/dashboard` | — |
| live | sin `code` ni `error`, sin sesión | `/?authError=failed` | — |

Implementación: `src/data/supabase/oauth-callback.ts` exporta
`handleOAuthCallback(request: NextRequest): Promise<NextResponse>`; la decisión de destino es una función pura
`resolveCallback(params, exchange)` testeable sin red.

## 3. Landing (`/`)

- Muestra "Continuar con Google" (EN: "Continue with Google") encima del formulario, separado por "o"/"or".
- Al pulsarlo: deshabilita el botón, muestra "Redirigiendo a Google…" y llama a
  `provider.auth.signInWithGoogle(`${origin}/auth/callback`)`. Si lanza (`OFFLINE`, `COLD_START`, otro), vuelve a
  habilitarse y muestra el mensaje común correspondiente.
- Con `?authError=not_authorized` → `auth.googleNotAuthorized`; con `?authError=failed` → `auth.googleFailed`;
  en un elemento `role="alert"`. Valores desconocidos se ignoran. Tras mostrarlo, la URL se limpia a `/`.

## 4. Claves i18n nuevas (namespace `auth`)

| Clave | EN | ES |
|---|---|---|
| `continueWithGoogle` | Continue with Google | Continuar con Google |
| `redirectingToGoogle` | Redirecting to Google… | Redirigiendo a Google… |
| `or` | or | o |
| `googleNotAuthorized` | This Google account doesn't have access to this app. | Esta cuenta de Google no tiene acceso a esta app. |
| `googleFailed` | Couldn't sign in with Google. Please try again. | No se pudo iniciar sesión con Google. Inténtalo de nuevo. |
