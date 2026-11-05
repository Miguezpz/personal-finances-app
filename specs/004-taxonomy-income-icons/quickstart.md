# Quickstart: validar spec 004

## Prerrequisitos

- Docker en marcha y Supabase local: `pnpm db:start` (esta feature cambia el esquema).
- Nunca correr pruebas, seeds ni `db reset` contra la nube.
- Medir el peso antes de empezar, para comparar: `pnpm build && node scripts/measure-first-load.mjs` (anotar `/` y `/dashboard`).
  - Línea base (T001, 2026-11-05, antes de la feature): `/` 297.7 kB gzip (19 scripts); `/dashboard` 337.5 kB gzip (23 scripts).

## 1. Puertas automáticas

```bash
pnpm typecheck && pnpm lint && pnpm test           # unitarias: taxonomía, íconos, CSV, esquemas, paridad i18n, seed
pnpm db:reset                                       # aplica 0001…0008 en local
pnpm db:test                                        # pgTAP: columnas, enum, RPCs, apply_taxonomy_004
pnpm test:contract:local                           # contrato mock + Supabase (data-provider.md C1–C8)
pnpm test:e2e:local                                # normal + demo, EN/ES, a11y claro/oscuro
pnpm check:demo-bundle                             # aislamiento del demo
pnpm build && node scripts/measure-first-load.mjs  # SC-005: < 5 KB gzip extra en / y /dashboard
```

## 2. Escenarios manuales (local, `pnpm dev`)

| # | Escenario | Resultado esperado |
|---|---|---|
| A | Cuenta local nueva: entrar por primera vez y abrir Ajustes › Taxonomía | 26 categorías (13 Needs, 13 Wants) con ícono; subcategorías en inglés; nombres de categoría en el idioma activo |
| B | Registrar un ingreso sin tocar el tipo y pulsar Guardar | No se guarda; aparece "Elige un tipo de ingreso" junto al campo |
| C | Con la etiqueta vacía, elegir "Salario" | La etiqueta se rellena con "Salario"; se puede cambiar; al guardar, la lista muestra ícono y tipo |
| D | Editar el ingreso y cambiar el tipo a "Regalo" | Se guarda; el reparto y los montos no cambian |
| E | Exportar datos | `incomes.csv` tiene `income_type`; `categories.csv` y `subcategories.csv` tienen `icon` |
| F | Taxonomía: cambiar el ícono de "Streaming"; dar ícono propio a "Video streaming" y luego quitarlo | Gastos, ledger y recurrentes muestran el nuevo ícono; la subcategoría muestra el suyo y, al quitarlo, el de la categoría |
| G | Crear una categoría propia sin ícono | Se muestra el ícono genérico |
| H | Registrar un gasto en Previous Balances | Se descuenta de Needs en el Safe-to-Spend de la quincena actual |
| I | Recorrer las páginas con lector de pantalla (VoiceOver) en EN y ES | Solo se anuncian textos; los íconos no |
| J | Páginas sin datos y encabezados, en claro y oscuro | Mismo estado vacío con ícono en las 8 páginas; títulos con el ícono de la navegación |

## 3. Demo

`E2E_MODES=demo pnpm test:e2e` y una revisión a mano con `NEXT_PUBLIC_DEMO_MODE=true pnpm dev`:
- 26 categorías con íconos; ingresos de ejemplo con tipo ("Salary" → Salario, "Freelance project" → Extra).
- Cambiar un ícono o un tipo muestra el aviso de solo lectura.

## 4. Nube (solo con aprobación expresa del dueño)

1. Aplicar `0008` a `potodtpkgadgsmeuuafx` con versión `0008`, una sola migración.
2. Verificar con SQL de solo lectura:

```sql
select count(*) filter (where archived_at is null)                  as activas,          -- 26
       count(*) filter (where name = 'Previous Balances')           as previous_balances, -- 1
       count(*) filter (where archived_at is null and icon is null) as sin_icono,         -- 0
       count(*) filter (where archived_at is null and name_key is null) as sin_clave      -- 0
from categories;
select income_type, count(*) from incomes group by 1;               -- todo en 'other'
```

3. Comparar con los totales anotados antes de aplicar (gastos, ingresos, saldos): idénticos (SC-002).
4. Desplegar el frontend (`main` → Vercel) y repetir los escenarios B–F en producción.

## Criterios de salida

- [ ] Puertas automáticas en verde
- [ ] Escenarios A–J verificados en EN y ES
- [ ] Demo verificado
- [ ] `0008` aplicada a la nube y consultas de verificación correctas
- [ ] Peso de primera carga dentro de SC-005
