# Feature Specification: Fechas de corte y pago de tarjetas desde el estado de cuenta

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Automatizar los cálculos de las tarjetas de crédito. Hoy cada tarjeta guarda un día de corte (1–31) y los días entre el corte y el límite de pago (1–60), y el dueño tuvo que calcular esos números a mano a partir de sus estados de cuenta. Los bancos recorren los límites que caen en fin de semana o día inhábil, y las mensualidades MSI pendientes conservan las fechas calculadas con los datos anteriores de la tarjeta. Alcance: (1) capturar el corte y el límite tal como vienen en un estado de cuenta, derivar los dos números y mostrar los próximos 3 estados antes de guardar; (2) un solo cálculo del límite en toda la app que, si cae en sábado, domingo o día inhábil bancario de México, lo recorre al día hábil anterior; (3) al cambiar el corte o los días de una tarjeta, recalcular las mensualidades MSI no cobradas. Fuera de alcance: días sin intereses por compra y ciclos móviles de 30 días."

## Clarifications

### Session 2026-11-07

- Q: Si el límite cae en día inhábil, ¿se recorre al día hábil anterior o al siguiente? → A: Al anterior. Los bancos lo hacen de las dos formas (Nu: sábado 4 jul → viernes 3; domingo 4 oct → lunes 5), y el anterior nunca hace pagar tarde.
- Q: ¿Qué hacer con las mensualidades MSI pendientes cuando cambian los datos de la tarjeta? → A: Recalcular las no cobradas por completo; las ya cobradas no se tocan.
- Q: ¿Se incluyen los "días sin intereses" por compra (los "hasta 60 días" de Plata)? → A: No en esta feature; queda para después.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar una tarjeta con las fechas de su estado de cuenta (Priority: P1)

Como dueño, tengo a la mano mi estado de cuenta, que dice "fecha de corte 22 nov, fecha límite de pago 7 dic". Quiero escribir esas dos fechas al dar de alta o editar la tarjeta, sin calcular el día de corte ni cuántos días hay entre el corte y el límite.

**Why this priority**: es el cálculo que el dueño tuvo que hacer a mano para sus 6 tarjetas, y sin él cualquier otra parte usa datos mal capturados.

**Independent Test**: dar de alta una tarjeta con corte 22 nov 2026 y límite 7 dic 2026. Antes de guardar se ve "corte el día 22 · vence 15 días después" y los próximos 3 estados. Al guardar, la tarjeta queda con día de corte 22 y 15 días para pagar.

**Acceptance Scenarios**:

1. **Given** el formulario de una tarjeta de crédito, **When** el dueño captura la fecha de corte y la fecha límite de un estado de cuenta, **Then** el sistema muestra el día de corte y los días para pagar que se derivan de ellas, sin que el dueño los calcule.
2. **Given** las fechas capturadas, **When** se muestran los datos derivados, **Then** también se muestran los próximos 3 estados de cuenta (corte → límite), ya ajustados por días inhábiles, para que el dueño confirme que coinciden con su banco.
3. **Given** los estados de cuenta reales del dueño, **When** captura cada par de fechas, **Then** se derivan exactamente estos datos:

   | Tarjeta | Corte | Límite | Día de corte | Días para pagar |
   |---|---|---|---|---|
   | BBVA | 5 nov 2026 | 25 nov 2026 | 5 | 20 |
   | Banregio | 14 oct 2026 | 4 nov 2026 | 14 | 21 |
   | DiDi | 22 nov 2026 | 7 dic 2026 | 22 | 15 |
   | Nu | 23 oct 2026 | 3 nov 2026 | 23 | 11 |
   | Plata | 10 oct 2026 | 9 nov 2026 | 10 | 30 |
   | Mercado Pago | 27 nov 2026 | 7 dic 2026 | 27 | 10 |

4. **Given** una fecha límite igual o anterior a la fecha de corte, o más de 60 días después, **When** el dueño intenta guardar, **Then** no se guarda y aparece un mensaje traducido que explica el problema.
5. **Given** una tarjeta ya configurada, **When** el dueño abre su edición, **Then** las fechas aparecen prellenadas con su estado de cuenta más reciente (último corte ya ocurrido y su límite sin ajustar), y guardar sin cambiar nada deja la tarjeta exactamente igual.
6. **Given** una fecha límite capturada que pudo haberse recorrido por día inhábil (el día anterior o el siguiente es inhábil), **When** se muestran los datos derivados, **Then** aparece un aviso que sugiere confirmar con otro estado de cuenta, sin impedir guardar.
7. **Given** un caso que no encaja con las fechas de un estado de cuenta, **When** el dueño elige capturar los números a mano, **Then** puede escribir directamente el día de corte y los días para pagar, como hoy.

---

### User Story 2 - Ver límites de pago que caen en día hábil (Priority: P1)

Como dueño, quiero que el límite de pago que veo en Gastos, en el calendario de crédito y en las mensualidades MSI nunca caiga en sábado, domingo o día inhábil bancario. Así pago a tiempo aunque el banco lo haya recorrido.

**Why this priority**: un límite en domingo puede hacer que el dueño pague tarde y genere intereses; es el riesgo que la app debe evitar.

**Independent Test**: con Nu (corte día 23, 11 días), el estado del 23 sep 2026 debe vencer el viernes 2 oct (el 4 oct es domingo) y el del 23 jun el viernes 3 jul (el 4 jul es sábado). El del 23 oct vence el martes 3 nov, sin cambio.

**Acceptance Scenarios**:

1. **Given** una tarjeta cuyo límite (corte + días) cae en sábado o domingo, **When** se muestra ese límite en cualquier parte de la app, **Then** se muestra el viernes anterior (o el día hábil anterior más cercano).
2. **Given** un límite que cae en un día inhábil bancario de México, **When** se muestra, **Then** se recorre al día hábil anterior, saltando también fines de semana.
3. **Given** el límite ajustado, **When** la app decide si una tarjeta está vencida o cuánto pagar para no generar intereses, **Then** usa la fecha ajustada en todos los cálculos, no la original.
4. **Given** la lista de días inhábiles, **When** se calcula un año cualquiera, **Then** incluye: 1 ene, primer lunes de feb, tercer lunes de mar, Jueves y Viernes Santo, 1 may, 16 sep, 2 nov, tercer lunes de nov, 12 dic y 25 dic.
5. **Given** el modo demo, **When** se ven las tarjetas de ejemplo, **Then** sus límites también se muestran ajustados.

---

### User Story 3 - Mensualidades MSI al día cuando cambia la tarjeta (Priority: P2)

Como dueño, cuando corrijo el corte o los días para pagar de una tarjeta, quiero que las mensualidades MSI a terceros que aún no me pagan tomen las fechas nuevas, sin revisarlas una por una.

**Why this priority**: hoy solo hay una mensualidad pendiente (Banregio), pero cada corrección futura deja fechas viejas en silencio.

**Independent Test**: una compra MSI a 3 meses en una tarjeta con corte 15 y 20 días, con la primera mensualidad ya cobrada. Cambiar la tarjeta a corte 14 y 21 días. Las mensualidades 2 y 3 cambian su límite de tarjeta y su fecha de cobro al deudor; la 1 no cambia.

**Acceptance Scenarios**:

1. **Given** una tarjeta con mensualidades MSI no cobradas por completo, **When** el dueño guarda un cambio en su día de corte o en sus días para pagar, **Then** cada una de esas mensualidades recalcula su límite de tarjeta con los datos nuevos (incluido el ajuste por día inhábil) y su fecha de cobro al deudor con la anticipación configurada.
2. **Given** mensualidades ya cobradas por completo, **When** cambia la tarjeta, **Then** no cambian.
3. **Given** el cambio de la tarjeta y el recálculo, **When** algo falla al guardar, **Then** no cambia nada: ni la tarjeta ni las mensualidades.
4. **Given** un cambio que solo toca el nombre, el banco u otro dato que no es el corte ni los días, **When** se guarda, **Then** las mensualidades no cambian.
5. **Given** la puesta en marcha de esta feature, **When** existen mensualidades no cobradas calculadas sin el ajuste por día inhábil, **Then** se recalculan una sola vez con la regla nueva.

---

### Edge Cases

- **Corte a fin de mes**: un corte del 31 se guarda como día 31; en meses cortos cae el último día, como hoy. Un estado con corte el 28 o 29 de febrero puede corresponder a un día de corte 29, 30 o 31: se guarda el día capturado y el aviso de la historia 1 (escenario 6) sugiere confirmarlo con el estado de otro mes.
- **Límite en el mes siguiente o más allá**: un límite que cruza mes o año (corte 27 dic, límite 6 ene) se calcula igual.
- **Límite recorrido en el estado capturado**: si el dueño captura un límite que el banco ya recorrió (Nu: corte 23 sep, límite lunes 5 oct), se derivan 12 días en vez de 11. El aviso del escenario 6 lo señala, y la vista previa permite comparar con su siguiente estado.
- **Varios días inhábiles seguidos**: Jueves y Viernes Santo más el fin de semana se saltan juntos hasta el miércoles anterior.
- **Tarjeta archivada**: no se recalculan sus mensualidades, porque una tarjeta con mensualidades pendientes no se puede archivar.
- **Cambio de tipo de cuenta**: si una cuenta deja de ser tarjeta de crédito, no se le piden fechas; si se vuelve tarjeta, se le piden.
- **Demo**: el formulario calcula y muestra la vista previa, pero guardar muestra el aviso de solo lectura y no cambia nada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El formulario de una tarjeta de crédito MUST permitir capturar una fecha de corte y una fecha límite de pago de un mismo estado de cuenta.
- **FR-002**: El sistema MUST derivar el día de corte (el día del mes de la fecha de corte) y los días para pagar (los días naturales entre la fecha de corte y la fecha límite).
- **FR-003**: El sistema MUST rechazar una fecha límite igual o anterior a la de corte, o con más de 60 días de diferencia, con un mensaje traducido.
- **FR-004**: Antes de guardar, el formulario MUST mostrar el día de corte y los días derivados, y los próximos 3 estados de cuenta (fecha de corte → fecha límite ajustada) a partir de hoy.
- **FR-005**: Al editar una tarjeta configurada, el formulario MUST prellenar las fechas de su estado más reciente: el último corte en o antes de hoy y su límite sin ajustar (corte + días), de modo que guardar sin cambios conserve los mismos datos.
- **FR-006**: El formulario MUST mostrar un aviso, sin bloquear el guardado, cuando el día anterior o el siguiente a la fecha límite capturada es inhábil, o cuando la fecha de corte es el último día de un mes de menos de 31 días.
- **FR-007**: El formulario MUST seguir permitiendo capturar a mano el día de corte y los días para pagar.
- **FR-008**: El sistema MUST calcular el límite de pago de un estado de cuenta en un solo lugar, como fecha de corte + días para pagar, recorrido al día hábil anterior si cae en sábado, domingo o día inhábil bancario.
- **FR-009**: Los días inhábiles bancarios MUST ser, para cualquier año: 1 ene, primer lunes de feb, tercer lunes de mar, Jueves Santo, Viernes Santo, 1 may, 16 sep, 2 nov, tercer lunes de nov, 12 dic y 25 dic.
- **FR-010**: El límite ajustado MUST usarse en todo lugar donde la app muestra o compara un límite de tarjeta: estado de la tarjeta (pago para no generar intereses, vencida), calendario de crédito y mensualidades MSI nuevas.
- **FR-011**: Al guardar un cambio en el día de corte o en los días para pagar de una tarjeta, el sistema MUST recalcular el límite de tarjeta y la fecha de cobro al deudor de cada mensualidad MSI de esa tarjeta que no esté cobrada por completo, y MUST NOT modificar las cobradas por completo.
- **FR-012**: El cambio de la tarjeta y el recálculo de sus mensualidades MUST ocurrir juntos: si uno falla, ninguno se aplica.
- **FR-013**: Al poner en marcha esta feature, el sistema MUST recalcular una vez las mensualidades no cobradas existentes con la regla de días inhábiles.
- **FR-014**: En modo demo, el formulario MUST calcular y mostrar la vista previa, y guardar MUST bloquearse con el aviso de solo lectura.
- **FR-015**: Todos los textos nuevos (etiquetas, avisos, errores, vista previa) MUST existir en español e inglés, y las fechas MUST mostrarse en el formato del idioma elegido.

### Key Entities

- **Tarjeta de crédito (datos de pago)**: día de corte (1–31) y días para pagar (1–60). Son los mismos dos datos de hoy; solo cambia cómo se capturan.
- **Estado de cuenta**: un par fecha de corte → fecha límite. No se guarda; se calcula a partir de la tarjeta, o lo captura el dueño para derivar los datos de la tarjeta.
- **Día inhábil bancario**: fecha en la que los bancos de México no operan. Se calcula por año; no se guarda.
- **Mensualidad MSI**: su límite de tarjeta y su fecha de cobro al deudor dependen de los datos de pago de la tarjeta, y se recalculan mientras no esté cobrada por completo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño configura cualquiera de sus 6 tarjetas capturando solo las 2 fechas de su estado de cuenta, sin cálculos propios, en menos de 1 minuto.
- **SC-002**: Para las 6 tarjetas reales, los datos derivados coinciden al 100% con la tabla del escenario 3 de la historia 1.
- **SC-003**: Ningún límite de pago mostrado en la app cae en sábado, domingo o día inhábil bancario (verificado en todos los estados de 2026 y 2027 de las 6 tarjetas).
- **SC-004**: Ningún límite mostrado es posterior al límite real del banco en los ejemplos de Nu (3 jul, 3 ago, 3 sep, 5 oct y 3 nov de 2026).
- **SC-005**: Tras cambiar el corte o los días de una tarjeta, el 100% de sus mensualidades no cobradas muestra las fechas nuevas al instante, y el 0% de las cobradas cambia.
- **SC-006**: Los datos de las tarjetas ya configuradas no cambian por la puesta en marcha de esta feature; solo cambian las fechas mostradas que caían en día inhábil.

## Assumptions

- La fecha de corte es fija en el calendario: los bancos no la recorren por días inhábiles, o si lo hacen, no cambia a qué estado pertenece una compra. Solo el límite de pago se ajusta.
- La lista de días inhábiles cubre los que se repiten cada año. Los extraordinarios (por ejemplo, el 1 de octubre de cada 6 años por cambio de gobierno) no se incluyen; el aviso del formulario y la vista previa permiten detectar diferencias.
- La fecha de cobro al deudor de una mensualidad se sigue calculando como límite de tarjeta − anticipación configurada (mínimo 1 día), ahora a partir del límite ajustado; no se ajusta por días inhábiles.
- El estado de cuenta "más reciente" para prellenar la edición es el del último corte en o antes de hoy.
- No cambian los datos guardados de las tarjetas ni su estructura; las 6 tarjetas del dueño ya tienen sus valores correctos (cargados el 2026-11-07).
- Depende de lo existente: el formulario de cuentas, el estado de las tarjetas en Gastos, el calendario de crédito y las compras MSI a terceros.
