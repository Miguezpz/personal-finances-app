# Contrato entre frentes — Spec 012

| Elemento | Define | Usa |
|---|---|---|
| Clase `header-title` (opacidad ligada al scroll, oculta por defecto) | B (`globals.css`) | A (`AppShell.tsx`: `<span aria-hidden class="header-title md:hidden truncate text-sm font-semibold">`) |
| Constante `TILE_CLASS` (string de clases del mosaico) | A (`nav-items.ts`) | A (`AppShell` MoreGrid, `CreateSheet`) |
| Clave i18n `demo.bannerShort` (ES/EN) | B (`messages`, `DemoBanner`) | B |
| Par `bg-nav-active` / `text-nav-active-foreground` ("seleccionado") | B (`tokens.css`) | A (MoreGrid), B (toggles) |
| `data-testid`: `more-sheet`, `mobile-nav-*`, `create-*`, `demo-banner` | existentes | **No cambian** |
| Un solo `[data-variant="cta"]` visible por pantalla | B (Metas, Cuentas) | C (tests) |

Reglas: cada frente toca solo sus archivos; sin dependencias nuevas; todo texto por i18n (EN y ES); movimiento solo opacidad/transform ≤ 300 ms.
