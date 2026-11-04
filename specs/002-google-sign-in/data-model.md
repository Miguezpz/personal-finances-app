# Data Model: Inicio de sesión con Google

**Sin cambios en el esquema `public` ni migraciones nuevas.** Las tablas financieras siguen ligadas a
`auth.users.id` mediante `user_id` y RLS; como la identidad de Google se vincula al mismo usuario, todas las
políticas existentes aplican sin cambios.

## Entidades (administradas por Supabase Auth)

| Entidad | Dónde vive | Cambio | Reglas |
|---|---|---|---|
| Usuario del dueño | `auth.users` (1 fila) | Ninguno; conserva su `id` | Correo confirmado = Gmail del dueño. El registro está desactivado: no se crean filas nuevas. |
| Identidad `email` | `auth.identities` (provider `email`) | Ninguno | Respaldo: el inicio de sesión con contraseña sigue igual. |
| Identidad `google` | `auth.identities` (provider `google`) | **Nueva fila** la primera vez que el dueño entra con Google | `user_id` = id del dueño; `identity_data.email` = Gmail del dueño. Debe existir exactamente una. |
| Sesión | Cookies `sb-<ref>-auth-token*` (`@supabase/ssr`) | Mismo formato para ambos métodos | Persiste entre recargas; `proxy.ts` la refresca; `signOut` la elimina. |
| Verificador PKCE | Cookie `sb-<ref>-auth-token-code-verifier` | Transitoria | Se crea al pulsar el botón y se consume en `/auth/callback`; caduca si el flujo no se completa. |

## Tipos de la app

- `AuthSession` (sin cambios): `{ userId, email }` — una sesión de Google produce el mismo `userId`.
- `OAuthErrorCode` (nuevo, público): `"not_authorized" | "failed"`. Es el único valor que viaja en la URL
  (`/?authError=`); cualquier otro valor se ignora en la UI.

## Transiciones

```text
Sin sesión ──(botón)──▶ Google ──(cuenta del dueño)──▶ /auth/callback ──(canje OK)──▶ /dashboard (sesión)
                                  └─(otra cuenta)──▶ /auth/callback?error_code=signup_disabled ──▶ /?authError=not_authorized
                                  └─(cancelar/error)─▶ /auth/callback?error=… ──▶ /?authError=failed
/auth/callback sin code ──▶ con sesión: /dashboard · sin sesión: /?authError=failed
```

## Invariantes a verificar (quickstart)

1. `count(auth.users) = 1` antes y después de un intento con otra cuenta de Google.
2. Tras el primer acceso con Google: el dueño tiene identidades `{email, google}` y el mismo `user_id`.
