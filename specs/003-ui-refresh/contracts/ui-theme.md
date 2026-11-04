# Contract: tema, tokens y componentes de UI (003-ui-refresh)

Interfaces que el resto de la app (y las pruebas) pueden asumir. Cualquier cambio a este contrato debe
reflejarse en `tests/unit/theme-contrast.test.ts` y en los e2e.

## 1. Tokens semánticos (`src/styles/tokens.css`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--background` | `--brand-white` | `--brand-deep` | Fondo de página |
| `--foreground` | `--brand-ink` | `--brand-mist` | Texto principal |
| `--card` / `--popover` | `--brand-white` | `--brand-ink` | Tarjetas, popovers, diálogos |
| `--card-foreground` / `--popover-foreground` | `--brand-ink` | `--brand-mist` | |
| `--muted` / `--secondary` / `--accent` | `--brand-mist` | `--brand-ink` | Superficies secundarias, hover |
| `--muted-foreground` | `--brand-ink-soft` | `--brand-sage` | Texto secundario |
| `--secondary-foreground` / `--accent-foreground` | `--brand-ink` | `--brand-mist` | |
| `--primary` | `--brand-teal` | `--brand-emerald` | Acción principal, enlaces |
| `--primary-foreground` | `--brand-white` | `--brand-deep` | |
| `--primary-hover` | `--brand-teal-strong` | `color-mix(in oklch, var(--brand-emerald) 85%, var(--brand-white))` | |
| `--cta` | `--brand-emerald` | `--brand-emerald` | Llamada a la acción destacada |
| `--cta-foreground` | `--brand-ink` | `--brand-deep` | |
| `--success` | `--brand-teal` | `--brand-emerald` | Texto/ícono positivo, semáforo verde |
| `--surface-highlight` | `--brand-mist` | `--brand-ink` | Bloque detrás de gráficas y saldos |
| `--nav-active` / `--nav-active-foreground` | `--brand-mint` / `--brand-ink` | `--brand-teal` / `--brand-mist` | Indicador de navegación |
| `--ring` | `--brand-teal` | `--brand-emerald` | Anillo de foco |
| `--border` / `--input` | `#D1E7E0` / `#6B958A` | `#1A4541` / `#5B867C` | Bordes decorativos / borde de campo (≥ 3:1: 3.34 sobre blanco; 4.23 sobre deep y 3.59 sobre ink) |
| `--destructive` | `#B91C1C` | `#F87171` | |
| `--series-1` / `-2` / `-3` | `#0F766E` / `#EB6834` / `#2A78D6` | `#34D399` / `#FB923C` / `#60A5FA` | Patrimonio / pasivos / activos |
| `--sidebar` | `--brand-mist` | `--brand-ink` | Barra lateral |

Nota `--input`: WCAG 1.4.11 exige 3:1 para el borde que identifica un campo; un verde pálido tipo `#B5D3CA`
(1.60:1) no lo cumple, por eso `--input` es más oscuro que `--border`. El semáforo ámbar/rojo conserva sus clases
Tailwind actuales (excepción documentada). Ratios de las series sobre `--surface-highlight` claro: teal 5.20,
azul 4.19, naranja 3.04 (todas ≥ 3).

### Pares verificados por el test de contraste

Texto (≥ 4.5): `foreground/background`, `foreground/muted`, `card-foreground/card`, `muted-foreground/background`,
`muted-foreground/muted`, `muted-foreground/card`, `primary-foreground/primary`, `cta-foreground/cta`,
`success/surface-highlight`, `success/background`, `destructive/background`, `nav-active-foreground/nav-active`,
`primary/background` (enlaces).

No-texto (≥ 3): `ring/background`, `ring/card`, `input/background`, `input/card`, `series-{1,2,3}/background`,
`series-{1,2,3}/surface-highlight`, `primary/muted` (barra de progreso sobre su pista).

## 2. Utilidades Tailwind expuestas (`@theme inline`)

`bg-cta`, `text-cta-foreground`, `text-success`, `bg-success`, `bg-surface-highlight`, `bg-nav-active`,
`text-nav-active-foreground`, `bg-primary-hover`, `duration-fast|base|slow`, `ease-out-quint`.
Clases de animación: `animate-shimmer`, `animate-balance-highlight`, `animate-content-in`.

## 3. Button (`src/components/ui/button.tsx`)

```ts
variant: "default" | "cta" | "outline" | "secondary" | "ghost" | "destructive" | "link"
size:    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg" | "fab"   // fab = 56 px, redondo
```

- `default`: `bg-primary text-primary-foreground hover:bg-primary-hover`.
- `cta`: `bg-cta text-cta-foreground shadow-[0_4px_14px_-4px] shadow-cta/50 hover:shadow-cta/70`; máximo uno por
  pantalla (SC-007). En móvil (< `md`) el único `cta` es el CTA flotante: los botones de página usan
  `variant="cta"` solo desde `md` (`className` con `max-md:` que los devuelve al estilo `default`), y el botón
  `add-expense` de Dashboard y Gastos lleva `max-md:hidden`.
- Todas: `focus-visible:ring-3 ring-ring/60`, `active:scale-[.98]`, `transition-[color,background-color,box-shadow,transform] duration-fast`,
  `pointer-coarse:min-h-11 pointer-coarse:min-w-11`.

## 4. Preferencias de tema (`src/store/preferences.ts`, `src/store/effects.tsx`)

```ts
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

// PersistedPreferences += { theme: ThemePreference }   (default "system")
// PreferencesActions   += { setTheme(theme: ThemePreference): void }
export const selectTheme: (s: PreferencesStore) => ThemePreference;
export function resolveTheme(theme: ThemePreference, prefersDark: boolean): ResolvedTheme;

// effects.tsx
export function applyTheme(resolved: ResolvedTheme, explicit: boolean): void;
//   html.classList.toggle("dark", resolved === "dark"); html.style.colorScheme = resolved;
//   explicit ? set both meta[name=theme-color] content : restore original contents
// PREFERENCES_BOOT_SCRIPT: además de lang/privacy/title, aplica .dark y color-scheme antes del primer paint.
```

## 5. Componentes nuevos y `data-testid`

| Componente | testid | Notas |
|---|---|---|
| `ThemeToggle` | `theme-toggle` (disparador), `theme-option-light`, `theme-option-dark`, `theme-option-system` | `DropdownMenuRadioGroup`; `aria-label` = `theme.toggle` |
| `MobileNav` | `mobile-nav`; enlaces `mobile-nav-{href sin /}`; `mobile-nav-more` | `<nav aria-label={nav.label}>`, `md:hidden`, `aria-current="page"` en el activo |
| CTA flotante | `fab-add-expense` | En todas las pantallas autenticadas < `md`; abre `AddExpenseDialog`; `aria-label` = `expenses.addTitle` |
| `PreferencesSheet` | `preferences-open` (botón del header móvil), `preferences-sheet` | Contiene `LanguageToggle`, `CurrencyToggle`, `ThemeToggle`, cerrar sesión |
| `NavIndicator` | — | `aria-hidden`; solo decorativo, el estado activo lo comunica `aria-current` |
| `BrandMark` | `brand-mark` | `aria-hidden`; siempre acompañado del nombre de la app (visible o `sr-only`) |

Los `data-testid` existentes (`language-toggle`, `currency-toggle`, `privacy-toggle`, `add-expense`,
`bucket-*`, `skip-link`) no cambian (`add-expense` queda oculto en móvil; los e2e existentes corren en escritorio). En móvil, `language-toggle`/`currency-toggle` solo existen dentro del panel
abierto.

## 6. Reglas de movimiento

| Interacción | Mecanismo | Duración | Con reduced motion |
|---|---|---|---|
| Hover/pulsación de botón | CSS | 150 ms | instantáneo |
| Indicador de nav | Framer `m.span` (`y` en sidebar, `x` en barra inferior) | 250 ms `ease-out-quint` | salta a la posición |
| Fundido de contenido al navegar | CSS `animate-content-in` (opacity + 4 px) en `(app)/template.tsx` | 150 ms | sin animación |
| Entrada escalonada dashboard | Framer `variants` + `staggerChildren: 0.04` | 200 ms c/u | estado final directo |
| Realce de saldo | CSS `animate-balance-highlight` (solo `background-color`) | 300 ms | sin animación |
| Barra de progreso | CSS `transform: scaleX` | 300 ms | instantáneo |
| Color del semáforo | CSS `transition-colors` | 200 ms | instantáneo |
| Blur de privacidad | CSS: `.money` en los dos sentidos (ya muestra `••••`); `input[data-money]` **solo al desactivar** (al activar, instantáneo) | 200 ms | instantáneo |
| Diálogos / sheets | `tw-animate-css` | 150–200 ms | sin animación |
| Skeleton | CSS `animate-shimmer` (gradiente `--muted`→`--surface-highlight`) | 1.5 s en bucle | estático |
| CTA flotante al hacer scroll | CSS `translate-y` | 200 ms | instantáneo |

Garantías: ninguna animación retrasa el renderizado de datos (los datos se pintan en el primer render; las
animaciones solo afectan `opacity`/`transform`/`background-color`); ningún texto de monto se anima.

## 7. Íconos y manifiesto

| Archivo | Salida |
|---|---|
| `src/app/icon.svg` | `<link rel="icon" type="image/svg+xml" sizes="any">` |
| `src/app/favicon.ico` | `<link rel="icon" href="/favicon.ico" sizes="any">` (16/32/48) |
| `src/app/apple-icon.tsx` | `<link rel="apple-touch-icon" sizes="180x180">` |
| `src/app/manifest.ts` | `/manifest.webmanifest`: `name` = `common.appName` y `short_name` = `common.appShortName` de `en.json` ("Personal Finances" / "Finances"), `start_url` "/dashboard", `display` "standalone", `theme_color` `#0F766E`, `background_color` `#ECFDF5`, íconos `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png` (`purpose: "maskable"`) |
