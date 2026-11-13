# Quickstart: validar Ahorrado de la quincena

## 1. Puertas

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
pnpm test:contract:local     # mock + Supabase local (Docker)
pnpm db:test                 # pgTAP, incluye save-surplus.test.sql
```

Pruebas unitarias clave (`tests/unit/domain/safe-to-spend.test.ts`):
- Con el ajuste encendido, un sobrante de $400 en Gustos da `carryIn = 0` y `saved.lastPeriod = 400`.
- Un faltante de −$400 se sigue arrastrando y no suma a Ahorrado.
- Buckets mixtos (Necesidades −$100, Gustos +$300) dan `saved.lastPeriod = 300` y `needs.carryIn = −100`.
- Tres quincenas con sobrantes de $100, $200 y $300 dan `total = 600` y `lastPeriod = 300`.
- Con el ajuste apagado, `saved` es `null` y los casos existentes no cambian.
- El caso del dueño del 13 nov 2026 da Necesidades $2,442.87, Gustos $1,470.93 y Ahorrado de la quincena pasada $2,327.90.
- `net-worth.test.ts`: el patrimonio es igual con el ajuste encendido y apagado.

## 2. e2e

```bash
E2E_MODES=demo pnpm test:e2e tests/e2e/us17-save-surplus.spec.ts tests/e2e/us2-safe-to-spend.spec.ts tests/e2e/matrix.spec.ts
pnpm test:e2e:local tests/e2e/us17-save-surplus.spec.ts   # live
```

- **Demo**:
  - `saved-card` es visible en EN y ES; con el modo privacidad, sus montos están enmascarados.
  - Cambiar el `Switch` en Preferencias y guardar muestra el aviso de solo lectura.
- **Live**:
  - Se siembra una quincena pasada con sobrante en Gustos.
  - Al encender el ajuste y guardar, sin recargar, el arrastre de Gustos pasa a $0 y `saved-last` muestra el sobrante.
  - Al apagarlo, la tarjeta desaparece.

## 3. Nube y manual

1. Aplicar `0013` al proyecto de la nube, **con confirmación del dueño**, y corregir la versión en `list_migrations`.
2. Hacer push y revisar el CI.
3. En la app personal: Preferencias → encender "Guardar el sobrante de cada quincena" → el Dashboard muestra Necesidades $2,442.87, Gustos $1,470.93 y Ahorrado $2,327.90. Las cifras cambian si registraste movimientos después del 13 nov.
