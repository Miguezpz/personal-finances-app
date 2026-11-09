# Feature Specification: Gastos rápidos (plantillas de 1 toque)

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Gastos rápidos (plantillas de 1 toque). El usuario repite gastos como el transporte público ($24 MXN por 2 viajes), pero solo los días que sale, así que no sirve un cargo recurrente automático. Quiere guardar plantillas de gasto (nombre, monto, subcategoría, método de pago opcional) y registrarlas con un solo toque desde el Dashboard. El toque crea un gasto con fecha de hoy y nota = nombre de la plantilla, baja el Safe-to-Spend al instante (optimista) y muestra un toast con Deshacer. Se permiten varios toques el mismo día. Las plantillas se crean, editan y borran desde Gastos o Ajustes, y el diálogo de gasto puede ofrecer 'Guardar como gasto rápido'. El bucket se hereda de la categoría de la subcategoría, como en los recurrentes. Debe funcionar en modo demo (con una plantilla de ejemplo 'Transporte $24') y en vivo (tabla nueva expense_templates con RLS). Textos en es y en."

## Clarifications

### Session 2026-11-05

- Q: ¿El botón de gasto rápido debe dejar elegir otra fecha cuando se olvidó registrar el gasto ese día? → A: Sí. El toque normal registra con la fecha de hoy; un menú secundario por botón permite registrar con otra fecha (ayer u otra).
- Q: ¿Cómo se registra un día con un monto distinto al de la plantilla (por ejemplo, 1 viaje de $12 en lugar de $24)? → A: El menú secundario también permite cambiar el monto (y la fecha) antes de registrar; el toque normal usa el monto de la plantilla y la plantilla no cambia.
- Q: ¿En qué lugares de la app deben estar los botones de gasto rápido? → A: En el Dashboard y, además, arriba del diálogo de nuevo gasto (que se abre desde cualquier página con el botón flotante del celular).

### Enmienda 2026-11-09

- Los gastos rápidos ya no aparecen en el Dashboard: solo donde se registra un gasto (arriba del diálogo de nuevo gasto y en la hoja ＋ del celular). Donde este spec dice "Dashboard" como lugar de los botones, léase "el diálogo de nuevo gasto". Sin plantillas no se muestra nada; se crean en Ajustes › Gastos rápidos. Reemplaza la clarificación de lugares, FR-006 y US2-6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un gasto repetido con un toque (Priority: P1)

Como dueño, los días que salgo pago $24 de transporte público (2 viajes). Quiero tocar un botón "Transporte $24" en el Dashboard y que el gasto quede registrado con la fecha de hoy, sin abrir el formulario ni escribir nada.

**Why this priority**: es el problema que origina la feature. Ya sirve con una sola plantilla creada.

**Independent Test**: con una plantilla "Transporte · $24 · Transporte público", tocar su botón en el Dashboard. Debe aparecer un gasto de $24 con fecha de hoy y nota "Transporte" en la lista de gastos, y el disponible de Needs debe bajar $24 en ese momento.

**Acceptance Scenarios**:

1. **Given** una plantilla guardada, **When** el dueño toca su botón en el Dashboard, **Then** se registra un gasto por el monto de la plantilla con fecha de hoy, la subcategoría y el método de pago de la plantilla, y el nombre de la plantilla como nota.
2. **Given** el toque anterior, **When** se registra el gasto, **Then** el Safe-to-Spend del bucket de esa subcategoría baja en ese mismo momento, sin esperar al servidor.
3. **Given** un gasto recién registrado por un toque, **When** aparece el aviso de confirmación, **Then** trae la acción **Deshacer**; **When** el dueño la toca, **Then** el gasto se elimina y el Safe-to-Spend regresa a su valor anterior.
4. **Given** que el dueño ya tocó el botón hoy, **When** lo toca otra vez, **Then** se registra un segundo gasto (un día puede tener varios).
5. **Given** que el guardado falla en el servidor, **When** llega el error, **Then** el gasto optimista se retira, el Safe-to-Spend se restablece y aparece un aviso de error traducido.
6. **Given** un gasto creado por un toque, **When** el dueño lo abre desde la lista de gastos, **Then** puede editarlo o borrarlo como cualquier gasto manual.
7. **Given** que el dueño olvidó registrar el transporte ayer, **When** abre el menú secundario del botón y elige "Ayer" (u otra fecha), **Then** se registra el gasto de la plantilla con esa fecha, con el mismo aviso y Deshacer, y descuenta de la quincena a la que pertenece esa fecha.
8. **Given** que el dueño está en cualquier página en el celular, **When** abre el botón flotante de agregar gasto y toca "Transporte $24" arriba del formulario, **Then** se registra el gasto con fecha de hoy, el diálogo se cierra y aparece el aviso con Deshacer.
9. **Given** que hoy el dueño solo hizo 1 viaje, **When** abre el menú secundario, elige "Registrar con otro monto o fecha" y cambia el monto a $12, **Then** se registra un gasto de $12 con fecha de hoy y la plantilla sigue en $24.

---

### User Story 2 - Administrar mis gastos rápidos (Priority: P1)

Como dueño, quiero crear, editar, reordenar y borrar mis gastos rápidos (nombre, monto, subcategoría y método de pago opcional) para tener a la mano los que repito.

**Why this priority**: sin una forma de crear plantillas, la historia 1 no se puede usar en vivo.

**Independent Test**: crear la plantilla "Transporte · $24", comprobar que aparece en el Dashboard; editar el monto a $30 y comprobar que el botón muestra $30; borrarla y comprobar que desaparece sin afectar los gastos ya registrados con ella.

**Acceptance Scenarios**:

1. **Given** la sección de gastos rápidos, **When** el dueño captura nombre, monto y subcategoría (y opcionalmente el método de pago) y guarda, **Then** la plantilla aparece en la sección y en el Dashboard.
2. **Given** el formulario, **When** falta el nombre, el monto no es un número positivo o falta la subcategoría, **Then** no se guarda y cada campo muestra su mensaje traducido.
3. **Given** una plantilla, **When** el dueño cambia su monto, nombre, subcategoría o método de pago, **Then** los toques siguientes usan los datos nuevos y los gastos ya registrados no cambian.
4. **Given** una plantilla, **When** el dueño la borra, **Then** deja de mostrarse y los gastos registrados con ella se conservan intactos.
5. **Given** varias plantillas, **When** el dueño cambia su orden, **Then** el Dashboard las muestra en ese orden.
6. ~~**Given** que el dueño no tiene plantillas, **When** abre el Dashboard, **Then** ve un acceso discreto para crear su primer gasto rápido~~ (enmienda 2026-11-09: sin plantillas no se muestra nada; se crean en Ajustes).

---

### User Story 3 - Guardar un gasto como gasto rápido (Priority: P2)

Como dueño, al registrar un gasto a mano quiero marcar "Guardar como gasto rápido" para convertirlo en plantilla sin capturarlo dos veces.

**Why this priority**: ahorra pasos, pero la historia 2 ya permite crear plantillas.

**Independent Test**: en el diálogo de nuevo gasto, capturar $24 en Transporte público con nota "Transporte", marcar la opción y guardar. Deben existir el gasto y una plantilla "Transporte · $24".

**Acceptance Scenarios**:

1. **Given** el diálogo de nuevo gasto con la opción marcada, **When** el dueño guarda, **Then** se registra el gasto y se crea una plantilla con su monto, subcategoría y método de pago; el nombre es la nota del gasto o, si está vacía, el nombre de la subcategoría.
2. **Given** el diálogo en modo edición de un gasto existente, **When** se abre, **Then** la opción no se muestra.

---

### Edge Cases

- La subcategoría de una plantilla se archiva: la plantilla sigue visible pero marcada como no disponible y no se puede usar hasta elegir otra subcategoría.
- El método de pago de una plantilla se archiva: el toque registra el gasto sin método de pago y la plantilla lo indica para que el dueño lo actualice.
- El método de pago es una tarjeta de crédito: el gasto sube la deuda de la tarjeta igual que un gasto manual con esa tarjeta.
- Toques muy rápidos seguidos: cada toque registra un gasto; el botón Deshacer de cada aviso deshace solo su propio gasto.
- El dueño toca Deshacer después de que el aviso se cierra: ya no hay acción; puede borrar el gasto desde la lista.
- "Hoy" es la fecha de negocio en la zona horaria del usuario, no la del navegador ni la del servidor.
- Registrar con una fecha pasada de otra quincena: el gasto descuenta de esa quincena (y de las siguientes a través del arrastre), igual que un gasto manual con fecha pasada.
- Modo demo: el Dashboard muestra la plantilla de ejemplo "Transporte $24"; tocarla, o crear, editar o borrar plantillas, se bloquea con el aviso de solo lectura, como cualquier otra edición.
- Modo privacidad: el monto del botón se oculta como cualquier otra cantidad; el nombre sigue visible.
- Nombre muy largo: el botón lo recorta visualmente sin romper el diseño en móvil.
- Muchas plantillas: la fila del Dashboard se desplaza horizontalmente sin generar scroll horizontal de la página.
- El historial exportado a CSV incluye los gastos creados por toque como gastos manuales normales.

## Requirements *(mandatory)*

### Functional Requirements

**Plantillas**

- **FR-001**: El dueño MUST poder crear plantillas de gasto con nombre (1–40 caracteres), monto en MXN mayor que cero, subcategoría y método de pago opcional.
- **FR-002**: El dueño MUST poder editar, reordenar y borrar sus plantillas. Borrar o editar una plantilla MUST NOT modificar los gastos ya registrados con ella.
- **FR-003**: Las plantillas MUST NOT guardar un bucket propio: el bucket del gasto MUST tomarse de la categoría de la subcategoría en el momento del toque, igual que en los gastos recurrentes.
- **FR-004**: Las plantillas MUST ser privadas del dueño: ningún otro usuario puede verlas ni modificarlas.
- **FR-005**: Se permiten hasta 12 plantillas activas por usuario.

**Registro con un toque**

- **FR-006**: ~~El Dashboard MUST mostrar las plantillas activas~~ (enmienda 2026-11-09) El Dashboard MUST NOT mostrar gastos rápidos; las plantillas activas aparecen como botones con nombre y monto, en el orden elegido por el dueño, solo en el diálogo de nuevo gasto y la hoja ＋ (FR-006a).
- **FR-006a**: El diálogo de nuevo gasto (el que abren el botón del Dashboard y el botón flotante del celular en cualquier página) MUST mostrar arriba del formulario los mismos botones. Tocar uno registra el gasto (FR-007) y cierra el diálogo. En el diálogo de edición de un gasto no aparecen. Sin plantillas activas, el diálogo no muestra la fila.
- **FR-007**: Un toque MUST registrar un gasto con el monto, la subcategoría y el método de pago de la plantilla, la fecha de negocio de hoy y el nombre de la plantilla como nota. El gasto es un gasto manual: se edita, se borra y se exporta como cualquier otro.
- **FR-007a**: Cada botón MUST ofrecer un menú secundario, accesible con teclado y lector de pantalla, con dos acciones:
  - "Ayer": registra la plantilla con la fecha de ayer.
  - "Registrar con otro monto o fecha": abre un formulario corto con el monto y la fecha prellenados (monto de la plantilla, fecha de hoy). El monto debe ser mayor que cero y la fecha no puede ser futura.

  El gasto resultante usa la subcategoría, el método de pago y la nota de la plantilla. La plantilla MUST NOT cambiar.
- **FR-008**: El Safe-to-Spend MUST reflejar el gasto en el mismo momento del toque, y MUST revertirse si el guardado falla.
- **FR-009**: Cada toque MUST mostrar un aviso de confirmación con la acción Deshacer durante al menos 5 segundos; Deshacer MUST eliminar exactamente ese gasto.
- **FR-010**: Varios toques en el mismo día MUST registrar varios gastos.
- **FR-011**: Una plantilla cuya subcategoría está archivada MUST mostrarse deshabilitada con una indicación del motivo.

**Atajo desde el diálogo de gasto**

- **FR-012**: El diálogo de nuevo gasto MUST ofrecer la opción "Guardar como gasto rápido", que crea la plantilla junto con el gasto (FR-001), nombrada con la nota o, si está vacía, con el nombre de la subcategoría.

**Demo, idioma y privacidad**

- **FR-013**: El demo MUST incluir la plantilla de ejemplo "Transporte · $24" en una subcategoría de transporte. En demo, toda mutación (toque, alta, edición, borrado, reorden) MUST bloquearse con el aviso de solo lectura.
- **FR-014**: Todos los textos nuevos MUST existir en inglés y en español.
- **FR-015**: El modo privacidad MUST ocultar los montos de las plantillas en todas las vistas.

### Key Entities

- **Plantilla de gasto (gasto rápido)**: pertenece a un usuario. Tiene nombre, monto en MXN, subcategoría, método de pago opcional, posición en el orden y estado (activa o borrada). No guarda bucket ni fecha.
- **Gasto** (existente): un toque crea un gasto manual normal. No queda ligado a la plantilla: borrar la plantilla no lo afecta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar el transporte del día toma 2 toques (＋ o "Nuevo › Gasto", y la plantilla; enmienda 2026-11-09), frente a abrir el formulario y llenar 4 campos hoy.
- **SC-002**: El disponible del Dashboard cambia en menos de 100 ms después del toque, sin esperar al servidor.
- **SC-003**: Deshacer un toque deja el disponible y la lista de gastos exactamente como estaban antes (0 centavos de diferencia).
- **SC-004**: En un mes con 20 días de salida, el dueño registra los 20 gastos de transporte sin abrir el formulario de gasto ni una vez.
- **SC-005**: La fila de gastos rápidos se usa en una pantalla de 360 px de ancho sin scroll horizontal de la página y con botones de al menos 44 px de alto.

## Assumptions

- Los gastos rápidos son atajos manuales: no hay registro automático ni calendario. Los gastos automáticos siguen siendo los Recurrentes mensuales que ya existen.
- El monto de la plantilla es el total por toque ($24 = 2 viajes); no se modela "número de usos × tarifa". Un día con otro monto se registra desde el menú secundario (FR-007a).
- La sección de administración vive en la página de Gastos; Ajustes puede enlazar a ella.
- Borrar una plantilla puede ser un borrado lógico (archivada); para el dueño simplemente desaparece.
- El gasto creado por un toque no guarda referencia a la plantilla; se reconoce por su nota.
- Las cuentas en vivo empiezan sin plantillas; solo el demo trae la de ejemplo.
- Se reutilizan el registro de gastos, el cálculo de Safe-to-Spend, la taxonomía y la zona horaria que ya existen.
- El límite de 12 plantillas es una salvaguarda de diseño de la fila del Dashboard, no un límite técnico.
