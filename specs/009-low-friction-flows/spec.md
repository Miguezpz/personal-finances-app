# Feature Specification: Flujos y formularios con menos fricción

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Spec 009 — Flujos y formularios con menos fricción (P1–P2), según docs/ux-roadmap.md. Trabajo solo de UI. (1) Recordar la última cuenta de pago, subcategoría y cuenta de depósito usadas, ignorando cuentas archivadas. (2) Si falla un guardado, el aviso de error ofrece 'Reintentar', que reabre el diálogo con lo escrito. (3) Deshacer en lugar de confirmar al borrar gastos, ingresos, pagos de tarjeta y gastos fijos; la confirmación se queda para taxonomía y cuentas con historial. (4) Estado de error con Reintentar en todas las páginas. (5) Formulario de gasto con chips de fecha Hoy/Ayer/Otra, subcategorías recientes y 'Guardar y agregar otro'. (6) Montos con coma decimal. (7) Listas móviles con fila tocable, agrupadas por día, menús ⋯ y cuotas como tarjetas. (8) Selector de quincena en Gastos, filtros por chips, filtros de Bitácora en la URL con presets y búsqueda, filas de Bitácora que abren la edición. (9) Dashboard accionable: buckets que llevan a Gastos filtrado y alerta de tarjeta por vencer con Pagar. (10) Detalles de formularios y gestión de gastos rápidos en Configuración."

## Clarifications

### Session 2026-11-07

Respondidas en modo autónomo con `docs/ux-roadmap.md` y la opción recomendada (el usuario no estuvo disponible).

- Q: ¿El selector de quincena del encabezado de Gastos filtra solo el resumen por método de pago o también la lista de movimientos? → A: Ambos. La lista muestra los movimientos de la quincena elegida (por defecto la actual); el historial completo vive en Bitácora.
- Q: ¿La quincena y los chips de filtro de Gastos se guardan en el enlace? → A: Sí (quincena, bucket y método), para que el enlace del Dashboard y la recarga los conserven.
- Q: ¿De dónde salen las subcategorías recientes del formulario de gasto? → A: Del historial de gastos (las últimas distintas por fecha, hasta 6, sin archivadas); así funcionan igual en cualquier dispositivo.
- Q: ¿"Borrar" dentro de la edición de un gasto pide confirmación? → A: No. Cierra el diálogo y usa el mismo flujo de "Deshacer".
- Q: ¿Qué opciones tienen los chips de método de pago? → A: Una por cuenta de pago usada en la quincena, más "Sin especificar", en el mismo orden que el resumen por método de pago.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar más rápido lo de todos los días (Priority: P1)

Como dueño, cuando registro un gasto, un ingreso, un pago de tarjeta o un gasto fijo, quiero que el formulario ya traiga la cuenta y la categoría que uso siempre, que pueda elegir "Hoy" o "Ayer" con un toque y que pueda escribir montos con coma ("250,5"). Así registro en segundos.

**Why this priority**: el registro es la acción más frecuente. Hoy cada formulario empieza vacío y el campo de fecha es un selector nativo poco práctico en el teléfono.

**Independent Test**: registrar un gasto con la tarjeta "Gold" en "Restaurantes"; al abrir otra vez el diálogo, ambos ya vienen seleccionados, la fecha es "Hoy" y escribir "250,5" se guarda como $250.50.

**Acceptance Scenarios**:

1. **Given** que el dueño guardó un gasto con una cuenta de pago y una subcategoría, **When** abre un nuevo gasto, **Then** esa cuenta y esa subcategoría vienen preseleccionadas.
2. **Given** que el dueño guardó un ingreso en una cuenta de depósito, o un pago de tarjeta desde una cuenta, **When** abre otro, **Then** esa cuenta viene preseleccionada.
3. **Given** que la cuenta o la subcategoría recordada se archivó o se borró, **When** abre el formulario, **Then** no se preselecciona y el campo queda como si no hubiera nada recordado.
4. **Given** el formulario de gasto, **When** se abre, **Then** la fecha muestra los chips "Hoy" (seleccionado), "Ayer" y "Otra"; "Otra" muestra el selector de fecha, que no permite fechas futuras.
5. **Given** el formulario de gasto, **When** el dueño ya registró gastos antes, **Then** sobre el selector de categoría aparecen como chips hasta 6 de sus subcategorías más recientes, y tocar una la selecciona.
6. **Given** un monto escrito como "250,5", "250,50" o "1,250.50", **When** se guarda, **Then** se interpreta como $250.50, $250.50 y $1,250.50 respectivamente.
7. **Given** el escritorio, **When** el dueño usa "Guardar y agregar otro" (o Shift+Enter), **Then** el gasto se guarda y el formulario queda abierto, vacío salvo la cuenta, la subcategoría y la fecha, con el foco en el monto.
8. **Given** los formularios de ingreso y de gasto fijo, **When** se abren para crear, **Then** el foco está en el monto; en un gasto fijo nuevo, el día de cargo por defecto es el día de hoy.
9. **Given** el formulario de una meta, **When** se calcula un monto mensual sugerido, **Then** aparece como valor del campo (editable), no como texto de ejemplo.
10. **Given** los campos enteros de Preferencias (días de pago, anticipación), **When** se editan en el teléfono, **Then** se abre el teclado numérico.

---

### User Story 2 - No perder nada ni borrar por error (Priority: P1)

Como dueño, quiero que si un guardado falla pueda reintentarlo sin volver a escribir, y que borrar un movimiento sea inmediato pero reversible con "Deshacer", sin diálogos de confirmación.

**Why this priority**: hoy el diálogo se cierra antes de saber si se guardó, así que un fallo de red pierde lo escrito. Además, cada borrado pide una confirmación que interrumpe.

**Independent Test**: con la red caída a la mitad de un guardado, el aviso de error ofrece "Reintentar", que reabre el diálogo con los mismos valores. Borrar un gasto lo quita al instante y muestra "Deshacer" durante 6 s; deshacer lo devuelve sin que se haya borrado en el servidor.

**Acceptance Scenarios**:

1. **Given** un gasto, ingreso o cuenta por cobrar a punto de guardarse, **When** el guardado falla (no por modo demo ni por estar sin conexión), **Then** aparece un aviso de error con la acción "Reintentar".
2. **Given** ese aviso, **When** el dueño toca "Reintentar", **Then** se reabre el mismo diálogo con todos los valores que había escrito (y, si era una edición, sobre el mismo registro).
3. **Given** un gasto, ingreso, pago de tarjeta o gasto fijo, **When** el dueño lo borra, **Then** desaparece de inmediato de la lista y de los saldos, sin diálogo de confirmación, y aparece un aviso con "Deshacer" durante 6 segundos.
4. **Given** el aviso de borrado, **When** el dueño toca "Deshacer" antes de que expire, **Then** el registro vuelve a su lugar y nunca se borró en el servidor.
5. **Given** el aviso de borrado, **When** expira o el dueño sale de la página o cierra la pestaña, **Then** el borrado se aplica en el servidor.
6. **Given** un borrado aplicado que falla en el servidor, **When** falla, **Then** el registro vuelve a aparecer y se muestra un error.
7. **Given** una categoría, subcategoría o cuenta con historial, **When** el dueño la borra o archiva, **Then** se sigue pidiendo confirmación, como hoy.
8. **Given** el modo demo, **When** el dueño intenta borrar, **Then** aparece el aviso de solo lectura y el registro no desaparece en ningún momento.

---

### User Story 3 - Toda página se recupera de un error (Priority: P1)

Como dueño, cuando la base de datos tarda o falla, quiero ver en cada página un mensaje claro con "Reintentar", no un esqueleto de carga eterno.

**Why this priority**: fuera del Dashboard, un error de carga deja la página cargando para siempre.

**Independent Test**: simular un error al leer los datos; Gastos, Bitácora, Ingresos, Crédito, Por cobrar, Gastos fijos, Metas y Patrimonio muestran el mensaje de error con "Reintentar", y al reintentar con éxito aparece el contenido.

**Acceptance Scenarios**:

1. **Given** una página que lee datos, **When** la lectura está en curso, **Then** muestra su esqueleto de carga.
2. **Given** una lectura que falla, **When** termina con error, **Then** la página muestra un mensaje de error traducido con el botón "Reintentar" en lugar del esqueleto.
3. **Given** el mensaje de error, **When** el dueño toca "Reintentar" y la lectura funciona, **Then** se muestra el contenido.

---

### User Story 4 - Listas cómodas en el teléfono (Priority: P2)

Como dueño, en el teléfono quiero tocar un gasto para editarlo (y borrarlo desde ahí), ver los movimientos agrupados por día y no tener filas llenas de iconos diminutos.

**Why this priority**: los iconos de lápiz y papelera en cada fila son objetivos pequeños y fáciles de tocar por error; las cuotas de Por cobrar obligan a desplazarse de lado.

**Independent Test**: a 390 px, en Gastos, tocar una fila abre la edición, que incluye "Borrar"; las filas están bajo encabezados "Hoy", "Ayer" o "mié 5 nov". En Por cobrar, las cuotas se ven como tarjetas sin desplazamiento horizontal.

**Acceptance Scenarios**:

1. **Given** la lista de Gastos en móvil, **When** el dueño toca un gasto, **Then** se abre su edición, que incluye la acción "Borrar"; las filas no muestran iconos de editar ni borrar.
2. **Given** la lista de Gastos en escritorio, **When** el puntero pasa sobre una fila o esta recibe el foco, **Then** se muestran sus acciones de editar y borrar.
3. **Given** la lista de Gastos, **When** se muestra, **Then** los movimientos están agrupados bajo encabezados de día: "Hoy", "Ayer" y luego la fecha corta con el día de la semana.
4. **Given** las plantillas de gasto rápido y las filas de taxonomía, **When** se muestran, **Then** sus acciones (editar, mover, archivar, borrar) están en un menú "⋯" por fila.
5. **Given** Por cobrar en móvil, **When** se muestran las cuotas de una compra, **Then** se ven como tarjetas apiladas sin desplazamiento horizontal; en escritorio se mantiene la tabla.

---

### User Story 5 - Encontrar y filtrar movimientos (Priority: P2)

Como dueño, quiero cambiar de quincena en Gastos desde el encabezado, filtrar por bucket o método de pago con un toque, y que la Bitácora recuerde sus filtros en el enlace, con atajos como "Esta quincena" y búsqueda por texto.

**Why this priority**: revisar en qué se fue el dinero es el segundo uso más común, y hoy la Bitácora pierde los filtros al recargar.

**Independent Test**: en Bitácora, elegir "Mes pasado" y buscar "uber" cambia el enlace; recargar o compartir el enlace muestra el mismo resultado. En Gastos, el chip "Gustos" deja solo gastos de Gustos.

**Acceptance Scenarios**:

1. **Given** la página de Gastos, **When** se ve el encabezado, **Then** incluye el selector de quincena, y cambiarlo actualiza el resumen y la lista de movimientos a esa quincena.
2. **Given** la lista de Gastos, **When** el dueño activa el chip de un bucket (Necesidades o Gustos) o de un método de pago, **Then** la lista muestra solo lo que coincide; con varios chips activos se aplican todos (bucket Y método); "Quitar filtros" los limpia.
3. **Given** la Bitácora, **When** el dueño cambia un filtro, un preset o la búsqueda, **Then** el enlace de la página refleja el estado y recargar lo conserva.
4. **Given** los presets "Esta quincena", "Quincena pasada", "Este mes" y "Mes pasado", **When** se elige uno, **Then** el rango de fechas se ajusta a ese periodo.
5. **Given** la búsqueda de texto, **When** el dueño escribe, **Then** la Bitácora muestra los movimientos cuya nota o descripción contiene el texto, sin distinguir mayúsculas ni acentos.
6. **Given** una fila de Bitácora de un gasto, ingreso o pago de tarjeta, **When** el dueño la toca, **Then** se abre la edición de ese movimiento.

---

### User Story 6 - Un Dashboard que lleva a la acción (Priority: P2)

Como dueño, quiero tocar un bucket para ver sus gastos y que el Dashboard me avise cuando una tarjeta está por vencer, con un botón para pagarla.

**Independent Test**: tocar "Gustos" en el Dashboard abre Gastos filtrado por Gustos. Con una tarjeta pendiente que vence en 3 días, aparece "Gold vence en 3 días" con "Pagar".

**Acceptance Scenarios**:

1. **Given** el Dashboard, **When** el dueño toca el encabezado de un bucket (o su enlace "Ver gastos"), **Then** se abre Gastos con el filtro de ese bucket activo.
2. **Given** una tarjeta con su último estado pendiente que vence en 7 días o menos (o vencido), **When** se ve el Dashboard, **Then** aparece una alerta "‹Tarjeta› vence en N días" (o "vencida") con el monto y "Pagar", que abre el pago prellenado.
3. **Given** que no hay tarjetas pendientes en ese plazo, **When** se ve el Dashboard, **Then** no aparece esa alerta.

---

### User Story 7 - Gastos rápidos administrados en Configuración (Priority: P3)

Como dueño, quiero administrar mis gastos rápidos en Configuración, con un enlace "Administrar" desde la hoja ＋, en lugar de tenerlos en medio de la página de Gastos.

**Independent Test**: en la hoja ＋, "Administrar" lleva a Configuración → Gastos rápidos, donde se crean, editan, reordenan y borran plantillas; la página de Gastos ya no muestra esa sección.

**Acceptance Scenarios**:

1. **Given** la hoja ＋ con gastos rápidos, **When** el dueño toca "Administrar", **Then** navega a Configuración → Gastos rápidos.
2. **Given** Configuración, **When** se ve el índice, **Then** incluye "Gastos rápidos" con su descripción.
3. **Given** la página de Gastos, **When** se ve, **Then** ya no incluye la sección de gestión de gastos rápidos.

---

### Edge Cases

- **Coma y punto juntos**: "1.234,50" (formato europeo) no se acepta; solo se acepta coma decimal cuando hay una sola coma seguida de 1 o 2 dígitos y ningún punto. "1,250" (coma seguida de 3 dígitos) sigue siendo mil doscientos cincuenta.
- **Varios borrados seguidos**: cada uno tiene su propio aviso y su propio "Deshacer"; los pendientes se aplican al expirar cada uno o al salir de la página.
- **Deshacer tras navegar dentro de la app**: el aviso sigue visible en la nueva página y "Deshacer" sigue funcionando hasta que expira.
- **Borrado sin conexión**: falla al instante con el aviso de sin conexión y el registro no desaparece (como hoy).
- **Reintentar tras cerrar el aviso**: si el aviso se cierra o expira, los valores se pierden (no se guardan borradores).
- **Reintentar con otro diálogo abierto**: reemplaza el diálogo abierto.
- **"Guardar y agregar otro" que falla**: el formulario ya se reinició para el siguiente gasto; el aviso de error con "Reintentar" reabre el diálogo con los valores del gasto que falló.
- **Sin historial**: no aparecen chips de subcategorías recientes.
- **Filtros sin resultados**: estado vacío con "Quitar filtros".
- **Parámetros inválidos en el enlace de Bitácora**: se ignoran y se usa el valor por defecto.
- **Alerta de tarjeta con privacidad**: el monto se enmascara.
- **Demo**: los valores recordados se pueden guardar en el dispositivo (no tocan el backend); borrar, guardar y reintentar muestran el aviso de solo lectura.

## Requirements *(mandatory)*

### Functional Requirements

**Recordar y prellenar**

- **FR-001**: El sistema MUST recordar en el dispositivo la última cuenta de pago y la última subcategoría usadas al guardar un gasto, la última cuenta de depósito de un ingreso y la última cuenta de origen de un pago de tarjeta.
- **FR-002**: Los formularios nuevos de gasto, ingreso, pago de tarjeta y gasto fijo MUST prellenar esos valores; un valor que apunta a una cuenta archivada o a algo que ya no existe MUST ignorarse.
- **FR-003**: Los valores que una página aporta (por ejemplo, tarjeta y monto al pagar desde Crédito) MUST tener prioridad sobre los recordados.

**Formulario de gasto**

- **FR-004**: La fecha del gasto MUST ofrecer los chips "Hoy" (por defecto), "Ayer" y "Otra"; "Otra" muestra un selector de fecha con máximo hoy.
- **FR-005**: El formulario MUST mostrar como chips hasta 6 subcategorías usadas más recientemente según el historial de gastos (sin repetir y sin archivadas), que seleccionan la subcategoría con un toque.
- **FR-006**: En escritorio, el formulario de gasto nuevo MUST ofrecer "Guardar y agregar otro" (también con Shift+Enter), que guarda y reinicia el formulario conservando cuenta, subcategoría y fecha, con el foco en el monto.

**Montos**

- **FR-007**: Los campos de monto MUST aceptar coma decimal cuando hay exactamente una coma seguida de 1 o 2 dígitos y ningún punto ("250,5" → 250.50); todos los formatos aceptados hoy MUST seguir funcionando igual.

**Errores y deshacer**

- **FR-008**: Cuando falla el guardado de un gasto, un ingreso o una cuenta por cobrar (salvo por modo demo o sin conexión, que ya tienen su aviso), el aviso de error MUST ofrecer "Reintentar", que reabre el diálogo con los valores enviados.
- **FR-009**: Borrar un gasto, un ingreso, un pago de tarjeta o un gasto fijo MUST aplicarse de inmediato en la interfaz sin confirmación y mostrar un aviso de 6 s con "Deshacer".
- **FR-010**: El borrado real MUST aplicarse al expirar el aviso, o antes si el dueño sale de la página o cierra la pestaña; "Deshacer" antes de eso MUST restaurar el registro sin llamar al servidor.
- **FR-011**: Si el borrado real falla, el registro MUST reaparecer y mostrarse un error.
- **FR-012**: Borrar o archivar categorías, subcategorías y cuentas con historial MUST seguir pidiendo confirmación.
- **FR-013**: En modo demo, borrar MUST mostrar el aviso de solo lectura sin quitar el registro de la interfaz.

**Estados de página**

- **FR-014**: Las páginas Gastos, Bitácora, Ingresos, Crédito, Por cobrar, Gastos fijos, Metas y Patrimonio MUST mostrar tres estados: cargando (esqueleto), error (mensaje traducido con "Reintentar") y contenido.

**Listas**

- **FR-015**: En móvil, tocar una fila de gasto MUST abrir su edición, y la edición de un gasto existente MUST incluir "Borrar" (que cierra el diálogo y usa el flujo de "Deshacer", sin confirmación); las filas MUST NOT mostrar iconos de editar ni borrar en móvil. En escritorio, las acciones aparecen al pasar el puntero o al recibir el foco.
- **FR-016**: La lista de Gastos MUST agruparse por día con encabezados "Hoy", "Ayer" y fecha corta con día de la semana.
- **FR-017**: Las filas de plantillas de gasto rápido y de taxonomía MUST agrupar sus acciones en un menú "⋯".
- **FR-018**: En móvil, las cuotas de Por cobrar MUST mostrarse como tarjetas; en escritorio, como tabla.

**Filtros**

- **FR-019**: El selector de quincena de Gastos MUST estar en el encabezado de la página y filtrar tanto el resumen por método de pago como la lista de movimientos (por defecto, la quincena actual).
- **FR-020**: Gastos MUST ofrecer chips de filtro por bucket (Necesidades, Gustos) y por método de pago (una opción por cuenta usada en la quincena, más "Sin especificar"), combinables, con "Quitar filtros". La quincena y los filtros MUST reflejarse en el enlace, de modo que el Dashboard pueda abrir Gastos filtrado y la recarga los conserve.
- **FR-021**: Los filtros de Bitácora MUST reflejarse en el enlace y restaurarse desde él; valores inválidos se ignoran.
- **FR-022**: Bitácora MUST ofrecer los presets "Esta quincena", "Quincena pasada", "Este mes" y "Mes pasado", y búsqueda por texto en nota y descripción, sin distinguir mayúsculas ni acentos.
- **FR-023**: Las filas de Bitácora de gastos, ingresos y pagos de tarjeta MUST abrir la edición del movimiento.

**Dashboard**

- **FR-024**: Cada bucket del Dashboard MUST ofrecer un enlace a Gastos filtrado por ese bucket.
- **FR-025**: El Dashboard MUST avisar de las tarjetas con su último estado pendiente que vence en 7 días o menos, o vencido. (Enmienda 2026-11-09: un solo aviso con el número de tarjetas y enlace a Crédito; el monto y "Ya la pagué" están en Crédito.)

**Detalles**

- **FR-026**: Los formularios nuevos de ingreso y de gasto fijo MUST enfocar el monto al abrirse; un gasto fijo nuevo MUST proponer como día de cargo el día de hoy.
- **FR-027**: Los campos enteros de Preferencias MUST abrir el teclado numérico.
- **FR-028**: El monto mensual sugerido de una meta MUST cargarse como valor editable del campo cuando el campo está vacío.
- **FR-029**: La gestión de gastos rápidos MUST vivir en Configuración → "Gastos rápidos", con un enlace "Administrar" en la hoja ＋, y salir de la página de Gastos.

**Transversales**

- **FR-030**: Todos los textos nuevos MUST existir en español e inglés; todo monto nuevo MUST enmascararse con el modo privacidad.
- **FR-031**: En modo demo, todo lo anterior MUST funcionar sin backend, y toda escritura MUST bloquearse con el aviso de solo lectura.
- **FR-032**: Los controles nuevos MUST tener un área táctil de al menos 44 × 44 px y foco visible.

### Key Entities

- **Último usado** (en el dispositivo): cuenta de pago, subcategoría, cuenta de depósito y cuenta de origen de pago. Son identificadores; no se guardan montos.
- **Borrado pendiente**: el registro quitado de la interfaz, el momento en que expira y la acción de borrado real. Vive solo en la sesión.
- **Filtros de Bitácora**: rango de fechas o preset, tipo de movimiento, cuenta y texto. Viven en el enlace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar un gasto repetido (misma cuenta y categoría, hoy) requiere solo escribir el monto y guardar: 2 interacciones después de abrir el formulario.
- **SC-002**: En el 100 % de los guardados fallidos (fuera de demo y sin conexión), el dueño puede recuperar lo escrito con 1 toque.
- **SC-003**: Borrar un movimiento no requiere confirmación y puede deshacerse durante 6 s en el 100 % de los casos.
- **SC-004**: El 100 % de las páginas con datos muestra un error recuperable en lugar de un esqueleto permanente.
- **SC-005**: Ninguna lista móvil requiere desplazamiento horizontal a 320 px.
- **SC-006**: Un enlace de Bitácora con filtros reproduce el mismo resultado al recargarlo.
- **SC-007**: La carga inicial de la app crece como máximo 20 kB respecto a la versión anterior.

## Assumptions

- Es trabajo solo de interfaz: los "últimos usados" se guardan en el dispositivo junto con las preferencias existentes; no hay cambios de esquema.
- "Reintentar" cubre las altas y ediciones de gasto, ingreso y cuenta por cobrar (prioridad del roadmap); los demás formularios conservan su comportamiento actual.
- Los 6 s del aviso de deshacer son los mismos que ya usan los gastos rápidos (spec 005).
- El modo demo rechaza el borrado **antes** de quitar el registro (no hay quitar-y-reponer).
- Los presets "Esta quincena" y "Quincena pasada" usan la quincena del sistema actual (1–15 y 16–fin de mes); el spec 006 podrá cambiarlo después.
- La búsqueda de Bitácora es local sobre los datos ya cargados.
- Los pagos de tarjeta no tienen edición hoy; sus filas de Bitácora no abren un diálogo (FR-023 se cumple para gastos e ingresos).
- El borrado diferido se confirma en `pagehide` como mejor esfuerzo: si el navegador cancela la petición al cerrar la pestaña, el registro sigue en el servidor y reaparece en la siguiente carga.
- La alerta de tarjeta usa el mismo estado de tarjeta que Crédito y Gastos (spec 008).
- Las verificaciones con backend local o en vivo se omiten por decisión del usuario; los flujos que escriben se prueban con e2e `@live` que no se ejecutan, y en demo se verifica el aviso de solo lectura.
- Depende de: spec 008 (diálogos únicos, hoja ＋, estado de tarjeta) y spec 005 (gastos rápidos y su deshacer).
