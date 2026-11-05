# Quickstart: validar el inicio de sesión con Google

Referencias: [contrato](./contracts/auth-oauth.md) · [modelo](./data-model.md) · configuración externa en
`docs/deploy.md` ("Inicio de sesión con Google").

## Prerrequisitos (una vez, los hace el dueño)

1. **Google Auth Platform** (console.cloud.google.com/auth): Audience *External* en modo *Testing* con tu Gmail
   como test user; scopes `openid`, `email`, `profile`; cliente *Web application* con:
   - Authorized JavaScript origins: `https://miguezpz-personal-finances.vercel.app`, `http://localhost:3000`
   - Authorized redirect URI: `https://potodtpkgadgsmeuuafx.supabase.co/auth/v1/callback`
2. **Supabase** → *Authentication → Sign In / Providers → Google*: activado, con Client ID y Client Secret.
   *URL Configuration*: Site URL `https://miguezpz-personal-finances.vercel.app`; Redirect URLs
   `https://miguezpz-personal-finances.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`.
   "Allow new users to sign up" **sigue desactivado**.

## Escenario 0 · Prueba de vinculación (antes de implementar)

Valida la suposición R1 sin código de la app.

1. Abrir en el navegador:
   `https://potodtpkgadgsmeuuafx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://miguezpz-personal-finances.vercel.app`
2. Elegir la cuenta de Google del dueño.
3. Comprobar en SQL: el usuario del dueño tiene identidades `email` y `google`, y `count(auth.users) = 1`.

**Esperado**: identidad `google` vinculada al mismo `user_id`. Si Supabase responde `signup_disabled`, pasar al
plan B (vinculación manual, ver research R1) antes de continuar.

## Escenario A · Live, dueño (US1)

```bash
pnpm dev            # .env.local apunta a Supabase en la nube
```

1. En `http://localhost:3000`, pulsar **Continuar con Google** → elegir la cuenta del dueño.
2. **Esperado**: aterriza en `/dashboard` con los mismos datos que con contraseña; recargar mantiene la sesión;
   *Cerrar sesión* vuelve a `/` y `/dashboard` redirige a `/`.
3. Repetir en producción (`https://miguezpz-personal-finances.vercel.app`), en EN y ES.

## Escenario B · Otra cuenta de Google (US2)

1. Con una cuenta de Google distinta (si la app está en Testing, Google la bloquea antes; para probar la barrera
   de Supabase, agrégala temporalmente como test user).
2. **Esperado**: vuelve a `/` con "Esta cuenta de Google no tiene acceso a esta app." y `count(auth.users) = 1`.
3. Cancelar en la pantalla de Google → "No se pudo iniciar sesión con Google. Inténtalo de nuevo."

## Escenario C · Ruta de retorno y open redirect

| URL | Esperado |
|---|---|
| `/auth/callback` (sin sesión) | `/` con mensaje genérico |
| `/auth/callback?error=access_denied&error_code=signup_disabled` | `/` con "no tiene acceso" |
| `/auth/callback?code=invalido` | `/` con mensaje genérico |
| `/auth/callback?next=https://example.com` | nunca sale del origen de la app |

## Escenario D · Demo (US3)

```bash
pnpm dev:demo
NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle
```

**Esperado**: no hay botón de Google en ninguna pantalla; `/auth/callback` termina en `/dashboard`;
`check:demo-bundle` sin hallazgos.

## Puertas de calidad

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e:local && pnpm check:demo-bundle
```

## Criterios de salida

- [X] Escenario 0 confirma la vinculación automática
- [X] A en producción, EN y ES (verificado por el dueño, 2026-11-05; no se repitió en local)
- [ ] B: mensaje "no autorizado" y cero usuarios nuevos — no probado con otra cuenta real (la app de Google está en Testing y la bloquea antes); el mensaje está cubierto por C y por las e2e, y en la nube `count(auth.users) = 1`
- [X] C: todas las filas
- [X] D: demo intacta y bundle limpio
- [X] Puertas de calidad en verde
