# Despliegue (costo cero)

Un mismo repositorio produce **dos despliegues en Vercel** y la app personal usa **un proyecto de
Supabase (plan gratuito)**. Supabase local (Docker) es solo para desarrollo y pruebas; nunca se corren
pruebas, semillas ni `db reset` contra la nube.

| Despliegue             | Dominio                                 | `NEXT_PUBLIC_DEMO_MODE` | Supabase  |
| ---------------------- | --------------------------------------- | ----------------------- | --------- |
| Personal (uso privado) | `miguezpz-personal-finances.vercel.app` | `false`                 | sí (nube) |
| Demo (portafolio)      | `personal-finances-demo.vercel.app`     | `true`                  | **no**    |

## 1. Supabase en la nube (una sola vez)

1. Crear el proyecto en [supabase.com](https://supabase.com) (plan Free) y anotar el _Project ref_.
2. Aplicar las migraciones del repositorio (`supabase/migrations/0001…0010`):

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push          # solo migraciones; no siembra datos
   ```

3. **Deshabilitar el registro de usuarios** en el panel: _Authentication → Sign In / Providers →
   "Allow new users to sign up"_ desactivado. (`supabase/config.toml` solo aplica a Supabase local.)
4. **Crear el único usuario**: _Authentication → Users → Add user_, con correo y contraseña
   larga y única (≥ 16 caracteres, de un gestor de contraseñas) y "Auto confirm user". Esa es tu
   cuenta; nadie más puede registrarse. Después de vincular Google, el proveedor Email se desactiva
   (§ 5, endurecimiento).
5. Copiar de _Project Settings → API_: la **URL del proyecto** y la **clave publicable**
   (`sb_publishable_…`). La clave secreta / `service_role` **nunca** va a Vercel ni al navegador.
6. Revisar los asesores de seguridad y rendimiento:

   ```bash
   pnpm exec supabase db advisors --linked --type all --level warn
   ```

   En local el resultado esperado es "No issues found" (la migración 0007 agrega los índices de las
   llaves foráneas compuestas).

### Inicio de sesión con Google (solo app personal)

El dueño puede entrar con su cuenta de Google además de su contraseña
([spec 002](../specs/_archive/002-google-sign-in/spec.md)). La identidad de Google se vincula sola a la cuenta
existente porque comparte el correo verificado; con el registro desactivado, cualquier otra cuenta de
Google es rechazada ("Esta cuenta de Google no tiene acceso a esta app") sin crear usuario.

1. **Google Auth Platform** ([console.cloud.google.com/auth](https://console.cloud.google.com/auth)):
   - _Audience_: **External**, en modo **Testing**, con tu Gmail como único _test user_ (así nadie más
     pasa la pantalla de Google y no hace falta la verificación de Google).
   - _Data Access_: solo `openid`, `email` y `profile`.
   - _Clients → Create client → Web application_:
     - Authorized JavaScript origins: `https://miguezpz-personal-finances.vercel.app` y
       `http://localhost:3000`.
     - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (el _Callback URL_
       que muestra Supabase en el paso siguiente).
2. **Supabase** → _Authentication → Sign In / Providers → Google_: activarlo y pegar el **Client ID** y
   el **Client Secret**. El secreto vive **solo** aquí: nunca en `.env*`, en Vercel ni en el repositorio.
3. **Supabase** → _Authentication → URL Configuration_:
   - Site URL: `https://miguezpz-personal-finances.vercel.app`.
   - Redirect URLs: `https://miguezpz-personal-finances.vercel.app/auth/callback` y
     `http://localhost:3000/auth/callback`.
   - "Allow new users to sign up" **sigue desactivado** (paso 1.3).
4. Primera vez: en la app, _Continuar con Google_ con tu cuenta. Comprueba en _Authentication → Users_
   que sigue habiendo **un** usuario y que ahora tiene los proveedores `email` y `google`.

No hay variables de entorno nuevas: el botón usa el mismo cliente de Supabase y la ruta
`/auth/callback` canjea el código PKCE en el servidor. En el demo no existe ni el botón ni el canje.

## 2. Vercel: dos proyectos del mismo repositorio

En Vercel, _Add New → Project_ e importar `personal-finances-app` **dos veces** (dos proyectos).
Framework: Next.js; comando de build por defecto (`pnpm build`); Node.js 22.

**Proyecto personal** — variables de entorno (Production):

| Variable                               | Valor                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEMO_MODE`                | `false`                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clave publicable                                                       |
| `NEXT_PUBLIC_DEMO_URL`                 | `https://personal-finances-demo.vercel.app` (botón "Explorar demo")    |
| `NEXT_PUBLIC_PASSWORD_SIGN_IN`         | `false` (oculta el formulario de contraseña: solo se entra con Google) |

**Proyecto demo** — solo:

| Variable                | Valor  |
| ----------------------- | ------ |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |

No definas variables de Supabase en el demo. Aunque estuvieran, el build de demo las descarta
(`src/lib/env.ts`) y CI lo comprueba con valores canario (`pnpm check:demo-bundle`).

Para verificar un build de demo en local:

```bash
NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle
```

## 3. Operación diaria

- **Cold start**: el plan gratuito de Supabase duerme la base de datos tras un tiempo sin uso; la app
  muestra "Despertando la base de datos…" y reintenta sola. Si el proyecto llega a **pausarse** por
  inactividad prolongada, reactívalo desde el panel de Supabase (_Restore project_).
- **Procesos automáticos** (sin cron): al abrir la app se aplican los gastos fijos vencidos, la
  aportación del mes de cada meta y la instantánea mensual de patrimonio. Son idempotentes: abrir la
  app en varias pestañas no duplica nada.
- **Nuevas migraciones**: después de agregar un archivo en `supabase/migrations`, probar en local
  (`pnpm db:reset && pnpm db:test && pnpm test:contract:local`) y luego `pnpm exec supabase db push`.
- **Migración 0011 (spec 011: "Ya la pagué")**: crea `card_statement_marks` con RLS forzado, la
  política de dueño y sin `update`. Agrega `private.legacy_statement_cut_off` y convierte cada
  `card_payments` existente en la marca del corte que pagaba. `card_payments` no se toca, pero la app
  deja de leerla. Antes de aplicarla se revisa la conversión en solo lectura con
  `supabase/queries/preview-card-marks.sql`. El frontend lee la tabla nueva, así que la migración va
  **antes** del despliegue. Aplicada en la nube el 2026-11-08 (0 pagos que convertir); el MCP la
  registró con versión de fecha y se renombró a `0011` en `supabase_migrations.schema_migrations`.
- **Migración 0012 (spec 011)**: quita UPDATE, TRUNCATE, REFERENCES y TRIGGER de `authenticated` en
  `card_statement_marks`, que Supabase había dado por defecto. Aplicada en la nube el 2026-11-08 (versión renombrada a `0012`).
- **Migración 0009 (spec 005: gastos rápidos)**: crea la tabla `expense_templates` con RLS
  forzado y la política de dueño. El frontend de la spec 005 lee esta tabla al cargar los datos,
  así que **la migración va antes del despliegue**: como Vercel despliega solo cada push a `main`,
  aplicarla antes de subir el código que la usa. Aplicada en la nube el 2026-11-05.
- **Migración 0008 (spec 004: tipos de ingreso, íconos y taxonomía por defecto)**: además de las
  columnas nuevas, rellena las cuentas que ya existen. A cada categoría activa cuyo nombre coincide
  exactamente con una por defecto le asigna su clave de traducción y su ícono, y agrega la categoría
  _Previous Balances_ (Needs). No toca subcategorías, categorías archivadas o renombradas, movimientos
  ni reglas; los ingresos existentes quedan con el tipo `other`. Aplicarla y **desplegar el frontend
  enseguida** (la versión anterior sigue funcionando entre ambos pasos). Verificar con SQL de solo
  lectura:

  ```sql
  select count(*) filter (where archived_at is null)                      as activas,
         count(*) filter (where name = 'Previous Balances')               as previous_balances, -- 1
         count(*) filter (where archived_at is null and icon is null)     as sin_icono,         -- 0
         count(*) filter (where archived_at is null and name_key is null) as sin_clave          -- 0
  from categories;
  select income_type, count(*) from incomes group by 1;                   -- todo en 'other'
  ```

  Una categoría propia (no por defecto) aparece en `sin_icono`/`sin_clave`: es lo esperado, se
  muestra con el ícono genérico y su nombre tal cual.

## 4. Respaldo

En _Configuración → Exportar datos_ (o en la Bitácora):

- **Bitácora (CSV)**: todos los movimientos, legible en Excel (UTF-8, montos en MXN).
- **Respaldo completo (ZIP)**: un CSV por tabla (cuentas, reglas, ingresos, asignaciones, gastos,
  fijos, tarjetas, terceros, metas, patrimonio, configuración) más la bitácora.

Se genera en el navegador, sin subir nada a ningún servidor. Recomendación: descargar el ZIP una vez
al mes y guardarlo fuera de la nube del proyecto. La app no tiene importación: el ZIP es un respaldo
legible para consultar o reconstruir datos manualmente.

## 5. Lista de verificación de seguridad

- [ ] Registro deshabilitado en el panel de Supabase (paso 1.3).
- [ ] En Vercel solo existe la clave **publicable**; ninguna variable contiene `service_role` ni `sb_secret_`.
- [ ] El proyecto demo no tiene variables de Supabase.
- [ ] `supabase db advisors --linked` sin avisos de nivel `warn` o superior, salvo
      `auth_leaked_password_protection`: la comprobación contra HaveIBeenPwned solo existe en el
      plan Pro de Supabase, y la app debe operar en Free (constitución, principio I). Deja de
      importar con el proveedor Email desactivado (abajo): no hay contraseña que filtrar.
- [ ] `.env.local` nunca se versiona (solo `.env.example`).
- [ ] La app de Google está en modo **Testing** con un único _test user_ (el dueño) y su Client Secret
      solo existe en el panel de Supabase.

### Endurecimiento (app personal)

Orden: primero confirma que entras con Google; luego cierra la puerta de la contraseña.

- [ ] Cuenta de Google del dueño con 2FA o passkey (es la única llave de la app).
- [ ] Supabase → _Authentication → Sign In / Providers → Email_: **desactivado**. Comprobar con
      `curl -s https://<project-ref>.supabase.co/auth/v1/settings -H "apikey: <clave publicable>"`
      → `"email": false`. Recuperación si se pierde Google: reactivar Email en el panel.
- [ ] Vercel (proyecto personal): `NEXT_PUBLIC_PASSWORD_SIGN_IN=false` y redeploy.
- [ ] Cerrar sesión en la app (cierra **todas** las sesiones: alcance global) y volver a entrar con Google.
- [ ] _Authentication → URL Configuration_: sin `localhost` en las Redirect URLs si el dev no usa la nube.
- [ ] _Database → Settings_: **Enforce SSL** activado y **Network restrictions** cerradas (abrir solo
      tu IP, temporalmente, para `supabase db push`). No afecta a la API REST que usa la app.
- [ ] _Settings → API Keys_: con la app usando `sb_publishable_…`, **desactivar las claves JWT legacy**
      (`anon` / `service_role`).
- [ ] 2FA en las cuentas de Supabase, Vercel y GitHub (tienen acceso total: service role, variables,
      código). Deployment Protection activa para los previews de Vercel.
- [ ] Headers: `curl -sI https://miguezpz-personal-finances.vercel.app/` muestra
      `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options`, `referrer-policy`,
      `permissions-policy` y `x-robots-tag` (definidos en `src/lib/security-headers.ts`).
