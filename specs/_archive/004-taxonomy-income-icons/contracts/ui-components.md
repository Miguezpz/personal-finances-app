# Contract: componentes de UI nuevos (spec 004)

Todos los íconos: `aria-hidden="true"`, `focusable="false"`, `size-4` (salvo `EmptyState`), `text-muted-foreground` o el color del texto contiguo; nunca son el único contenido de un control (FR-016). Los imports de `lucide-react` son nombrados; prohibido `import *` o acceso dinámico por nombre.

## `CategoryIcon` — `src/components/icons/CategoryIcon.tsx`

```ts
props: { icon: CategoryIconKey | "generic"; className?: string }
```
Pinta el componente de `CATEGORY_ICONS[icon]` (o el genérico `Shapes`). La resolución (subcategoría → categoría → genérico) la hace el llamador con `resolveTaxonomyIcon` (`src/domain/icons.ts`).

## `IconPicker` — `src/features/settings/taxonomy/IconPicker.tsx`

```ts
props: {
  value: CategoryIconKey | null;
  inheritedFrom?: CategoryIconKey | "generic";   // solo subcategorías: ícono que se ve si value es null
  onChange(next: CategoryIconKey | null): void;
  disabled?: boolean;                            // demo / solo lectura
}
```
- Botón disparador con el ícono actual y nombre accesible traducido (`taxonomy.iconPicker`, p. ej. "Cambiar ícono de Streaming").
- Abre un `Dialog` con una cuadrícula `role="radiogroup"`; cada opción es `role="radio"` con `aria-label` = clave legible traducida o, como mínimo, la clave; navegación con flechas y `Enter`/`Espacio`.
- En subcategorías, primera opción "Usar el de la categoría" (`taxonomy.iconInherited`) que emite `null`.
- Valida con `isCategoryIconKey` antes de emitir.

## `IncomeTypeField` — `src/features/income/IncomeTypeField.tsx`

```ts
props: { value: IncomeType | ""; onChange(t: IncomeType): void; error?: string }
```
`RadioGroup` (shadcn) con las 9 opciones en cuadrícula, ícono + nombre traducido (`income.type.*`). Sin selección inicial en el alta. El error (`income.typeRequired`) se asocia con `aria-describedby` y se anuncia (`role="alert"`), como los demás campos del formulario.

## `EmptyState` — `src/components/ui/empty-state.tsx`

```ts
props: { icon: LucideIcon; children: ReactNode; action?: ReactNode }
```
Sustituye a los 8 `<p>` con borde punteado listados en el plan previo (§7). Ícono grande (`size-8`) y tenue, mensaje y acción opcional. Mismo aspecto en claro y oscuro.

## `PageHeader` — `src/components/layout/PageHeader.tsx`

```ts
props: { icon: LucideIcon; title: ReactNode; description?: ReactNode; actions?: ReactNode }
```
`<h1>` con el ícono de la página tomado de `nav-items.ts` (una sola fuente). Sustituye a los `<h1>` repetidos de las ~12 páginas sin cambiar su texto ni su jerarquía.

## Mapas de íconos — `src/components/icons/`

| Archivo | Clave → ícono |
|---|---|
| `category-icons.ts` | `CategoryIconKey` → componente (`satisfies Record<CategoryIconKey, LucideIcon>`) |
| `income-type-icons.ts` | `IncomeType` → `Briefcase, Gift, HandCoins, BadgePercent, CirclePlus, Store, PiggyBank, TrendingUp, Ellipsis` |
| `domain-icons.ts` | `ACCOUNT_KIND_ICONS` (checking `Landmark`, savings `PiggyBank`, credit_card `CreditCard`, investment `TrendingUp`, cash `Banknote`), `BUCKET_ICONS` (needs `ShieldCheck`, wants `Sparkles`, investment `Sprout`), `LEDGER_TYPE_ICONS` (expense `ArrowUpRight`, income `ArrowDownLeft`, card_payment `CreditCard`, installment `HandCoins`), `RECEIVABLE_STATUS_ICONS` (pending `Clock`, partial `CircleDashed`, collected `CircleCheck`), `GOAL_KIND_ICONS` (emergency_fund `LifeBuoy`, sinking_fund `PiggyBank`) |

Íconos sueltos de FR-014 que no forman un mapa (marcas automático/pausado, KPIs de patrimonio, fechas de tarjeta, deudor, preferencias, aviso del dashboard) se importan directamente en su componente.
