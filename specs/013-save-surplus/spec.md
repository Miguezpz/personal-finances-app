# Feature Specification: Ahorrado de la quincena

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Me gustaría crear un apartado de ahorrado en la última quincena, y que no se sume a lo disponible para pagar en las próximas quincenas. Decisiones acordadas: solo el sobrante va a Ahorrado; un faltante (sobregiro) se sigue restando de la siguiente quincena; lo ahorrado solo se ve, no se usa; es un ajuste que se enciende y apaga en Preferencias."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lo que sobra se guarda y no infla la quincena siguiente (Priority: P1)

Como dueño, cuando termina una quincena y me sobra dinero en Necesidades o en Gustos, quiero que ese sobrante pase a "Ahorrado" y no se sume a lo disponible de la quincena nueva. Así lo que veo para gastar es solo lo que asigné de mi ingreso nuevo.

**Why this priority**: es lo que pidió el dueño. El 13 de nov de 2026, Necesidades + Gustos sumaban casi todo su ingreso porque incluían $2,327.90 que sobraron de la quincena anterior, y parecía que la Inversión no se había apartado.

**Independent Test**: con el ajuste encendido, una quincena que cerró con $400 de sobra en Gustos hace que la quincena siguiente muestre en Gustos solo lo asignado, y que "Ahorrado de la quincena pasada" muestre $400.

**Acceptance Scenarios**:

1. **Given** el ajuste encendido y una quincena que cerró con $1,378.94 de sobra en Necesidades y $948.96 en Gustos, **When** el dueño abre el Dashboard en la quincena siguiente, **Then** el arrastre de ambos buckets es $0 y "Ahorrado de la quincena pasada" muestra $2,327.90.
2. **Given** los datos del dueño del 13 de nov de 2026 con el ajuste encendido, **When** abre el Dashboard, **Then** Necesidades muestra $2,442.87 (lo asignado, $2,941.87, menos el Gym de $499 reservado) y Gustos $1,470.93.
3. **Given** el ajuste encendido y una quincena que cerró con −$400 en Gustos (sobregiro), **When** empieza la siguiente, **Then** Gustos arrastra −$400, igual que hoy, y Ahorrado no cambia por ese bucket.
4. **Given** una quincena que cerró con sobra en Gustos y faltante en Necesidades, **When** empieza la siguiente, **Then** solo el sobrante de Gustos va a Ahorrado y el faltante de Necesidades se sigue restando.
5. **Given** varias quincenas cerradas con sobrantes, **When** el dueño ve el Dashboard, **Then** "Total ahorrado" es la suma de todos los sobrantes de las quincenas cerradas.
6. **Given** la quincena actual todavía en curso, **When** el dueño ve el Dashboard, **Then** lo que lleva sin gastar en la quincena actual sigue en el disponible. Solo pasa a Ahorrado cuando la quincena termina.

---

### User Story 2 - Encender o apagar el ajuste (Priority: P1)

Como dueño, quiero elegir en Preferencias si lo que sobra se arrastra a la siguiente quincena (como hoy) o se guarda en Ahorrado, para decidir cómo quiero ver mi dinero.

**Why this priority**: el dueño pidió que sea un ajuste. Sin el interruptor, la historia 1 no se puede activar.

**Independent Test**: en Preferencias, encender "Guardar el sobrante de cada quincena"; el Dashboard pasa el arrastre positivo a Ahorrado sin recargar la página. Al apagarlo, todo regresa a como estaba.

**Acceptance Scenarios**:

1. **Given** un usuario nuevo o existente, **When** abre Preferencias, **Then** el ajuste aparece apagado y la app se comporta igual que antes de esta función.
2. **Given** el ajuste apagado, **When** el dueño lo enciende y guarda, **Then** el Dashboard muestra la tarjeta "Ahorrado" y recalcula los arrastres de todo el historial, sin recargar.
3. **Given** el ajuste encendido, **When** el dueño lo apaga, **Then** la tarjeta "Ahorrado" desaparece y los sobrantes vuelven a sumarse a las quincenas siguientes.
4. **Given** el modo demo, **When** el visitante intenta cambiar el ajuste, **Then** aparece el aviso de solo lectura y el ajuste no cambia.

---

### User Story 3 - Ver lo ahorrado con privacidad y en ambos idiomas (Priority: P2)

Como dueño, quiero ver en el Dashboard cuánto ahorré la quincena pasada y el total acumulado, ocultos en modo privacidad, en español y en inglés.

**Why this priority**: es la forma en que se ve lo ahorrado. Depende de la historia 1.

**Independent Test**: en el demo, que trae el ajuste encendido, el Dashboard muestra la tarjeta "Ahorrado" con los dos montos; con el modo privacidad activo, ninguno se puede leer.

**Acceptance Scenarios**:

1. **Given** el ajuste encendido, **When** el dueño ve el Dashboard, **Then** hay una tarjeta "Ahorrado" con "Quincena pasada" y "Total ahorrado".
2. **Given** el modo privacidad activo, **When** el dueño ve la tarjeta, **Then** los dos montos están enmascarados.
3. **Given** el idioma en inglés, **When** el dueño ve la tarjeta, **Then** dice "Saved", "Last pay period" y "Total saved".
4. **Given** que ninguna quincena cerrada ha tenido sobrante, **When** el dueño ve la tarjeta, **Then** ambos montos son $0.00.

---

### Edge Cases

- **Primera quincena con datos**: no tiene quincena anterior, así que "Quincena pasada" es $0.
- **Quincena cerrada sin movimientos** (sin ingreso ni gastos): no genera ahorro. Si se arrastraba un faltante, se sigue arrastrando.
- **Editar o borrar un gasto de una quincena pasada**: Ahorrado y los arrastres se recalculan, porque nada de esto se guarda.
- **Fechas de la quincena**: se usan los rangos efectivos de la spec 006 (del día de pago real al día anterior al siguiente).
- **Inversión**: no cambia. Lo asignado a Inversión nunca entra al disponible ni a Ahorrado.
- **Aportaciones a metas**: siguen restándose del bucket en su quincena. Solo lo que queda después de restarlas puede ir a Ahorrado.
- **Patrimonio**: es el mismo con el ajuste encendido o apagado. El total ahorrado cuenta como activo en lugar del disponible que dejó de sumar.
- **Exportación CSV**: incluye el estado del ajuste junto con las demás preferencias.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Preferencias MUST tener un ajuste "Guardar el sobrante de cada quincena en Ahorrado". Está **apagado por defecto** y se guarda por usuario.
- **FR-002**: Con el ajuste apagado, el Safe-to-Spend MUST comportarse exactamente igual que antes de esta función.
- **FR-003**: Con el ajuste encendido, el arrastre de cada bucket (Necesidades, Gustos) hacia la siguiente quincena MUST ser el menor entre su cierre y cero: solo se arrastran los faltantes.
- **FR-004**: Con el ajuste encendido, lo ahorrado de cada bucket en cada quincena cerrada MUST ser el mayor entre su cierre y cero.
- **FR-005**: El Dashboard MUST mostrar, con el ajuste encendido, una tarjeta "Ahorrado" con:
  - **Quincena pasada**: la suma de lo ahorrado en ambos buckets en la quincena anterior a la actual.
  - **Total ahorrado**: la suma de lo ahorrado en todas las quincenas cerradas.
- **FR-006**: Con el ajuste apagado, la tarjeta "Ahorrado" MUST NOT mostrarse.
- **FR-007**: Lo ahorrado MUST ser solo informativo. No se puede gastar ni mover a un bucket o a una meta desde la app.
- **FR-008**: Ahorrado y los arrastres MUST calcularse a partir de los movimientos guardados, sin guardar montos nuevos. Encender, apagar o editar un movimiento pasado recalcula todo el historial.
- **FR-009**: El patrimonio MUST contar el total ahorrado como activo, para que no cambie al encender o apagar el ajuste.
- **FR-010**: Los montos de la tarjeta "Ahorrado" MUST enmascararse en modo privacidad y MUST mostrarse en la divisa elegida.
- **FR-011**: Todos los textos nuevos MUST estar en español e inglés.
- **FR-012**: La exportación CSV de preferencias MUST incluir el estado del ajuste.
- **FR-013**: El demo MUST traer el ajuste encendido para que la tarjeta "Ahorrado" se vea. Cambiarlo en el demo MUST mostrar el aviso de solo lectura.

### Key Entities

- **Preferencias del usuario**: ganan un sí/no, "guardar sobrante", apagado por defecto.
- **Ahorrado** (derivado, no se guarda): por bucket y quincena cerrada, el cierre positivo. Se resume como "Quincena pasada" y "Total ahorrado".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el ajuste encendido, el disponible de Necesidades y Gustos al empezar una quincena es igual a lo asignado en esa quincena menos los faltantes arrastrados y los cargos fijos reservados, en el 100% de los casos.
- **SC-002**: Con los datos del dueño del 13 de nov de 2026 y el ajuste encendido, el Dashboard muestra Necesidades $2,442.87, Gustos $1,470.93 y Ahorrado de la quincena pasada $2,327.90.
- **SC-003**: Encender o apagar el ajuste se refleja en el Dashboard en menos de 1 segundo, sin recargar la página.
- **SC-004**: El patrimonio no cambia al encender o apagar el ajuste.
- **SC-005**: Con el ajuste apagado, todas las pruebas existentes del Safe-to-Spend siguen pasando sin cambios.

## Assumptions

- "Sobrante" es el cierre de la quincena en cada bucket: lo asignado más el arrastre, menos los gastos, los cargos fijos aplicados y las aportaciones a metas.
- La quincena actual no se considera cerrada hasta que empieza la siguiente (según los rangos de la spec 006).
- El ajuste aplica a todo el historial; no hay una fecha de inicio.
- Usar lo ahorrado (pasarlo a un bucket o a una meta) queda fuera de alcance y puede ser una spec futura.
- Para guardar el ajuste se agrega un campo a las preferencias, y eso requiere una migración de la base de datos. Se aplica a la nube solo con confirmación del dueño y antes de publicar el código que lo usa.
