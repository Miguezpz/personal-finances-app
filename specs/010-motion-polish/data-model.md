# Data Model: Animaciones y pulido

Sin datos persistidos. Estado de UI en memoria:

- `pending-deletes.leaving: ReadonlySet<string>` (`"${kind}:${id}"`): filas en su animación de salida (≤ 180 ms) antes de ocultarse.
- `useUi.flashed: { id: string; at: number } | null`: última fila editada con éxito; `at` reinicia la animación.
