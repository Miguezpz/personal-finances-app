# UI Contracts: shell, creación global y estado de tarjeta

## Store `useUi`

```ts
openCreate(dialog: CreateDialog): void   // cierra createSheet/sidebar/preferences y abre el diálogo
closeDialog(): void
setCreateSheetOpen(open: boolean): void
```

Cualquier feature abre un diálogo con `useUi.getState().openCreate({ kind: "card-payment", cardId, suggestedAmount })`.

## `<DialogHost />`
Montado una vez en `AppShell`. Renderiza a lo más un diálogo:
- `expense` → `LazyAddExpenseDialog key={expense?.id ?? "new"} expense={expense}`
- `income` → `LazyRegisterIncomeDialog key={income?.id ?? "new"} income={income}`
- `card-payment` → `LazyCardPaymentDialog key={cardId ?? "any"} cardId suggestedAmount`
`onOpenChange(false)` → `closeDialog()`. Precarga los tres chunks en idle.

## `<MobileNav />` (md:hidden)
Orden: `mobile-nav-dashboard`, `mobile-nav-expenses`, `mobile-nav-create` (botón, `aria-haspopup="dialog"`, `aria-expanded`, nombre accesible "Crear"/"Create"), `mobile-nav-credit`, `mobile-nav-more` (con `aria-current="page"` en rutas secundarias).

## `<CreateSheet />`
`data-testid="create-sheet"`, `Sheet side="bottom"`, título "Crear"/"Create". Acciones: `create-expense`, `create-income` y `create-card-payment` (deshabilitada sin tarjetas, con texto de ayuda). Debajo, `QuickExpenseBar variant="dialog"` (solo si hay plantillas).

## `<NewMenu />` (hidden md:inline-flex, en la barra superior)
Botón `data-testid="new-menu"` `variant="cta"` con el texto "＋ Nuevo"/"＋ New". Ítems: `new-expense` (N), `new-income` (I) y `new-card-payment` (P, deshabilitado sin tarjetas). Cada ítem muestra su atajo con `<kbd>`.

## Atajos (`useCreateShortcuts`)
Teclas N/I/P → `openCreate`. Se ignoran con modificadores, repetición, foco editable o un diálogo o panel abierto.

## Panel "Más"
`data-testid="more-sheet"`, `Sheet side="bottom"`, título "Más"/"More", grupos con encabezado (`h3` visual, lista `ul` por grupo) y el destino actual con `aria-current="page"`.

## `<CardStatementCard summary card variant="full|compact" />`
- `full` (Crédito): `data-testid="credit-card"`, `data-card`, `data-state`.
  - Headline: etiqueta ("Pagar para no generar intereses" si el headline es `last`; "Próximo estado" si es `next`), `<Money>`, fecha límite.
  - Línea del último estado: "Último estado: pagado ✓ · 30 oct", "pendiente · vence …" o "Vencido" con Badge e icono.
  - Línea del próximo estado.
  - Deuda total.
  - Botón `pay-card` → `openCreate({kind:"card-payment", cardId, suggestedAmount: payAmount})`.
- `compact` (Gastos): `data-testid="card-debt"`; una fila con marca, nombre, estado, `<Money>` del headline, fecha y `pay-card`. La sección incluye el enlace `cards-see-credit` a `/credit`.

## `PageHeader`
Nueva prop `back?: { href: string; label: string }`: muestra el enlace con `ChevronLeft` encima del título.

## `PreferencesSheet`
Título y `aria-label` = `nav.appearance` ("Apariencia"/"Appearance"), icono `Palette`. Se conservan los testids `preferences-open` y `preferences-sheet`.
