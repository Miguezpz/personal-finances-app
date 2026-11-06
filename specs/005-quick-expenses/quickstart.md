# Quickstart: validar spec 005

## Prerrequisitos

- Docker en marcha y Supabase local con `pnpm db:start`, porque esta feature agrega la tabla `expense_templates`.
- Nunca correr pruebas, seeds ni `db reset` contra la nube.

## 1. Puertas automáticas

```bash
pnpm typecheck && pnpm lint && pnpm test   # unitarias: quick-expenses, esquema, CSV, paridad i18n, seed
pnpm db:reset                               # aplica 0001…0009 en local
pnpm db:types                               # regenera database.types.ts con expense_templates
pnpm db:test                                # pgTAP: RLS, cascade, checks y FK (contracts/data-provider.md)
pnpm test:contract:local                    # contrato mock + Supabase (T1–T9)
pnpm test:e2e:local                         # us13 live + demo, EN/ES, a11y
pnpm check:demo-bundle                      # aislamiento del demo
```

## 2. Escenarios manuales (local, `pnpm dev`)

| # | Escenario | Resultado esperado |
|---|---|---|
| A | Dashboard sin plantillas | Enlace "Crear gasto rápido" que lleva a Gastos › Gastos rápidos |
| B | Crear "Transporte · $24 · Public transport" | Aparece en la sección y como botón en el Dashboard |
| C | Tocar "Transporte $24" en el Dashboard | El disponible de Needs baja $24 al instante; aviso con Deshacer; el gasto aparece en Gastos con fecha de hoy y nota "Transporte" |
| D | Tocar Deshacer | El gasto desaparece y el disponible vuelve exactamente al valor previo |
| E | Tocar dos veces seguidas | Dos gastos; el Deshacer del segundo aviso solo borra el segundo |
| F | Editar el monto a $30 y tocar | El gasto nuevo es de $30; el anterior sigue en $24 |
| F1 | Menú "⋯" › Ayer | Gasto de $24 con fecha de ayer; aviso con Deshacer |
| F2 | Menú "⋯" › Registrar con otro monto o fecha: $12, hoy | Gasto de $12 hoy; la plantilla sigue en $24; una fecha futura no se acepta |
| F3 | Celular (390 px), en Metas: botón flotante › tocar "Transporte $24" arriba del formulario | Gasto registrado, el diálogo se cierra, aviso con Deshacer |
| F4 | Editar un gasto existente | El diálogo de edición no muestra la fila de gastos rápidos |
| G | Subir y bajar dos plantillas | El Dashboard respeta el orden |
| H | Borrar la plantilla | Desaparece del Dashboard; los gastos ya creados siguen |
| I | Archivar la subcategoría de una plantilla | Su botón queda deshabilitado con el motivo |
| J | Nuevo gasto con "Guardar como gasto rápido" | Se crean el gasto y la plantilla (nombre = nota, o el de la subcategoría) |
| K | Modo privacidad | Los montos de los botones se ocultan; los nombres no |
| L | Pantalla de 360 px con varias plantillas | La fila se desplaza sola; la página no tiene scroll horizontal |
| M | Exportar datos | El ZIP incluye `expense_templates.csv` |
| N | Cambiar el idioma a ES y a EN | Todos los textos nuevos traducidos |

## 3. Demo (`pnpm dev:demo`)

- El Dashboard muestra "Transporte $24". Al tocarlo sale el aviso de solo lectura y el disponible no cambia.
- Crear, editar, reordenar o borrar plantillas en Gastos también muestra el aviso de solo lectura.

## 4. Nube (solo con aprobación del usuario)

1. Aplicar `0009_expense_templates.sql` al proyecto `potodtpkgadgsmeuuafx`.
2. Revisar los advisors de seguridad: sin tablas sin RLS.
3. Desplegar el frontend desde git justo después. La app anterior no lee la tabla nueva, así que el orden migración → despliegue es seguro.
