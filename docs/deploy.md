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
2. Aplicar las migraciones del repositorio (`supabase/migrations/0001…0007`):

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push          # solo migraciones; no siembra datos
   ```

3. **Deshabilitar el registro de usuarios** en el panel: _Authentication → Sign In / Providers →
   "Allow new users to sign up"_ desactivado. (`supabase/config.toml` solo aplica a Supabase local.)
4. **Crear el único usuario**: _Authentication → Users → Add user_, con correo y contraseña
   (≥ 8 caracteres) y "Auto confirm user". Esa es tu cuenta; nadie más puede registrarse.
5. Copiar de _Project Settings → API_: la **URL del proyecto** y la **clave publicable**
   (`sb_publishable_…`). La clave secreta / `service_role` **nunca** va a Vercel ni al navegador.
6. Revisar los asesores de seguridad y rendimiento:

   ```bash
   pnpm exec supabase db advisors --linked --type all --level warn
   ```

   En local el resultado esperado es "No issues found" (la migración 0007 agrega los índices de las
   llaves foráneas compuestas).

## 2. Vercel: dos proyectos del mismo repositorio

En Vercel, _Add New → Project_ e importar `personal-finances-app` **dos veces** (dos proyectos).
Framework: Next.js; comando de build por defecto (`pnpm build`); Node.js 22.

**Proyecto personal** — variables de entorno (Production):

| Variable                               | Valor                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEMO_MODE`                | `false`                                                             |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clave publicable                                                    |
| `NEXT_PUBLIC_DEMO_URL`                 | `https://personal-finances-demo.vercel.app` (botón "Explorar demo") |

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
- [ ] `supabase db advisors --linked` sin avisos de nivel `warn` o superior.
- [ ] `.env.local` nunca se versiona (solo `.env.example`).
