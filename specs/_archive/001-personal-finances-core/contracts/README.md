# Contratos

Esta aplicación no expone una API pública: sus "interfaces" son el esquema de base de datos, los tipos del dominio, el motor de cálculo,
la abstracción de datos y los stores de UI. Los archivos de esta carpeta son contratos de diseño; al implementar se copian a `src/` y `supabase/migrations/`.

| Archivo | Destino en el repo | Qué fija |
|---------|--------------------|----------|
| [db-schema.sql](./db-schema.sql) | `supabase/migrations/*.sql` | Tablas, FKs compuestas, invariantes, RPC transaccionales, vista de bitácora y políticas RLS |
| [domain-types.ts](./domain-types.ts) | `src/domain/types.ts` | Tipos con marca (`Cents`, `BasisPoints`, `IsoDate`, `PeriodKey`) y entidades |
| [domain-engine.ts](./domain-engine.ts) | `src/domain/*.ts` | Firmas del motor puro: reparto, quincenas, fijos, Safe-to-Spend, MSI, crédito, FX, CSV |
| [data-provider.ts](./data-provider.ts) | `src/data/provider.ts` | `DataProvider`, repositorios, errores tipados y suite de contrato Mock/Supabase |
| [ui-store.ts](./ui-store.ts) | `src/store/*.ts` | Stores de Zustand (preferencias persistidas, UI efímera) y contrato de `<Money>` |

**Reglas transversales**

1. Un monto es siempre `Cents` (entero MXN); la conversión de divisa ocurre solo al renderizar con `<Money>`.
2. El dominio no importa React, Supabase ni `Date.now()`; el "hoy" se inyecta.
3. Solo `src/data/supabase/**` importa `@supabase/*`.
4. Toda escritura multi-tabla pasa por una RPC atómica; la BD valida invariantes pero no calcula.
5. Mock y Supabase deben pasar la misma suite de contrato en lecturas; en Mock toda escritura lanza `DemoReadOnlyError`.
6. La UI y los hooks consultan `provider.capabilities.canWrite`, nunca el tipo de proveedor; los procesos automáticos en segundo plano no se ejecutan (ni avisan) cuando es `false`.
7. Todo dato de dominio se lee de `useFinanceSnapshot` y se modifica con `updateSnapshot` (research.md R17).
