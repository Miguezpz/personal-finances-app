# Research: Navegación y consistencia del shell

## R1 · Estado de los diálogos globales

- **Decision**: `useUi.activeDialog` pasa a ser una unión discriminada `CreateDialog | null` (`{kind:"expense", expense?}`, `{kind:"income", income?}`, `{kind:"card-payment", cardId?, suggestedAmount?}`). `DialogHost` (montado una vez en `AppShell`) renderiza el diálogo activo con `key` por entidad para reiniciar el formulario. Crear y editar usan la misma instancia.
- **Rationale**: hoy `openDialog` no tiene usos, así que se puede retipar sin migración. Un `payload: Record<string, unknown>` obligaría a castear (Principio II). Montar en el host cumple FR-009 y elimina duplicados de `ExpensesPage`, `MobileNav` y `Dashboard`.
- **Alternatives**: contexto React propio (más código, mismo resultado); mantener diálogos por página (incumple FR-009).

## R2 · Reglas para los atajos N/I/P

- **Decision**: hook `useCreateShortcuts` con un `keydown` en `document`. Ignora si `e.defaultPrevented`, `e.repeat`, hay modificador (Ctrl/Meta/Alt/Shift), el `target` es editable (`input`, `textarea`, `select`, `[contenteditable]`) o hay un diálogo o panel abierto (`activeDialog`, `createSheetOpen`, `sidebarOpen`, `preferencesOpen`, o cualquier `[role=dialog][data-state=open]` en el DOM). Compara por `e.key.toLowerCase()`.
- **Rationale**: cubre los casos del spec (Edge Cases) sin dependencias. Revisar el DOM cubre los diálogos que no están en `useUi` (confirmaciones, edición de metas).
- **Alternatives**: librería de hotkeys (dependencia nueva, descartada).

## R3 · Presupuesto de First Load

- **Decision**:
  - Los tres diálogos se cargan con `React.lazy` (patrón existente de `LazyAddExpenseDialog`) y se precargan en idle.
  - El menú Radix de "＋ Nuevo" se carga con `next/dynamic` (`ssr:false`) y muestra un botón placeholder idéntico, como `ThemeToggle`/`ThemeMenu`.
  - `CreateSheet` reutiliza `Sheet` (ya en el bundle por "Más" y "Preferencias") y carga `QuickExpenseBar` solo cuando se abre.
- **Rationale**: `RegisterIncomeDialog` y `CardPaymentDialog` hoy se importan en sus páginas. Moverlos al shell sin lazy los metería en el First Load de todas las rutas.
- **Alternatives**: importar eager (rompe SC-006).

## R4 · Unificación del estado de tarjeta

- **Decision**: función pura `cardStatementSummary(card, data, today)` en `src/domain/credit.ts`:
  - `last` = `cardStatus(card, data, today)`. Situación: `paid` si `payToAvoidInterest === 0`, `overdue` si `today > nextPaymentDue`, `pending` en otro caso.
  - `next`: corte siguiente = `cutOffIn(cutOffDay, addMonthsToMonthStart(lastCutOff, 1))`, límite = `dueDateFor(terms, nextCutOff)` y monto = `max(0, cardStatus(card, data, nextCutOff).payToAvoidInterest − last.outstanding)`. Es la misma fórmula incremental de `creditTimeline`.
  - `headline` = `last` salvo que esté `paid`, y entonces `next`. `payAmount` = monto del headline.
- **Rationale**: Gastos mostraba `cardStatus` (último estado, ya pagado: $0.00 · 30 oct) y Crédito el primer evento del timeline (30 nov: $13,190.50). Con un solo cálculo, el mismo headline aparece en ambos. El monto incremental coincide con el timeline porque usa la misma resta acumulada.
- **Alternatives**: seguir leyendo el timeline en Crédito (depende del rango de 60 días y duplica lógica).

## R5 · Grupos de navegación y "Más" activo

- **Decision**: `NavItem.group: "main" | "plan" | "debts" | "insights" | "footer"`; `NAV_GROUPS` ordenado; `MOBILE_BAR_ITEMS = [/dashboard, /expenses, /credit]`; `isSecondaryRoute(pathname)` = ninguna de las rutas de la barra coincide. "Más" lleva `aria-current="page"` y estilo activo cuando es true. El panel "Más" lista los grupos con todos los destinos que no están en la barra (Ingresos queda en "Principal").
- **Rationale**: una sola fuente para la barra lateral, la barra móvil y el panel, como hoy hace `navIcon`.

## R6 · Panel "Más" y hoja ＋

- **Decision**: `Sheet side="bottom"` con `rounded-t-2xl`, `max-h-[85dvh] overflow-y-auto` y padding de safe-area, con el mismo estilo que `PreferencesSheet`. El handle visual y el arrastre para cerrar quedan para el spec 010.
- **Rationale**: reutiliza primitivas y animaciones existentes (slide-up del Sheet, que ya respeta reduced-motion).

## R7 · Franja de alertas del Dashboard móvil

- **Decision**: `DashboardAlertStrip` (`md:hidden`) arriba del contenido. Muestra filas compactas tocables: sobregiro → `/expenses` y cobros por vencer → `/receivables`, reutilizando los datos de `CollectionAlerts` mediante un hook expuesto. El bloque de alertas completo queda `max-md:hidden`. Sin alertas no se renderiza nada.
- **Rationale**: las alertas quedan visibles sin desplazarse y los saldos siguen siendo el primer bloque destacado (FR-019).

## R8 · Encabezados

- **Decision**: `PageHeader` gana `back?: {href, label}`. `SettingsHeader` delega en `PageHeader` con el icono de su sección (`SETTINGS_SECTIONS` compartido con `SettingsIndex`). `SettingsIndex` usa `PageHeader` con `navIcon("/settings")`. `RulesSettings` usa `SettingsHeader`.
- **Rationale**: una sola apariencia de encabezado (FR-014/015).

## R9 · CTA únicos

- **Decision**: se quitan "Agregar gasto" (Dashboard y Gastos) y "Registrar ingreso" (Ingresos) y el botón "Pagar tarjeta" del encabezado de Gastos (lo cubre la acción global). `ResponsiveCtaButton` se elimina y sus usos pasan a `Button` default. Los estados vacíos de Gastos e Ingresos llevan un `Button variant="outline"` que abre el diálogo global.
- **Rationale**: FR-012 y Clarifications Q1.

## R10 · E2E en modo demo

- **Decision**: helper `openCreate(page, kind)` en `tests/e2e/fixtures.ts` que abre "＋ Nuevo" → opción en escritorio o ＋ → acción en móvil. Los specs que usaban `add-expense` o `fab-add-expense` lo adoptan. Nuevo `navigation.spec.ts` (sin etiqueta: corre en demo y live). Solo se ejecuta demo.
- **Rationale**: el demo bloquea escrituras, pero navegación, apertura de diálogos y estados de tarjeta se verifican con el seed.
