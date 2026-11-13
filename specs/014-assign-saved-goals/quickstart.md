# Quickstart: validar "Usar lo Ahorrado en metas"

## Prerrequisitos

- `npm install`.
- Pruebas de base de datos y contrato Supabase: Supabase local (Docker) solo para pruebas.
- Las e2e de demo no necesitan Supabase.

## Puertas

```bash
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                                 # Vitest: dominio, esquemas, i18n
pnpm build
pnpm db:reset && pnpm db:types            # aplica 0014 en local y regenera database.types.ts
pnpm db:test                              # pgTAP, incluye assign-saved-goals.test.sql
pnpm test:contract:local                  # contrato mock + Supabase local
pnpm exec playwright test us18-assign-saved   # demo; @live con el entorno live
```

## Escenarios

Referencias: fórmulas en [data-model.md](data-model.md), API en [contracts/](contracts/).

| # | Dónde | Pasos | Esperado |
| - | ----- | ----- | -------- |
| 1 | live, ajuste encendido | Dashboard → Ahorrado → Asignar → meta → $1,000 → confirmar | "Disponible" baja $1,000 sin recargar; la meta sube $1,000; STS y patrimonio iguales (US1) |
| 2 | live | Asignar más que lo disponible | error con el máximo; nada se guarda (US1-3) |
| 3 | live | Metas → nueva Compra "Laptop", $25,000, 2027-03 → asignar $5,000 | 20%, "$5,000 de $25,000", "mar 2027" (US2) |
| 4 | live | Regresar $2,000 de "Laptop"; luego intentar $4,000 | queda $3,000; el segundo se rechaza con el máximo (US3) |
| 5 | live | "Lo compré" en "Laptop" | pasa a archivadas con "Cumplida"; "Disponible" no sube; patrimonio baja $3,000; restaurar lo revierte (US4) |
| 6 | live | Asignar $1,000 al Fondo de emergencia | su avance sube $1,000; "Regresar" solo permite hasta $1,000 (US5) |
| 7 | live | Apagar "Guardar el sobrante" | sin tarjeta ni botones Asignar; el avance de las metas conserva lo asignado |
| 8 | demo, EN y ES | Metas y Dashboard | Compra de ejemplo con barra; "Disponible para asignar" > $0; Asignar/Regresar/Lo compré ⇒ toast de solo lectura (US6) |
| 9 | ambos | modo privacidad | "Disponible", avance y objetivo enmascarados (FR-015) |

## Nube

1. Con confirmación del dueño: aplicar `0014` con el MCP de Supabase.
2. `list_migrations` → corregir la versión a `0014`.
3. Push del código.
4. Escenarios 1–7 en producción.
