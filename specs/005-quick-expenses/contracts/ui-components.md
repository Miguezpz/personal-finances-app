# Contract: UI components (spec 005)

Todo texto visible sale de `src/i18n/messages/{en,es}.json`, en el namespace nuevo `quickExpenses`. Los montos se pintan con `Money`, que respeta el modo privacidad (FR-015).

## `useQuickExpense()` — `src/features/expenses/quick-expense-hooks.ts`

```ts
function useQuickExpense(): {
  /**
   * Registra el gasto de la plantilla (por defecto con fecha de hoy y el monto de la plantilla)
   * y muestra el aviso con Deshacer. `overrides` viene del menú secundario (FR-007a).
   */
  apply(template: ExpenseTemplate, overrides?: { amount?: Cents; spentOn?: IsoDate }): void;
};
```

- Usa `templateToExpense()` y `useCreateExpense().mutateAsync`.
- Al crear, muestra `toast.success(t("added", { name }))` con `action` Deshacer, `duration: 6000`.
- Deshacer espera el `Expense` creado y llama `useDeleteExpense().mutate(id)`. Al terminar, muestra `toast(t("undone"))`.
- Si el guardado falla y `!isNotifiedGlobally(e)`, muestra `toast.error(t("addFailed"))`. Demo y sin conexión ya tienen su aviso global.

Hooks de administración en el mismo archivo, todos con `useSnapshotMutation` optimista:
- `useCreateTemplate`
- `useUpdateTemplate`
- `useRemoveTemplate`
- `useReorderTemplates`

## `QuickExpenseBar` — `src/features/expenses/QuickExpenseBar.tsx`

```ts
props: {
  variant: "dashboard" | "dialog";
  /** Se llama después de registrar; el diálogo de gasto lo usa para cerrarse. */
  onApplied?: () => void;
}
```

Se usa en dos lugares (FR-006, FR-006a):
- `variant="dashboard"`: en el Dashboard, entre el `PageHeader` y las tarjetas de bucket.
- `variant="dialog"`: en `AddExpenseDialog`, solo en modo nuevo, arriba del formulario. Sin plantillas activas no se muestra nada; el enlace de "crear" es exclusivo del Dashboard.

Si el snapshot no ha cargado, no se muestra.

Cada plantilla lleva su botón principal (un toque = hoy) y, al lado, un botón "⋯" (`DropdownMenu`) con el nombre accesible "Más opciones para {name}" y dos acciones:
- `t("yesterday")`: registra con la fecha de ayer.
- `t("customize")`: abre `QuickExpenseCustomDialog`.

En demo, las dos acciones muestran el aviso de solo lectura, igual que el toque.

| Estado | Render |
|---|---|
| Sin plantillas activas | Enlace discreto "Crear gasto rápido" → `/expenses#quick-expenses` |
| Con plantillas | `<ul role="list">` horizontal (`overflow-x-auto`, sin scroll de página); cada `<li>` lleva un `Button` variante `outline` de altura ≥ 44 px, con el ícono de la subcategoría, el nombre recortado (`truncate`, `max-w`) y `<Money>` |
| Plantilla con subcategoría archivada | Botón `disabled` con `title` y texto accesible "No disponible: subcategoría archivada" |

- Nombre accesible del botón: "Registrar {name}, {monto}". En modo privacidad usa el texto enmascarado.
- `data-testid="quick-expense-{id}"`, más `data-testid="quick-expense-bar"` en el contenedor.

## `QuickExpensesSection` — `src/features/expenses/QuickExpensesSection.tsx`

Va en `ExpensesPage`, con `id="quick-expenses"` como ancla.

- Lista de plantillas activas: nombre, subcategoría, método de pago y monto, más las acciones Editar, Subir, Bajar y Borrar (borrar pide confirmación, igual que borrar un gasto).
- Botón "Nuevo gasto rápido". Con 12 activas queda `disabled` y muestra el motivo (`t("limitReached")`).
- Muestra el aviso "método de pago archivado" en las plantillas cuya cuenta ya no existe.

## `QuickExpenseTemplateDialog` — `src/features/expenses/QuickExpenseTemplateDialog.tsx`

```ts
props: { open: boolean; template: ExpenseTemplate | null; onOpenChange(open: boolean): void }
```

- Campos: nombre, monto (`parseMoneyInput`), subcategoría (`SubcategoryOptions`, solo activas) y método de pago (cuentas activas, con "Sin método de pago").
- Esquema `expenseTemplateFormSchema` en `src/features/expenses/template-schemas.ts`. Los mensajes son claves i18n: `nameRequired`, `nameTooLong`, `invalidAmount`, `subcategoryRequired`.
- Una plantilla nueva se guarda con `sort = max(sort activas) + 1`.

## `QuickExpenseCustomDialog` — `src/features/expenses/QuickExpenseCustomDialog.tsx`

```ts
props: { template: ExpenseTemplate; open: boolean; onOpenChange(open: boolean): void }
```

- Campos:
  - Monto: prellenado con el de la plantilla; debe ser mayor que cero.
  - Fecha: prellenada con hoy; `max` = hoy, sin fechas futuras.
- Muestra en solo lectura la subcategoría, el método de pago y la nota (el nombre de la plantilla).
- Al guardar llama `apply(template, { amount, spentOn })` y cierra. La plantilla no cambia.
- Esquema `quickExpenseOverrideSchema` en `template-schemas.ts`. Mensajes `invalidAmount` y `futureDate`.

## `AddExpenseDialog` — cambio

- Solo en modo nuevo:
  - `<QuickExpenseBar variant="dialog" onApplied={() => onOpenChange(false)} />` arriba del formulario, separada por un `Separator`.
  - Un `Switch` "Guardar como gasto rápido" (`data-testid="save-as-template"`).
- Si está marcado, cuando el gasto se guarda con éxito se crea la plantilla con `templateFromExpense()`. Con 12 activas, el switch queda deshabilitado con el motivo.

## Claves i18n (`quickExpenses`)

`title`, `create`, `createFirst`, `edit`, `delete`, `deleteConfirm`, `moveUp`, `moveDown`, `name`, `amount`, `subcategory`, `paymentMethod`, `noPaymentMethod`, `added`, `undo`, `undone`, `addFailed`, `apply`, `unavailableSubcategory`, `accountArchived`, `limitReached`, `saveAsTemplate`, `saved`, `saveFailed`, `nameRequired`, `nameTooLong`, `invalidAmount`, `subcategoryRequired`, `moreOptions`, `yesterday`, `customize`, `customTitle`, `date`, `futureDate`, `register`.

La prueba de paridad EN/ES (`tests/unit/i18n`) cubre las claves nuevas.
