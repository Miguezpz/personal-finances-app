# Feature Specification: Ingreso eventual a un solo bucket

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Spec 015: cuando registro un ingreso que no es quincena o salario, la app debe dejarme decidir si lo sumo a Wants, Needs o Investment de esa quincena, para aumentar la capacidad de gasto que yo quiera."

## Clarifications

### Session 2026-11-21

- Q: ¿Qué es "un ingreso que no es quincena o salario"? → A (supuesto, a confirmar con el dueño): un ingreso de frecuencia **Eventual**, que es donde hoy aparece la pregunta de cómo repartirlo. Un ingreso **Fijo** (el salario) sigue repartiéndose por reglas. Si el dueño prefiere que dependa del *tipo* de ingreso (cualquiera distinto de Salario), solo cambia la condición que muestra la pregunta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mandar un ingreso eventual a Gustos o Necesidades (Priority: P1)

Como dueño, cuando me llega un ingreso extra (un regalo, un cashback, una venta), quiero sumarlo entero a Gustos o a Necesidades de la quincena que financia, para tener más margen de gasto en ese bucket sin repartirlo por mis porcentajes.

**Why this priority**: es el corazón de la función. Hoy un ingreso eventual solo se reparte por reglas o se registra sin repartir, y en ese caso no cuenta para el Safe-to-Spend.

**Independent Test**: con el Safe-to-Spend de Gustos de la quincena actual en $1,000, registrar un regalo eventual de $500 que se suma a Gustos; Gustos muestra $1,500 disponibles y Necesidades no cambia.

**Acceptance Scenarios**:

1. **Given** el formulario de ingreso con frecuencia Eventual, **When** el dueño lo abre, **Then** ve tres opciones: repartir según mis reglas, sumarlo a un solo bucket y registrarlo sin repartir.
2. **Given** la opción "Sumarlo a un solo bucket" con Gustos elegido y $500, **When** guarda, **Then** el disponible de Gustos de la quincena financiada sube $500 y los otros buckets no cambian.
3. **Given** la misma opción con Necesidades elegido, **When** guarda, **Then** sube el disponible de Necesidades.
4. **Given** que no hay regla de distribución configurada, **When** el dueño elige "Sumarlo a un solo bucket", **Then** puede guardar sin configurar reglas.
5. **Given** la vista previa, **When** el dueño cambia el bucket o el monto, **Then** la vista previa muestra una sola línea con el bucket y el monto.

---

### User Story 2 - Mandar un ingreso eventual a Inversión (Priority: P2)

Como dueño, quiero poder mandar un ingreso eventual a Inversión, eligiendo el vehículo, para invertirlo entero.

**Why this priority**: lo pidió el dueño, pero no sube la capacidad de gasto (Inversión nunca entra al Safe-to-Spend).

**Independent Test**: registrar un ingreso eventual de $1,000 a Inversión en un vehículo; el patrimonio sube $1,000 y el Safe-to-Spend de Necesidades y Gustos no cambia.

**Acceptance Scenarios**:

1. **Given** "Sumarlo a un solo bucket" con Inversión elegido, **When** el dueño ve el formulario, **Then** debe elegir un vehículo entre sus cuentas de inversión activas, y ve la nota de que Inversión no aumenta el gasto disponible.
2. **Given** que el dueño no tiene cuentas de inversión, **When** abre el formulario, **Then** la opción Inversión está deshabilitada con un aviso.
3. **Given** un ingreso guardado en Inversión, **When** el dueño ve el Dashboard, **Then** el Safe-to-Spend no cambia y el patrimonio sube por el monto.

---

### User Story 3 - Editar un ingreso mandado a un bucket (Priority: P2)

Como dueño, quiero editar ese ingreso (monto, bucket, quincena) sin que la app lo vuelva a repartir por mis reglas.

**Why this priority**: sin esto, editar corrompería el ingreso.

**Independent Test**: registrar $500 a Gustos, abrir Editar, ver "Sumarlo a un solo bucket" con Gustos preseleccionado, cambiarlo a Necesidades y guardar.

**Acceptance Scenarios**:

1. **Given** un ingreso mandado a un bucket, **When** el dueño lo edita, **Then** el formulario abre con esa opción, el bucket y el vehículo ya elegidos.
2. **Given** el cambio de Gustos a Necesidades, **When** guarda, **Then** el disponible de Gustos baja y el de Necesidades sube por el monto.
3. **Given** un ingreso repartido por reglas, **When** el dueño lo edita, **Then** sigue recalculándose con su regla original, como hoy.
4. **Given** un ingreso mandado a un bucket, **When** el dueño lo elimina, **Then** los saldos se recalculan como con cualquier ingreso.

---

### Edge Cases

- **Quincena financiada distinta a la actual**: el monto va a la quincena elegida en "Financia la quincena"; el carry de las siguientes se recalcula.
- **Guardar el sobrante encendido (spec 013)**: el monto sumado a un bucket de una quincena pasada que cierra con saldo positivo se mueve a Ahorrado como cualquier otro saldo.
- **Monto cero o negativo**: se rechaza como hoy.
- **Cambiar de frecuencia Eventual a Fijo al editar**: el ingreso vuelve a repartirse por reglas.
- **Vehículo archivado**: si el vehículo de un ingreso existente se archivó, el formulario lo conserva visible al editar; no se ofrece para ingresos nuevos.
- **Demo**: guardar muestra el aviso de solo lectura.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Para un ingreso eventual, el formulario MUST ofrecer tres modos: repartir según reglas, sumarlo a un solo bucket y registrarlo sin repartir.
- **FR-002**: El modo "un solo bucket" MUST permitir elegir Necesidades, Gustos o Inversión.
- **FR-003**: Al guardar en ese modo, el ingreso MUST quedar repartido (`distributed = true`) sin regla (`ruleId = null`) y con una sola asignación por el monto completo, en la quincena financiada.
- **FR-004**: Con Necesidades o Gustos, el disponible de ese bucket en la quincena financiada MUST subir exactamente el monto; los demás buckets MUST NOT cambiar.
- **FR-005**: Con Inversión, el dueño MUST elegir un vehículo (cuenta de inversión activa); el Safe-to-Spend MUST NOT cambiar y el formulario MUST avisar que Inversión no aumenta el gasto disponible.
- **FR-006**: El modo "un solo bucket" MUST estar disponible aunque no haya regla de distribución configurada.
- **FR-007**: La vista previa MUST mostrar una sola línea (bucket, vehículo si aplica, monto), calculada por la misma función que se guarda.
- **FR-008**: Al editar, el modo MUST derivarse del ingreso (repartido y sin regla = un solo bucket) y el bucket y el vehículo MUST venir preseleccionados. Editar MUST NOT volver a repartir ese ingreso por reglas.
- **FR-009**: Un ingreso repartido por reglas o sin repartir MUST seguir funcionando igual que antes.
- **FR-010**: Un ingreso Fijo MUST seguir repartiéndose por reglas por defecto, sin la pregunta nueva.
- **FR-011**: La suma de las asignaciones MUST seguir siendo igual al monto del ingreso (SC-001 de la spec 001).
- **FR-012**: Los textos nuevos MUST estar en español e inglés, con paridad.
- **FR-013**: El demo MUST traer un ingreso eventual de ejemplo mandado a Gustos. Guardar en el demo MUST mostrar el aviso de solo lectura.
- **FR-014**: Si guardar falla, "Reintentar" MUST conservar el modo, el bucket y el vehículo elegidos.

### Key Entities

- **Ingreso mandado a un bucket**: un ingreso existente (`distributed = true`, `ruleId = null`) con una sola asignación. No hay entidad ni columna nueva.
- **Modo de reparto** (derivado en el formulario): reglas, un solo bucket o sin repartir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño registra un ingreso eventual y lo manda a un bucket en 4 pasos o menos desde "Registrar ingreso".
- **SC-002**: El disponible del bucket elegido sube exactamente el monto en la quincena financiada, en el 100% de los casos; el de los otros buckets no cambia.
- **SC-003**: Σ asignaciones = monto en el 100% de los ingresos, también tras editar.
- **SC-004**: El cambio se ve en el Dashboard en menos de 1 segundo, sin recargar.
- **SC-005**: Todas las pruebas existentes de ingresos, splitter y Safe-to-Spend siguen pasando sin cambios.

## Assumptions

- **No hay migración**: la base ya acepta un ingreso repartido sin regla con una sola asignación (el contrato de datos ya lo prueba) y exige vehículo cuando el bucket es Inversión.
- El Safe-to-Spend, el carry y "Guardar el sobrante" ya suman las asignaciones por quincena; no se tocan.
- Bucket por defecto del modo nuevo: Gustos (el dueño puede cambiarlo).
- No hay porcentajes personalizados por ingreso; para eso sigue estando repartir por reglas.
- El monto se captura con el formato y la divisa de captura de siempre.
