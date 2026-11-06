# Contract: UI components (spec 005)

Todo texto visible sale de `src/i18n/messages/{en,es}.json`, en el namespace nuevo `quickExpenses`. Los montos se pintan con `Money`, que respeta el modo privacidad (FR-015).

## `useQuickExpense()` — `src/features/expenses/quick-expense-hooks.ts`

```ts
function useQuickExpense(): {
  /** Registra el gasto de la plantilla con fecha de hoy y muestra el aviso con Deshacer. */
  apply(template: ExpenseTemplate): void;
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

Va en el Dashboard, entre el `PageHeader` y las tarjetas de bucket. Si el snapshot no ha cargado, no se muestra.

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

## `AddExpenseDialog` — cambio

- Solo en modo nuevo, un `Switch` "Guardar como gasto rápido" (`data-testid="save-as-template"`).
- Si está marcado, cuando el gasto se guarda con éxito se crea la plantilla con `templateFromExpense()`. Con 12 activas, el switch queda deshabilitado con el motivo.

## Claves i18n (`quickExpenses`)

`title`, `create`, `createFirst`, `edit`, `delete`, `deleteConfirm`, `moveUp`, `moveDown`, `name`, `amount`, `subcategory`, `paymentMethod`, `noPaymentMethod`, `added`, `undo`, `undone`, `addFailed`, `apply`, `unavailableSubcategory`, `accountArchived`, `limitReached`, `saveAsTemplate`, `saved`, `saveFailed`, `nameRequired`, `nameTooLong`, `invalidAmount`, `subcategoryRequired`.

La prueba de paridad EN/ES (`tests/unit/i18n`) cubre las claves nuevas.
