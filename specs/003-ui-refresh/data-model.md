# Data Model: Renovación visual "Fresh & Growth"

Sin cambios en la base de datos. Las únicas "entidades" son de cliente.

## 1. ThemePreference (preferencia persistida)

Amplía `PersistedPreferences` de `src/store/preferences.ts` (contrato original en
`specs/001-personal-finances-core/contracts/ui-store.ts`).

| Campo | Tipo | Default | Validación |
|---|---|---|---|
| `theme` | `"system" \| "light" \| "dark"` | `"system"` | En `merge`: si el valor guardado no es uno de los tres, se ignora y queda el default. |

- **Persistencia**: `localStorage["pfa:prefs:v1"].state.theme`, junto a `locale`, `displayCurrency` y `privacyMode`.
  Sin cambio de `version`: un estado guardado sin `theme` sigue siendo válido.
- **Acciones**: `setTheme(theme: ThemePreference): void`.
- **Selectores**: `selectTheme(s) → ThemePreference`.
- **Derivado (no persistido)**: `ResolvedTheme = "light" | "dark"` =
  `theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme`;
  sin `matchMedia` → `"light"`.

### Transiciones de estado

```text
          setTheme("light")            setTheme("dark")
 system ───────────────────▶ light ─────────────────▶ dark
   ▲                                                    │
   └──────────────────── setTheme("system") ◀───────────┘
 (cualquier estado puede ir a cualquier otro)

 En "system": cambio de prefers-color-scheme del SO ⇒ ResolvedTheme se recalcula en vivo.
 En "light"/"dark": cambios del SO se ignoran.
```

### Efectos (fuera del store, en `PreferencesEffects` y en el boot script)

| Efecto | Valor |
|---|---|
| `<html class="dark">` | presente si `ResolvedTheme === "dark"` |
| `<html style="color-scheme">` | `ResolvedTheme` |
| `<meta name="theme-color">` (ambas) | si `theme !== "system"`: `#FFFFFF` (claro) o `#031F1D` (oscuro); en `system` se restauran los valores originales de cada `media` |

## 2. UiState (no persistido)

Amplía `src/store/ui.ts`.

| Campo | Tipo | Default | Uso |
|---|---|---|---|
| `dashboardIntroPlayed` | `boolean` | `false` | La entrada escalonada del dashboard solo se reproduce mientras es `false`; se pone a `true` al terminar o si se salta (reduced motion). |
| `preferencesOpen` | `boolean` | `false` | Panel móvil de preferencias (mismo patrón que `sidebarOpen`). |

## 3. Paleta de marca (tokens de diseño)

No es un dato de usuario, pero es la "fuente única" de FR-039. Vive en `src/styles/tokens.css`.

**Primitivos** (`:root`, independientes del tema):

| Token | Valor |
|---|---|
| `--brand-ink` | `#052E2B` |
| `--brand-teal` | `#0F766E` |
| `--brand-emerald` | `#34D399` |
| `--brand-mint` | `#A7F3D0` |
| `--brand-mist` | `#ECFDF5` |
| `--brand-ink-soft` | `#4B635F` |
| `--brand-teal-strong` | `#115E59` |
| `--brand-deep` | `#031F1D` |
| `--brand-sage` | `#8FB8AE` |
| `--brand-white` | `#FFFFFF` |

**Semánticos** por tema: ver la tabla de `contracts/ui-theme.md` §1. Cada semántico referencia exactamente un
primitivo (o un color de alerta/serie en HEX), para que el test de contraste pueda resolverlo.

**Movimiento**:

| Token | Valor |
|---|---|
| `--duration-fast` | `150ms` |
| `--duration-base` | `200ms` |
| `--duration-slow` | `300ms` |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |

### Reglas de validación

- Todo par `[texto, fondo]` listado en el contrato ≥ 4.5:1 (≥ 3:1 si es texto grande o no-texto), en ambos temas.
- `--brand-emerald` no aparece como valor de ningún token de texto del tema claro.
