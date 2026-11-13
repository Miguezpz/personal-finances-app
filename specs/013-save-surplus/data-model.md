# Data Model: Ahorrado de la quincena

## user_settings (modificada)

| Columna | Tipo | Default | Regla |
| ------- | ---- | ------- | ----- |
| `save_surplus` | `boolean not null` | `false` | Nueva. `true` = el sobrante de cada quincena va a Ahorrado y no se arrastra. |

Dominio: `UserSettings.saveSurplus: boolean`. En `DEFAULT_USER_SETTINGS` vale `false`; en el demo, `true`.

## Ahorrado (derivado, no se guarda)

Por bucket `b ∈ {needs, wants}` y quincena `p` (rangos efectivos de la spec 006):

```
closing(b,p)   = carryIn(b,p) + allocated − fixedApplied − manual − goalContrib
saveSurplus = false:  carryIn(b,p+1) = closing(b,p)
saveSurplus = true:   carryIn(b,p+1) = min(closing(b,p), 0)
                      saved(b,p)     = max(closing(b,p), 0)
```

- `saved.lastPeriod` = Σ_b `saved(b, p_actual − 1)`.
- `saved.total` = Σ_b Σ_{p < p_actual} `saved(b, p)`.
- La quincena actual no se transfiere.

## Ejemplo (datos del dueño, 13 nov 2026, ajuste encendido)

| | Necesidades | Gustos |
| - | - | - |
| Cierre de `2026-11-1` | 1,378.94 | 948.96 |
| → Ahorrado | 1,378.94 | 948.96 |
| carryIn de `2026-11-2` | 0 | 0 |
| Asignado de `2026-11-2` | 2,941.87 | 1,470.93 |
| Fijos pendientes (Gym, 18 nov) | −499.00 | 0 |
| **Disponible** | **2,442.87** | **1,470.93** |

Ahorrado de la quincena pasada: **2,327.90**. Total: **2,327.90**, porque es la primera quincena con datos.
