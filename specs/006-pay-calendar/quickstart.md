# Quickstart: validar la quincena según el día real de pago

No hace falta Docker ni Supabase local: no hay migración.

## 1. Puertas

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

Pruebas unitarias clave (`tests/unit/domain/pay-calendar.test.ts`):
- Sábado → viernes; domingo → viernes; entre semana sin cambio.
- `2026-11-13` → quincena `2026-11-2`, rango 13–29 nov.
- `2026-10-31` y `2026-11-12` → `2026-11-1`, rango 30 oct – 12 nov.
- Día 31 en febrero y en meses de 30 días; cambio de año (31 dic 2026 → `2027-01-1`).
- Un ingreso `salary` recibido el 16 de nov y asignado a `2026-11-2` mueve el inicio al 16. Uno recibido a +8 días se ignora; uno de tipo `extra` también.
- `daysUntilNextPayday("2026-11-13")` es 0; `daysUntilNextPayday("2026-11-14")` es 16.

## 2. e2e en demo

```bash
pnpm test:e2e tests/e2e/us16-pay-calendar.spec.ts tests/e2e/us2-safe-to-spend.spec.ts tests/e2e/us3-recurring.spec.ts tests/e2e/us4-expenses.spec.ts tests/e2e/us1-income-split.spec.ts
```

`us16-pay-calendar` fija `page.clock` en el viernes 13 de nov de 2026, al mediodía en CDMX, y verifica en EN y ES:
1. El Dashboard muestra el rango 13–29 nov, la nota de pago adelantado y "payday today".
2. Al registrar un gasto rápido de Gustos, el disponible de Gustos baja ese monto.
3. Gastos en "quincena actual" lista el gasto de hoy y no los del 12 de nov.

## 3. Manual

- `pnpm dev:demo`: con la fecha real de hoy (13 nov 2026), el Dashboard muestra la quincena nueva.
- En la app personal, después del despliegue: el Dashboard muestra "13 nov – 29 nov" con el ingreso de hoy en Necesidades y Gustos, y los gastos de hoy salen de esa quincena.
