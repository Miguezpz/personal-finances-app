# Feature Specification: Quincena según el día real de pago

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Spec 006 — Quincena según el día real de pago. Hoy, viernes 13 de noviembre de 2026 (el 15 cae en domingo), me pagaron la quincena, pero el Dashboard sigue mostrando la quincena anterior: el ingreso nuevo no aparece en Necesidades ni en Gustos y los gastos de hoy se restan del dinero de la quincena pasada. Quiero que el Safe-to-Spend se actualice el mismo día en que cobro y que los gastos de ese día se descuenten del ingreso nuevo. Decisiones acordadas: la quincena empieza el día en que cae el dinero que la financia (también en días de pago normales); si el día de pago cae en sábado o domingo, se paga el viernes anterior; solo fines de semana, sin días feriados; la fecha de recepción de un ingreso de quincena corrige el inicio (±7 días); sin cambios en la base de datos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El disponible cambia el día en que cobro (Priority: P1)

Como dueño, cuando me depositan la quincena quiero que el Dashboard muestre ese mismo día la quincena nueva, con el disponible de Necesidades y de Gustos calculado con el ingreso nuevo. Así sé cuánto puedo gastar sin esperar al día 1 o al 16.

**Why this priority**: es el problema que reportó el dueño. Hoy, entre el viernes en que cobra y el día 16 (o el 1), el Dashboard muestra la quincena vieja, casi agotada, mientras el dinero nuevo ya está en su cuenta.

**Independent Test**: con hoy simulado el viernes 13 de nov de 2026, los días de pago por defecto (15 y último día del mes) y un ingreso de quincena repartido para la quincena del 16 de nov, el Dashboard muestra la quincena que empieza el 13 de nov y su disponible incluye el ingreso nuevo.

**Acceptance Scenarios**:

1. **Given** el 15 de nov de 2026 cae en domingo, **When** el dueño abre el Dashboard el viernes 13, **Then** ve la quincena "13 nov – 29 nov" (la segunda de noviembre) y no la del 1 al 15.
2. **Given** un ingreso de quincena repartido para la segunda quincena de noviembre, **When** el dueño abre el Dashboard el 13 de nov, **Then** Necesidades y Gustos muestran lo asignado por ese ingreso más el arrastre de la quincena anterior.
3. **Given** un día de pago que cae entre semana (por ejemplo, el martes 15 de dic de 2026), **When** el dueño abre el Dashboard ese día, **Then** ya ve la quincena nueva. La regla aplica a todos los días de pago, no solo a los que se adelantan.
4. **Given** el viernes 30 de oct de 2026 (el 31 es sábado), **When** el dueño abre el Dashboard, **Then** ve la primera quincena de noviembre con el rango "30 oct – 12 nov".
5. **Given** es el día de pago y el dueño todavía no registra el ingreso, **When** abre el Dashboard, **Then** ya ve la quincena nueva, con solo el arrastre de la anterior, hasta que registre y reparta el ingreso.

---

### User Story 2 - Los gastos del día de pago salen del dinero nuevo (Priority: P1)

Como dueño, quiero que lo que gaste desde el día en que cobro se descuente de la quincena nueva y no de la anterior, para que la quincena que cerré no aparezca más gastada de lo que fue.

**Why this priority**: es la otra mitad del reporte. Sin esto, la quincena vieja cierra en negativo y la nueva parece intacta, y eso distorsiona el arrastre y el semáforo.

**Independent Test**: el 13 de nov de 2026, registrar un gasto de Gustos de $200. El disponible de Gustos de la quincena actual baja $200 y el cierre de la quincena anterior (que terminó el 12 de nov) no cambia.

**Acceptance Scenarios**:

1. **Given** hoy es el viernes 13 de nov de 2026, **When** el dueño registra un gasto con fecha de hoy, **Then** se descuenta de la segunda quincena de noviembre.
2. **Given** un gasto del jueves 12 de nov de 2026, **When** se revisa a qué quincena pertenece, **Then** cuenta en la primera quincena de noviembre (30 oct – 12 nov).
3. **Given** un gasto del sábado 31 de oct de 2026, **When** se calcula el arrastre, **Then** cuenta en la primera quincena de noviembre y no en la segunda de octubre.
4. **Given** un cargo recurrente programado para un día que cae dentro del rango efectivo de una quincena (por ejemplo, el día 31 cuando la quincena empezó el viernes 30), **When** se calcula lo reservado, **Then** se reserva en esa quincena.
5. **Given** la página de Gastos en "quincena actual", **When** el dueño la abre el 13 de nov de 2026, **Then** lista los gastos del 13 de nov en adelante, igual que el Dashboard.

---

### User Story 3 - Corregir el inicio con la fecha real del depósito (Priority: P2)

Como dueño, si un pago llega en una fecha distinta a la esperada (un feriado, un retraso o un adelanto), quiero que la fecha en que registro el ingreso de quincena marque el inicio real de esa quincena, sin tener que configurar nada más.

**Why this priority**: la regla del viernes cubre casi todos los casos. Los feriados y los retrasos son raros, pero cuando pasan el dueño necesita una salida simple.

**Independent Test**: registrar un ingreso de tipo quincena el lunes 16 de nov de 2026 para la segunda quincena de noviembre. El Dashboard pasa a mostrar esa quincena desde el 16 y no desde el 13, y los gastos del 13 al 15 se quedan en la quincena anterior.

**Acceptance Scenarios**:

1. **Given** un ingreso de tipo quincena recibido el 16 de nov de 2026 y asignado a la segunda quincena de noviembre, **When** se calcula la quincena, **Then** empieza el 16 de nov y la anterior termina el 15.
2. **Given** un ingreso de tipo quincena con fecha a más de 7 días del día de pago esperado, **When** se calcula la quincena, **Then** se ignora esa fecha y se usa el día de pago esperado.
3. **Given** un ingreso que no es de tipo quincena (por ejemplo, un bono o una venta), **When** se calcula la quincena, **Then** su fecha no mueve el inicio.
4. **Given** el dueño registra un ingreso el lunes 16 de nov (pago tardío), **When** se abre el diálogo de registro, **Then** la quincena sugerida es la segunda de noviembre (la del día de pago esperado más cercano) y no la primera de diciembre. Se puede cambiar.
5. **Given** el dueño registra un ingreso el viernes 13 de nov, **When** se abre el diálogo de registro, **Then** la quincena sugerida es la segunda de noviembre.

---

### User Story 4 - Ver de un vistazo cuándo empezó y cuándo termina la quincena (Priority: P3)

Como dueño, quiero ver en el Dashboard el rango real de la quincena y saber cuándo el pago se adelantó, y que los días que faltan para cobrar y la línea de tiempo de Crédito usen el día en que de verdad me pagan.

**Why this priority**: da confianza en el número. No cambia el cálculo, pero explica por qué la quincena empezó un viernes.

**Independent Test**: con hoy simulado el 13 de nov de 2026, el Dashboard muestra "13 nov – 29 nov" y una nota de que el pago se adelantó al viernes. Los días para el próximo pago son 17: el 30 de nov cae en lunes, así que no se mueve.

**Acceptance Scenarios**:

1. **Given** una quincena cuyo pago se adelantó por fin de semana, **When** el dueño ve el Dashboard, **Then** ve el rango efectivo y una nota corta que indica que el pago se adelantó.
2. **Given** una quincena cuyo pago cayó en su día normal, **When** el dueño ve el Dashboard, **Then** ve el rango efectivo y no aparece la nota.
3. **Given** el próximo día de pago cae en sábado o domingo, **When** el Dashboard calcula los días para el próximo pago, **Then** cuenta hasta el viernes anterior.
4. **Given** la línea de tiempo de Crédito, **When** muestra los días de pago, **Then** aparecen ya movidos al viernes cuando caen en fin de semana.

---

### Edge Cases

- **Día de pago 31 en meses cortos**: se usa el último día del mes (30, o 28/29 en febrero). Si ese día cae en fin de semana, se mueve al viernes anterior.
- **Cambio de año**: el pago del 31 de dic de 2026 (jueves) abre la primera quincena de enero de 2027. Si el último día de diciembre cayera en fin de semana, el viernes anterior abre la quincena de enero.
- **Varios ingresos de quincena para la misma quincena** dentro del margen de ±7 días: manda el más temprano.
- **Una corrección que rompería el orden** (la quincena empezaría el mismo día o antes que la anterior): se ignora y se usa el día esperado. Las quincenas nunca se enciman ni dejan huecos.
- **Días de pago configurados distintos a 15 y último día**: la misma regla. El primer día de pago abre la segunda quincena del mes y el segundo abre la primera quincena del mes siguiente.
- **Feriados**: fuera de alcance. Si el pago llega antes o después por un feriado, el dueño lo corrige con la fecha del ingreso (US3).
- **Asignaciones y aportaciones a metas**: siguen perteneciendo a la quincena que tienen guardada. No se mueven por la fecha.
- **Quincenas pasadas**: el cambio recalcula el arrastre histórico. Los gastos de los días de pago adelantados pasan a la quincena que financiaron, y eso puede cambiar el cierre de quincenas anteriores.
- **Modo demo**: aplica la misma regla. Los datos de demostración se ven con el rango efectivo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST calcular el día de pago esperado de cada quincena a partir de los días de pago de Preferencias:
  - El primer día de pago del mes M abre la segunda quincena de M.
  - El segundo día de pago del mes M abre la primera quincena de M+1.
  - El día 31 se recorta al último día del mes.
- **FR-002**: Si el día de pago esperado cae en sábado o domingo, el sistema MUST moverlo al viernes anterior. Los días feriados no se consideran.
- **FR-003**: Cada quincena MUST empezar en su día de pago efectivo (esperado o corregido) y terminar el día anterior al inicio de la siguiente. Esto aplica también cuando el pago cae en su día normal.
- **FR-004**: Si existe un ingreso de tipo quincena asignado a una quincena, con fecha de recepción a 7 días o menos del día de pago esperado, el sistema MUST usar esa fecha como inicio. Si hay varios, se usa el más temprano. Los ingresos de otro tipo o fuera del margen no mueven el inicio.
- **FR-005**: Las quincenas MUST quedar en orden estricto, sin huecos ni encimarse. Una corrección que rompa el orden se ignora.
- **FR-006**: La quincena "actual" del Dashboard MUST ser la que contiene hoy según su rango efectivo.
- **FR-007**: Cada gasto MUST contar en la quincena cuyo rango efectivo contiene su fecha. Esto vale para el disponible, el arrastre y el semáforo.
- **FR-008**: Las asignaciones de ingresos y las aportaciones a metas MUST seguir contando en la quincena que tienen guardada, sin importar su fecha.
- **FR-009**: Los cargos recurrentes MUST reservarse y marcarse como aplicados según el rango efectivo de la quincena.
- **FR-010**: Los días para el próximo pago MUST contarse hasta el siguiente inicio efectivo de quincena. Son 0 el día de pago.
- **FR-011**: El Dashboard MUST mostrar el rango efectivo de la quincena actual y, cuando su inicio se adelantó por fin de semana, una nota corta que lo indique. Va en español e inglés.
- **FR-012**: Al registrar un ingreso, la quincena sugerida MUST ser la que tiene el día de pago esperado más cercano a la fecha de recepción, antes o después de ella. Si hay empate, gana la quincena posterior. La sugerencia sigue siendo editable.
- **FR-013**: La línea de tiempo de Crédito MUST mostrar los días de pago ya movidos por fin de semana.
- **FR-014**: En la página de Gastos, la "quincena actual" y la navegación entre quincenas MUST usar el rango efectivo, igual que el Dashboard.
- **FR-015**: El cambio MUST funcionar sin modificar los datos guardados. Los identificadores de quincena (mes y mitad) no cambian y no hace falta migrar nada.

### Key Entities

- **Quincena**: se sigue identificando por mes y mitad (1 o 2), con su inicio nominal (día 1 o 16). Gana un **rango efectivo** (desde y hasta), que es el que cuenta para gastos, cargos recurrentes y días al próximo pago.
- **Calendario de pagos**: se deriva de los días de pago de Preferencias y de los ingresos de tipo quincena. No se guarda.
- **Ingreso de quincena**: un ingreso de tipo quincena. Su fecha de recepción puede corregir el inicio de la quincena que financia (FR-004).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El día en que llega la quincena (también cuando se adelanta por fin de semana), el Dashboard muestra la quincena nueva desde que se abre la app, sin acciones extra del dueño.
- **SC-002**: El 100% de los gastos registrados en un día de pago se descuentan de la quincena nueva.
- **SC-003**: Para todos los días de pago de 2026 y 2027 con la configuración por defecto, el inicio de quincena cae en un día entre semana: el día nominal o el viernes anterior.
- **SC-004**: Corregir el inicio de una quincena toma una sola acción que el dueño ya hace: registrar el ingreso con su fecha real.
- **SC-005**: Ningún dato guardado cambia y ninguna pantalla existente se rompe. Las pruebas de regresión de Safe-to-Spend y Recurrentes siguen pasando con las fechas actualizadas.

## Assumptions

- El dueño cobra por depósito y el dinero está disponible el mismo día del pago.
- "Tipo quincena" es el tipo de ingreso de salario que ya existe (spec 004).
- El margen de ±7 días es suficiente para feriados y retrasos normales, y evita que un ingreso mal asignado mueva la quincena de forma absurda.
- La semana laboral es de lunes a viernes. El ajuste por fin de semana siempre va al viernes anterior, nunca al lunes siguiente.
- Recalcular el arrastre histórico con la regla nueva es aceptable. El dueño prefiere que el pasado refleje cuándo cobró de verdad.
- Las pruebas son unitarias y e2e en demo, sin base de datos local, porque no hay migración.
