# Quickstart: validar el spec 008

Solo UI: **no** levantar Docker ni Supabase local. Las verificaciones live se omiten por decisión del usuario.

## Puertas automáticas

```bash
pnpm typecheck && pnpm lint && pnpm test
E2E_MODES=demo pnpm test:e2e
pnpm build
NEXT_PUBLIC_DEMO_MODE=true NEXT_DIST_DIR=.next-demo-check pnpm build && NEXT_DIST_DIR=.next-demo-check pnpm check:demo-bundle
```

Compara el First Load de `/dashboard` en la salida de `pnpm build` con la línea base registrada en `tasks.md` (≤ +20 kB).

## Escenarios manuales (demo: `pnpm dev:demo`)

| # | Ancho | Pasos | Esperado |
|---|---|---|---|
| A | 390 px | Ver la barra inferior | Inicio · Gastos · ＋ · Crédito · Más; sin botón flotante |
| B | 390 px | Más → Metas | Panel inferior "Más" agrupado; en Metas, "Más" está activo |
| C | 390 px | ＋ → Ingreso | Hoja ＋ con 3 acciones y gastos rápidos; se abre el diálogo de ingreso |
| D | 1440 × 650 | Barra lateral | Grupos con encabezados, Configuración al fondo, scroll propio |
| E | 1440 px | Pulsar `P` en Patrimonio | Diálogo de pago de tarjeta; en un input, `P` escribe |
| F | 1440 px | "＋ Nuevo" | Menú Gasto/Ingreso/Pagar tarjeta con N/I/P; es el único botón destacado |
| G | ambos | Crédito y Gastos | Mismo estado, monto y fecha por tarjeta; "Pagar" precarga tarjeta y monto |
| H | ambos | Configuración → Reglas | Icono + título; "‹ Configuración" |
| I | 390 px | Abrir el panel de la barra superior | Se titula "Apariencia" |
| J | 390 px | Dashboard con sobregiro (demo) | Franja de alertas arriba, tocable |
| K | ambos | Modo privacidad | Todos los montos nuevos enmascarados |
