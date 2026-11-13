# Data Model: Quincena según el día real de pago

No hay cambios en la base de datos ni en el snapshot. Solo cambian tipos de dominio derivados.

## Period (modificado, `src/domain/types.ts`)

| Campo | Tipo | Significado |
| ----- | ---- | ----------- |
| `key` | `PeriodKey` | `YYYY-MM-1\|2`. Identificador, sin cambios. |
| `start` | `IsoDate` | Inicio nominal (día 1 o 16). Identificador de asignaciones y aportaciones. |
| `end` | `IsoDate` | Fin nominal (día 15 o último del mes). |
| `half` | `1 \| 2` | Sin cambios. |
| `from` | `IsoDate` | **Nuevo.** Inicio efectivo: día de pago movido o corregido. Por defecto es `start`. |
| `to` | `IsoDate` | **Nuevo.** Fin efectivo: el día anterior al `from` de la siguiente quincena. Por defecto es `end`. |

Invariantes con calendario:
- `p.to = addDays(next(p).from, −1)`.
- Los rangos de quincenas consecutivas no se enciman ni dejan huecos.
- `from − start` está en [−7−2, +7] días para la configuración por defecto: el viernes anterior más el margen de la corrección.

## PayCalendar (nuevo, derivado, `src/domain/pay-calendar.ts`)

| Campo | Tipo | Significado |
| ----- | ---- | ----------- |
| `settings` | `Pick<UserSettings, "firstPayday" \| "secondPayday">` | Días de pago de Preferencias. |
| `overrides` | `ReadonlyMap<PeriodKey, IsoDate>` | Inicio corregido por quincena. Solo incluye correcciones válidas (R3). |

Origen de `overrides`: `incomes` con `incomeType === "salary"`, agrupados por `periodOf(fundedPeriodStart).key`. Por cada quincena se toma el `receivedOn` más temprano, siempre que quede a ±7 días del esperado y entre los inicios esperados de las quincenas vecinas.

## Fechas de ejemplo (configuración por defecto: 15 y 31)

| Quincena | Nominal | Efectiva | Por qué |
| -------- | ------- | -------- | ------- |
| `2026-11-1` | 1–15 nov | 30 oct – 12 nov | El 31 de oct es sábado, así que el pago fue el viernes 30. |
| `2026-11-2` | 16–30 nov | 13 – 29 nov | El 15 de nov es domingo, así que el pago es el viernes 13. El 30 es lunes. |
| `2026-12-1` | 1–15 dic | 30 nov – 14 dic | El 30 de nov es lunes. El 15 de dic es martes. |
| `2027-01-1` | 1–15 ene | 31 dic – 14 ene | El 31 de dic de 2026 es jueves. |
