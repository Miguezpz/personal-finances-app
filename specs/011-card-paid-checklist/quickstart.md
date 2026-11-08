# Quickstart: validar el spec 011

## Requisitos

- `pnpm install`.
- Para pgTAP y el contrato contra Supabase: Docker y `pnpm db:start`.

## 1. Pruebas automáticas

```bash
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                                   # dominio: credit, payment-sessions, legacy conversion, ledger, csv, i18n
E2E_MODES=demo pnpm test:e2e                # demo EN/ES: marcar → aviso de solo lectura, sesión visible, sin "Pagar"
pnpm db:start && pnpm db:reset && pnpm db:test   # pgTAP card-statement-marks (RLS, unicidad, conversión)
pnpm test:contract:local && pnpm test:e2e:local  # contrato mock/Supabase y flujos @live
NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle
```

## 2. Escenarios manuales (demo, `pnpm dev:demo`)

1. **Crédito**: arriba aparece "Sesión de pago" con una ventana de hasta 3 días y las dos tarjetas (data-model §6). Cada tarjeta muestra estado y "Ya la pagué"; ninguna muestra "Pagar".
2. Al tocar "Ya la pagué" aparece el aviso de solo lectura y nada cambia (FR-021).
3. **Dashboard**: si hoy está a 7 días o menos de la ventana, aparece "Próxima sesión de pago"; dentro de ella, "Hoy toca pagar tus tarjetas". Las tarjetas de la sesión no tienen alerta individual.
4. La hoja ＋ no tiene "Pagar tarjeta"; la tecla P no hace nada. Gastos y Bitácora no muestran pagos de tarjeta.
5. Se repite en ES.

## 3. Escenarios con datos (live, Supabase local)

1. Con una tarjeta con compras en un corte cerrado, "Ya la pagué" cambia el estado a "Pagado" al instante, la alerta del Dashboard desaparece y aparece el aviso con "Deshacer". Deshacer regresa a "Pendiente".
2. Al marcar, esperar 6 s y tocar "Desmarcar", el corte vuelve a pendiente o vencido.
3. Con un corte anterior sin marcar y el más reciente marcado, ambos aparecen pagados (FR-004).
4. Con compras posteriores al corte marcado, el siguiente corte solo las incluye (SC-002), y la deuda total en Patrimonio coincide con Crédito.
5. El disponible para gastar del Dashboard es idéntico antes y después de marcar (SC-006).

## 4. Conversión en la nube (con el dueño)

**Orden obligatorio: la migración va antes de subir el código que lee la tabla**, porque Vercel despliega cada push a `main`.

1. Ejecutar `supabase/queries/preview-card-marks.sql` en solo lectura contra el proyecto `potodtpkgadgsmeuuafx` (MCP `execute_sql` o el SQL editor) y mostrar la tabla tarjeta → corte que queda marcado.
2. Con la aprobación explícita del dueño:
   - aplicar el contenido de `0011_card_statement_marks.sql` (MCP `apply_migration` o `pnpm exec supabase db push`);
   - si se usó el MCP, renombrar en `supabase_migrations.schema_migrations` la versión de fecha a `0011`.
3. Verificar con SQL de solo lectura: la tabla existe con RLS, una política y las marcas esperadas.
4. En la app personal, verificar que los cortes liquidados aparecen "Pagado" y que ninguno cambió a Vencido (SC-004).

**Registro (2026-11-08)**: la revisión dio 0 pagos que convertir, así que la conversión no creó marcas. Se aplicó `0011` con aprobación del dueño y la versión se renombró a `0011`. El código ya estaba en `main` (orden invertido por error); producción no pudo leer la tabla desde ese push hasta que se aplicó la migración.
