# Plan de mejora UX/UI — móvil y desktop

## Contexto

Revisé la app en código (shell, 11 features, sistema de motion) y en vivo (demo en 1440 px y 400 px). La base es sólida: tokens, sheets responsivos, optimistic updates, objetivos táctiles de 44 px y reduced-motion. Los problemas están en tres frentes:

1. **Arquitectura de navegación**
   - 10 destinos sin agrupar. En móvil, 6 de ellos (incluida Configuración) quedan en un panel lateral izquierdo que se abre desde la barra inferior y nunca se marca como activo.
   - Registrar un ingreso o pagar una tarjeta solo se puede desde su página.
   - El FAB tapa montos y se esconde al hacer scroll.
2. **Flujos con fricción**
   - Ningún formulario recuerda la última cuenta o categoría usada.
   - El diálogo se cierra antes de guardar, así que si falla se pierde lo que escribiste.
   - Fuera del Dashboard no hay estado de error: el skeleton se queda para siempre.
   - Solo los gastos rápidos se pueden deshacer.
   - Crédito es de solo lectura (no tiene botón de pagar).
   - Expenses y Crédito muestran "Pagar para no generar intereses" de estados de cuenta distintos: Gold Card aparece con $0.00 (vence 30 oct) en un lado y $13,190.50 (vence 30 nov) en el otro.
3. **Motion incompleto**
   - Las altas y bajas de filas no se animan.
   - El paso de skeleton a contenido es un corte seco.
   - No hay transición de salida entre rutas ni retroalimentación al guardar.

Decisiones tomadas:

- **Navegación:** barra con ＋ central.
- **Animaciones:** respetar spec 003 (solo CSS y View Transitions nativas, ≤300 ms, nunca animar montos, sin framer-motion fuera del indicador de nav).
- **Entrega:** un spec por fase, siguiendo speckit, en `main` y con commit + push por paso.

Numeración: el 006 está reservado (calendario de pago, pendiente) y el 007 ya existe, así que estos serán **008, 009 y 010**. Conviene correr 008 antes que 006, porque 006 no toca UI.

---

## Spec 008 — Navegación y consistencia del shell (P1)

### Nueva arquitectura de información (`src/components/layout/nav-items.ts`)

Los ítems pasan a tener `group` y se ordenan así:

| Grupo     | Ítems                             |
| --------- | --------------------------------- |
| Principal | Inicio, Gastos, Ingresos, Crédito |
| Planear   | Gastos fijos, Metas               |
| Deudas    | Por cobrar                        |
| Análisis  | Bitácora, Patrimonio              |
| Pie       | Configuración                     |

- **Sidebar desktop** (`AppShell.tsx` `NavLinks`): secciones con encabezado pequeño, Configuración fija al fondo y `max-h-[calc(100dvh-…)] overflow-y-auto` en el `nav` sticky, para que no se corte en pantallas bajas.
- **Barra móvil** (`MobileNav.tsx`): `Inicio · Gastos · (＋) · Crédito · Más`.
  - El ＋ central va elevado, con variante `cta`.
  - Se elimina el FAB flotante y con él `useFabHidden`.
  - "Más" queda activo (`aria-current`) cuando la ruta pertenece a un ítem secundario.
- **Panel "Más"**: pasa de `Sheet side="left"` a `side="bottom"`, con las secciones agrupadas (Ingresos va arriba, en "Principal") y el título "Más" en lugar del nombre de la app. Se reutilizan `Sheet` (`ui/sheet.tsx`) y `NavIndicator`.

### Hoja de creación "＋" (componente nuevo `src/components/layout/CreateSheet.tsx`)

- Tiene 3 acciones grandes: **Gasto**, **Ingreso** y **Pagar tarjeta**.
- Debajo van los chips de gastos rápidos (se reutiliza `QuickExpenseBar` en su variante `dialog`).
- Cada acción abre el diálogo existente en modo lazy (`LazyAddExpenseDialog`, `RegisterIncomeDialog`, `CardPaymentDialog`).
- Se monta una sola instancia de cada diálogo en el shell y se quitan los duplicados (hoy `ExpensesPage.tsx:261` y `MobileNav.tsx:162` montan dos).
- El estado de qué diálogo está abierto vive en el store `useUi` (zustand), para que cualquier página pueda abrir uno (por ejemplo "Pagar" desde Crédito).

### Desktop: acción global

- En la top bar va un botón **"＋ Nuevo"** (cta, con dropdown Gasto/Ingreso/Pagar tarjeta). Es el único CTA destacado por pantalla (FR-006).
- Los CTA de cada página pasan a `outline`, o se quitan si duplican la acción global (por ejemplo "Add expense" en Dashboard y Expenses).
- Atajos de teclado: `N` gasto, `I` ingreso, `P` pagar tarjeta. Se ignoran mientras el foco esté en un input, y se muestran en el dropdown.

### Consistencia de headers

- `PageHeader` en todas las páginas, incluidas `SettingsIndex.tsx` y `RulesSettings.tsx` (que no tienen icono).
- Rules usa `SettingsHeader`, para tener el enlace "‹ Configuración" que hoy le falta.
- Se renombra el sheet de la top bar de "Preferencias" a **"Apariencia"** (idioma, moneda, tema, salir) y se cambia su icono a `Palette` o `UserRound`, para no confundirlo con `/settings/preferences`.

### Fixes del shell

- `AppShell.tsx:150`: header con `pt-[env(safe-area-inset-top)]` y padding left/right con el inset.
- `AppShell.tsx:209`: `pb-[calc(5rem+…)]` solo bajo `md` (`md:pb-6`).
- Reordenar el Dashboard en móvil: las alertas (sobregiro, cobros) van **arriba**, compactas y tocables. Hoy `Dashboard.tsx:131` las manda al final con `max-md:order-last`.

### Unificar el estado de tarjetas

- Componente nuevo `CardStatementCard` (en `src/features/credit/`) que muestra:
  - el **último estado** (pagado ✓ / pendiente / vencido);
  - el **próximo estado** (monto y fecha);
  - el botón **Pagar**.
- Lo usan Crédito y Expenses. La lógica de selección del estado que hoy está en `CreditPage.tsx:60-66` se mueve a un helper compartido junto a `useCardStatuses`.
- En Expenses la sección de tarjetas se reduce a un resumen compacto con enlace a Crédito.

---

## Spec 009 — Flujos y formularios con menos fricción (P1–P2)

1. **Recordar lo último usado.** Slice nuevo en el store de preferencias (persistido) con `lastPaymentAccountId`, `lastSubcategoryId` y `lastDepositAccountId`.
   - Defaults en `AddExpenseDialog.tsx:86`, `RegisterIncomeDialog.tsx:93`, `CardPaymentDialog.tsx:64` y `RecurringForm.tsx:104-108`.
   - Si la cuenta guardada está archivada, se ignora.
2. **No perder datos si falla el guardado.** En `useSnapshotMutation` (`src/data/snapshot-cache.ts`), los diálogos pasan los valores del form como contexto.
   - En `onError`, el toast de error trae la acción **"Reintentar"**, que reabre el diálogo con esos valores (vía `useUi`).
   - Prioridad: Receivables (`AddReceivableDialog.tsx:119`), Expense e Income.
3. **Deshacer en lugar de confirmar** para borrar gastos, ingresos, pagos de tarjeta y gastos fijos.
   - El borrado optimista y el toast de 6 s siguen el patrón de `quick-expense-hooks.ts:30,66-83`.
   - El delete real se difiere hasta que vence el toast, y se ejecuta en `pagehide`.
   - El diálogo de confirmación se queda solo para taxonomía y cuentas con historial.
4. **Estados de error en todas las páginas.** Componente compartido `PageQueryState` (skeleton / error con Reintentar / contenido), siguiendo el patrón de `Dashboard.tsx:102-112`. Se aplica en Expenses, Ledger, Income, Credit, Receivables, Recurring, Goals y NetWorth (todas usan hoy `!data → skeleton`).
5. **Formulario de gasto**
   - Chips de fecha `Hoy · Ayer · Otra` en lugar de mostrar el date input de entrada, y `max={today}`.
   - Lista corta de 4–6 subcategorías recientes como chips sobre el select.
   - En desktop, "Guardar y agregar otro" (Shift+Enter).
6. **Montos** (`src/domain/parse.ts:9`): aceptar coma decimal ("250,5") cuando hay una sola coma seguida de 1–2 dígitos y ningún punto. Se amplían los tests de propiedades con fast-check.
7. **Listas en móvil**
   - Gastos: tocar la fila abre la edición; las acciones (borrar) viven dentro del sheet; se quitan los iconos lápiz/papelera en móvil (se quedan visibles al hover en desktop).
   - Las filas se agrupan por día ("Hoy", "Ayer", "Mié 5 nov").
   - Plantillas de gasto rápido y taxonomía: los 3–4 iconos por fila pasan a un menú `⋯` (`DropdownMenu`).
   - Receivables: las cuotas se muestran como cards bajo `md` en lugar de la tabla con scroll horizontal (`ReceivablesPage.tsx:144`).
8. **Gastos y Bitácora**
   - El selector de quincena se mueve al `PageHeader` de Expenses.
   - Chips de filtro en Expenses (Necesidades/Gustos, método de pago).
   - Filtros de Ledger en la URL (`useSearchParams`), con presets ("Esta quincena", "Mes pasado") y búsqueda por texto en notas y descripción.
   - Las filas de Ledger son tocables y abren la edición del movimiento.
9. **Dashboard accionable**: las BucketCard enlazan a Gastos filtrado por bucket, y se añade una alerta de "Tarjeta vence en N días" con el botón Pagar.
10. **Detalles**
    - Autofocus en el monto de Income y Recurring.
    - En Recurring, el día de cargo por defecto es el día de hoy.
    - `inputMode="numeric"` en los enteros de `PreferencesForm.tsx:96`.
    - En Goals, el monto mensual sugerido va como valor real y no como placeholder.
    - La gestión de plantillas de gasto rápido se mueve a Configuración → "Gastos rápidos", con acceso desde un enlace "Administrar" en la hoja ＋.

---

## Spec 010 — Animaciones y pulido (P2–P3), dentro de las reglas de spec 003

Todo con CSS, `tw-animate-css` y el `<ViewTransition>` de React 19.3: funciona sin config en el App Router y no agrega bundle (guía en `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Todas las animaciones duran ≤300 ms, solo usan opacity, transform y background-color, y respetan el kill-switch de `globals.css:195-210`.

| Interacción                         | Técnica                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cambio de ruta (con salida)         | `<ViewTransition>` en `src/app/(app)/template.tsx` en lugar de `animate-content-in`; crossfade y desplazamiento de 4 px                                |
| Skeleton → contenido                | `<ViewTransition>` alrededor de `PageQueryState` (revela un Suspense o crossfade)                                                                      |
| Alta de fila (gasto, ingreso, etc.) | `@starting-style` y la clase `animate-row-in` nueva (fade + 4 px, `duration-base`)                                                                     |
| Baja de fila / deshacer             | `<ViewTransition>` con `startTransition` alrededor del update optimista                                                                                |
| Abrir y cerrar la hoja ＋ / "Más"   | slide-up existente del Sheet, más un handle visual y **drag-to-dismiss** con pointer events nativos (sin librería) en `ui/dialog.tsx` y `ui/sheet.tsx` |
| Guardar con éxito                   | pulso de `bg-surface-highlight` en la fila o card afectada (reutiliza `animate-balance-highlight`)                                                     |
| Montos que cambian                  | se extiende el flash de fondo de `BucketCard` a metas y patrimonio (el texto nunca se anima)                                                           |
| Barra de metas                      | crece desde 0 con `scaleX`, igual que `BucketCard.tsx:88-93`                                                                                           |
| Gráfica de patrimonio               | se mantiene sin animación (decisión de spec 003)                                                                                                       |
| Errores de validación               | fade-in con altura animada usando `interpolate-size: allow-keywords`                                                                                   |
| Botón ＋ central                    | rotación de 45° del icono mientras la hoja está abierta                                                                                                |

También entran los ajustes de accesibilidad que encontré:

- `pointer-coarse` en items de dropdown, radio y switch.
- `focus-visible` en dropdown-menu.
- Se actualiza `tests/e2e/motion.spec.ts` para cubrir las animaciones nuevas.

---

## Archivos críticos

- **Shell:** `src/components/layout/{AppShell,MobileNav,nav-items,PageHeader,PreferencesSheet}.tsx`, `CreateSheet.tsx` (nuevo), `src/store/ui.ts` (o donde viva `useUi`).
- **Flujos:** `src/data/snapshot-cache.ts`, `src/domain/parse.ts`, `src/features/expenses/{AddExpenseDialog,ExpensesPage,CardDebtSummary,QuickExpenseBar}.tsx`, `src/features/income/RegisterIncomeDialog.tsx`, `src/features/credit/CreditPage.tsx`, `src/features/ledger/{LedgerPage,LedgerFilters,LedgerTable}.tsx`, `src/features/receivables/*`.
- **Motion:** `src/app/(app)/template.tsx`, `src/app/globals.css`, `src/components/ui/{dialog,sheet,dropdown-menu}.tsx`.
- **i18n:** `src/i18n/messages/{en,es}.json`, con claves nuevas para los grupos de nav, la hoja ＋, deshacer y reintentar.

## Verificación (por spec)

- `pnpm typecheck && pnpm lint && pnpm test` (unit, incluido parse con fast-check y theme-contrast).
- `E2E_MODES=demo pnpm test:e2e`. Es solo UI, así que no se levanta Supabase local (memoria). Se actualizan los e2e de nav (barra, "Más", ＋), deshacer, reintentar, filtros por URL, `a11y.spec.ts` y `motion.spec.ts`.
- `pnpm build` y `pnpm check:demo-bundle`, para confirmar que el first-load no crece más de +20 kB (SC-006).
- Revisión visual en la demo desplegada (Vercel desde `main`) a 390 px y 1440 px, en tema claro, oscuro y neon, con `prefers-reduced-motion` activado y desactivado.

## Flujo de trabajo

Cada spec pasa por `/speckit-specify` → `clarify` → `plan` → `tasks` → `implement`, con commit + push a `main` en cada paso.
