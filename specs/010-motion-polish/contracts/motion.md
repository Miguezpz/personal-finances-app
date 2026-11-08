# Contracts: motion

| Utilidad / hook | Efecto | Duración |
|---|---|---|
| `.page-in` / `.page-out` (view transition classes) | entrada (opacidad + 4 px) / salida (opacidad) de la ruta | 180 ms (+60 ms de retraso) / 120 ms |
| `useRevealOnLoad(mainRef)` | revela lo que reemplaza a un esqueleto | 200 ms |
| `animate-row-in` / `animate-row-out` | alta / baja de fila | 200 ms / 180 ms |
| `animate-balance-highlight` (existente) | pulso al guardar y destello de montos | 300 ms |
| `animate-field-error-in` | aparición de errores | 150 ms |
| `useDragToDismiss` | arrastre del asa (umbral de 80 px o 0.5 px/ms) | regreso: 200 ms |

Testids nuevos: `sheet-handle` (asa de Sheet y Dialog en móvil), `data-row-state="entering|leaving"` en las filas.
Todo se anula con `prefers-reduced-motion: reduce` (kill-switch de globals.css y comprobaciones en los hooks).
