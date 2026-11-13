# Feature Specification: Usar lo Ahorrado en metas

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Spec 014: usar lo Ahorrado (spec 013) en metas. Asignación manual desde la tarjeta Ahorrado o desde una meta; 'Disponible para asignar' = total ahorrado − asignado + regresado, nunca negativo; nuevo tipo de meta 'Compra' (nombre, monto objetivo, fecha opcional, barra de progreso); lo ahorrado también puede ir al Fondo de emergencia y a Apartados; 'Lo compré' archiva la meta como cumplida; se puede regresar dinero de una meta a Ahorrado; Safe-to-Spend no cambia; el patrimonio no cambia al asignar ni al regresar; demo de solo lectura con una meta Compra de ejemplo; textos EN/ES."

## Clarifications

### Session 2026-11-13

- Q: ¿Qué pasa con el patrimonio al marcar "Lo compré"? → A: Baja por lo que la meta tenía asignado desde Ahorrado; no se registra un gasto aparte y el Safe-to-Spend no cambia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asignar lo ahorrado a una meta (Priority: P1)

Como dueño, quiero tomar parte de lo que tengo en Ahorrado y asignarlo a una meta, para que ese dinero tenga un propósito y no se quede solo como un número.

**Why this priority**: es el corazón de la función. En la spec 013 lo ahorrado solo se veía; ahora se puede usar.

**Independent Test**: con $2,327.90 de total ahorrado y nada asignado, asignar $1,000 a una meta existente desde la tarjeta Ahorrado; la tarjeta muestra "Disponible para asignar" $1,327.90 y la meta sube $1,000 en su avance.

**Acceptance Scenarios**:

1. **Given** el ajuste "Guardar el sobrante" encendido y $2,327.90 de total ahorrado sin asignar, **When** el dueño pulsa "Asignar" en la tarjeta Ahorrado, elige una meta y escribe $1,000, **Then** la meta suma $1,000 a su avance y "Disponible para asignar" pasa a $1,327.90.
2. **Given** una meta en la página de Metas, **When** el dueño pulsa "Asignar" en esa meta y escribe un monto, **Then** el resultado es el mismo que asignar desde la tarjeta Ahorrado, con esa meta ya elegida.
3. **Given** $1,327.90 disponibles para asignar, **When** el dueño intenta asignar $1,500, **Then** la app no lo permite y le dice cuánto tiene disponible.
4. **Given** una asignación hecha, **When** el dueño ve el Dashboard, **Then** el Safe-to-Spend de Necesidades, Gustos e Inversión es el mismo que antes de asignar, y el patrimonio también.
5. **Given** el modo privacidad activo, **When** el dueño ve "Disponible para asignar" o el avance de una meta, **Then** los montos están enmascarados.

---

### User Story 2 - Meta "Compra" con avance (Priority: P1)

Como dueño, quiero crear una meta para algo que quiero comprar (por ejemplo, una laptop de $25,000 para marzo), y ver cuánto llevo juntado con una barra de progreso.

**Why this priority**: es el destino natural de lo ahorrado. Sin un tipo de meta para compras, el dueño solo podría mandar el dinero al Fondo de emergencia o a un Apartado.

**Independent Test**: crear la meta Compra "Laptop", $25,000, fecha marzo 2027; asignarle $5,000; la meta muestra 20% de avance, $5,000 de $25,000 y la fecha.

**Acceptance Scenarios**:

1. **Given** la página de Metas, **When** el dueño crea una meta de tipo "Compra" con nombre, monto objetivo y sin fecha, **Then** la meta aparece con $0 de avance y sin fecha.
2. **Given** una meta Compra de $25,000 con $5,000 asignados, **When** el dueño la ve, **Then** la barra muestra 20% y el texto "$5,000 de $25,000".
3. **Given** una meta Compra con más asignado que su objetivo, **When** el dueño la ve, **Then** la barra se muestra llena (100%) y el monto real se sigue viendo.
4. **Given** una meta Compra con fecha, **When** el dueño la ve, **Then** se muestra el mes y año objetivo.
5. **Given** una meta Compra, **When** el dueño la edita, **Then** puede cambiar nombre, monto objetivo y fecha sin perder lo ya asignado.

---

### User Story 3 - Regresar dinero de una meta a Ahorrado (Priority: P2)

Como dueño, quiero quitar dinero de una meta y regresarlo a Ahorrado disponible, por si cambio de planes o asigné de más.

**Why this priority**: sin esto, una asignación equivocada no se puede corregir.

**Independent Test**: con $5,000 asignados a "Laptop", regresar $2,000; la meta queda en $3,000 y "Disponible para asignar" sube $2,000.

**Acceptance Scenarios**:

1. **Given** una meta con $5,000 asignados desde Ahorrado, **When** el dueño pulsa "Regresar" y escribe $2,000, **Then** la meta queda con $3,000 asignados desde Ahorrado y "Disponible para asignar" sube $2,000.
2. **Given** una meta con $3,000 asignados desde Ahorrado, **When** el dueño intenta regresar $4,000, **Then** la app no lo permite y le dice cuánto puede regresar.
3. **Given** un regreso hecho, **When** el dueño ve el Dashboard, **Then** el Safe-to-Spend y el patrimonio no cambian.

---

### User Story 4 - "Lo compré" (Priority: P2)

Como dueño, cuando ya hice la compra, quiero marcar la meta como cumplida para que salga de mis metas activas.

**Why this priority**: cierra el ciclo de una meta Compra.

**Independent Test**: marcar "Laptop" como comprada; desaparece de las metas activas y aparece entre las archivadas como cumplida.

**Acceptance Scenarios**:

1. **Given** una meta Compra activa, **When** el dueño pulsa "Lo compré", **Then** la meta se archiva marcada como cumplida.
2. **Given** una meta Compra cumplida, **When** el dueño ve las metas archivadas, **Then** la ve con la etiqueta "Cumplida" y lo que tenía asignado.
3. **Given** una meta Compra cumplida, **When** el dueño ve "Disponible para asignar", **Then** el dinero que tenía asignado no regresa a Ahorrado disponible.
4. **Given** una meta Compra cumplida por error, **When** el dueño la restaura, **Then** vuelve a estar activa con lo que tenía asignado.
5. **Given** una meta Compra cumplida, **When** el dueño ve su patrimonio, **Then** el patrimonio bajó por lo que la meta tenía asignado desde Ahorrado, y el Safe-to-Spend no cambió.

---

### User Story 5 - Ahorrado al Fondo de emergencia y a Apartados (Priority: P2)

Como dueño, quiero asignar lo ahorrado también a mi Fondo de emergencia o a un Apartado que ya tengo, para completarlos más rápido.

**Why this priority**: amplía el uso del ahorro a las metas que ya existen, sin crear nada nuevo.

**Independent Test**: asignar $1,000 de Ahorrado al Fondo de emergencia; su avance sube $1,000 además de sus aportaciones de cada quincena.

**Acceptance Scenarios**:

1. **Given** un Fondo de emergencia con $10,000 aportados por quincena, **When** el dueño le asigna $1,000 de Ahorrado, **Then** su avance muestra $11,000.
2. **Given** un Apartado con aportaciones por quincena, **When** el dueño le asigna $500 de Ahorrado, **Then** su avance sube $500 y la aportación de cada quincena no cambia.
3. **Given** una meta con aportaciones de quincena y asignaciones de Ahorrado, **When** el dueño pulsa "Regresar", **Then** solo puede regresar lo que vino de Ahorrado.

---

### User Story 6 - Demo y textos en dos idiomas (Priority: P3)

Como visitante del demo, quiero ver una meta Compra de ejemplo con dinero asignado desde Ahorrado, sin poder cambiar nada.

**Why this priority**: muestra la función a quien prueba la app; no afecta datos reales.

**Independent Test**: en el demo, la página de Metas muestra una meta Compra con avance, y la tarjeta Ahorrado muestra "Disponible para asignar"; pulsar "Asignar", "Regresar" o "Lo compré" muestra el aviso de solo lectura.

**Acceptance Scenarios**:

1. **Given** el demo, **When** el visitante abre Metas, **Then** hay una meta Compra de ejemplo con dinero asignado y su barra de progreso.
2. **Given** el demo, **When** el visitante pulsa "Asignar", "Regresar" o "Lo compré", **Then** aparece el aviso de solo lectura y nada cambia.
3. **Given** el idioma en inglés, **When** el dueño ve la función, **Then** los textos dicen "Purchase", "Assign", "Available to assign", "Return to Saved" y "I bought it".

---

### Edge Cases

- **Editar el pasado deja el disponible por debajo de lo asignado**: si un cambio en gastos o ingresos pasados baja el total ahorrado por debajo de lo ya asignado, "Disponible para asignar" muestra $0 con un aviso de que lo asignado supera lo ahorrado, nunca un número negativo. Las asignaciones no se borran solas; el dueño decide qué regresar.
- **Ajuste "Guardar el sobrante" apagado**: la tarjeta Ahorrado no se ve (spec 013), así que no hay "Asignar" en ella ni en las metas. Las asignaciones ya hechas se conservan y se siguen viendo en el avance de cada meta; al volver a encender el ajuste, "Disponible para asignar" las toma en cuenta.
- **Meta archivada (no cumplida)**: no se le puede asignar; sí se le puede regresar dinero a Ahorrado. Una meta **cumplida** no permite asignar ni regresar hasta que se restaure.
- **Borrar una meta con dinero de Ahorrado**: lo asignado desde Ahorrado vuelve a "Disponible para asignar".
- **Monto cero o negativo**: no se permite asignar ni regresar $0 o menos.
- **Divisa**: los montos se guardan en pesos; si el dueño ve la app en otra divisa, el monto que escribe se interpreta en la divisa de captura de siempre de la app.
- **Ahorrado de varias quincenas**: el disponible es uno solo; no importa de qué quincena vino el sobrante.
- **Fecha de una meta Compra en el pasado**: se permite y se muestra tal cual; no hay alertas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La tarjeta Ahorrado MUST mostrar "Disponible para asignar" = total ahorrado − total asignado + total regresado, junto a los montos de la spec 013.
- **FR-002**: "Disponible para asignar" MUST mostrarse como $0 con un aviso cuando el cálculo dé negativo; nunca un número negativo.
- **FR-003**: El dueño MUST poder asignar un monto a una meta activa desde la tarjeta Ahorrado (eligiendo la meta) o desde la propia meta.
- **FR-004**: La app MUST rechazar una asignación mayor que "Disponible para asignar" o menor o igual a cero, y decir el máximo permitido.
- **FR-005**: Las metas que reciben asignaciones MUST ser de tipo Compra, Fondo de emergencia o Apartado.
- **FR-006**: Debe existir un tipo de meta "Compra" con nombre (1–80 caracteres), monto objetivo mayor que cero y fecha objetivo opcional (mes y año).
- **FR-007**: Una meta Compra MUST mostrar una barra de progreso = asignado ÷ objetivo, tope 100%, con el monto asignado y el objetivo en texto.
- **FR-008**: Una meta Compra MUST NOT tener aportaciones automáticas por quincena; solo recibe dinero de Ahorrado.
- **FR-009**: El avance del Fondo de emergencia y de los Apartados MUST sumar lo asignado desde Ahorrado a sus aportaciones de quincena.
- **FR-010**: El dueño MUST poder regresar a Ahorrado disponible un monto de una meta, hasta lo que esa meta tiene neto desde Ahorrado (asignado − regresado). Las aportaciones de quincena no se pueden regresar por aquí.
- **FR-011**: "Lo compré" MUST archivar la meta Compra marcándola como cumplida. Lo asignado a una meta cumplida MUST NOT volver a "Disponible para asignar". Restaurarla la vuelve activa con lo que tenía.
- **FR-012**: Asignar y regresar MUST NOT cambiar el Safe-to-Spend de ningún bucket ni el patrimonio.
- **FR-013**: Cada asignación y regreso MUST guardarse con su meta, monto y fecha, para recalcular "Disponible para asignar" y el avance de cada meta.
- **FR-014**: Borrar una meta MUST devolver a "Disponible para asignar" lo que tenía neto desde Ahorrado.
- **FR-015**: Los montos nuevos MUST enmascararse en modo privacidad y mostrarse en la divisa elegida.
- **FR-016**: Todos los textos nuevos MUST estar en español e inglés.
- **FR-017**: El demo MUST traer una meta Compra de ejemplo con dinero asignado desde Ahorrado. Asignar, regresar, crear, editar o marcar "Lo compré" en el demo MUST mostrar el aviso de solo lectura.
- **FR-018**: Marcar "Lo compré" MUST restar del patrimonio lo que la meta tenía neto desde Ahorrado (el dinero se gastó), sin crear un gasto ni cambiar el Safe-to-Spend. Restaurar la meta MUST devolver ese monto al patrimonio. El dueño no debe registrar la compra también como gasto, o se contaría dos veces.

### Key Entities

- **Meta Compra** (nuevo tipo de meta): nombre, monto objetivo, fecha objetivo opcional, estado (activa, archivada, cumplida).
- **Movimiento de Ahorrado**: una asignación (Ahorrado → meta) o un regreso (meta → Ahorrado), con meta, monto positivo y fecha. Varios por meta y por quincena.
- **Disponible para asignar** (derivado, no se guarda): total ahorrado (spec 013) − asignaciones + regresos, mostrado con piso en $0.
- **Avance de una meta** (derivado): aportaciones de quincena + asignaciones − regresos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño puede asignar lo ahorrado a una meta en 3 pasos o menos desde el Dashboard (Asignar → elegir meta y monto → confirmar).
- **SC-002**: "Disponible para asignar" nunca se muestra negativo, en el 100% de los casos, incluso después de editar movimientos pasados.
- **SC-003**: El Safe-to-Spend y el patrimonio son idénticos antes y después de cualquier asignación o regreso, en el 100% de los casos. Al marcar "Lo compré", el patrimonio baja exactamente lo que la meta tenía neto desde Ahorrado.
- **SC-004**: Una asignación o un regreso se ve reflejado en la tarjeta Ahorrado y en la meta en menos de 1 segundo, sin recargar la página.
- **SC-005**: Todas las pruebas existentes del Safe-to-Spend, del patrimonio y de las metas siguen pasando sin cambios.

## Assumptions

- Esta función solo tiene sentido con el ajuste "Guardar el sobrante" (spec 013) encendido; sin él, "Asignar" no aparece.
- "Total asignado" y "total regresado" incluyen los movimientos de todas las metas, también las archivadas; solo borrar una meta saca sus movimientos de la cuenta.
- El monto se captura igual que en el resto de la app (formato y divisa de captura existentes).
- No hay asignación automática ni reglas; todo es manual, como decidió el dueño.
- La fecha objetivo de una meta Compra es informativa: no calcula cuánto apartar por quincena.
- Guardar asignaciones y el nuevo tipo de meta requiere una migración de base de datos. Se aplica a la nube solo con confirmación del dueño y antes de publicar el código que la usa.
