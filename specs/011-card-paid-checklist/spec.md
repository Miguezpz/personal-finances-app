# Feature Specification: Pago de tarjeta como checklist y sesión de pago del mes

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Spec 011 — Pago de tarjeta como checklist ("Ya la pagué"). Contexto del dueño: su familia usa sus tarjetas de crédito y le paga a él directamente; él solo registra SUS propias compras, y antes de la fecha límite paga al banco el total para no generar intereses (totalero). Por eso el monto que la app tiene registrado por corte es menor que el del estado de cuenta real, y registrar el monto real como pago deja un saldo a favor que oculta los cortes siguientes. Objetivo: que "Pagar tarjeta" funcione como una tarea por palomear por corte, sin capturar montos. Decisiones ya acordadas con el usuario: (1) Cada corte pendiente o vencido muestra una acción de un toque "Ya la pagué" (EN "Mark as paid") en lugar del diálogo con monto, en Crédito, en Gastos (tarjetas de crédito) y en la alerta del Dashboard; el diálogo de pago con monto y cuenta de origen desaparece, sin opción de "otro monto". (2) Marcar un corte como pagado lo deja en estado "Pagado", quita la alerta del Dashboard y hace que el siguiente corte empiece limpio: nunca genera saldo a favor ni hace que cortes futuros parezcan pagados. (3) Se puede desmarcar (Deshacer de 6 s como el resto de la app, y también desmarcar después). (4) El disponible para gastar no cambia: las compras ya se descontaron el día que se hicieron. (5) Lo que pasa si no se marca: el corte pasa a Vencido tras la fecha límite y la alerta permanece; definir cómo se ven la deuda total, patrimonio y bitácora con cortes marcados. (6) Los pagos de tarjeta ya registrados en el historial (datos reales del dueño y del demo) deben seguir siendo coherentes: definir migración o compatibilidad. (7) Las cuotas MSI de terceros siguen funcionando igual. (8) Atajo P y la opción "Pagar tarjeta" de la hoja ＋ se adaptan o se quitan. Debe verificarse en modo normal y demo, EN y ES." Ampliación del dueño (2026-11-08): "quiero que la app establezca las fechas en las que debería enfocarme a pagar todas las tarjetas: busco una fecha al mes en la que pago todas las tarjetas de crédito de golpe; que la app me muestre un rango de unos 3 días en el que pueda pagarlas todas en una sesión, donde coincidan todas las tarjetas y sus fechas límite."

## Clarifications

### Session 2026-11-08

- Q: Cuando los rangos de pago de las tarjetas se cruzan en más de 3 días, ¿dónde va la ventana de la sesión? → A: Junto a la quincena: la primera ventana válida que empiece en o después de un día de pago (los de Preferencias, por defecto el 15 y el último día del mes), para que el dinero ya esté disponible. Si ningún día de pago cae en el cruce, empieza el día siguiente al último corte.
- Q: Si las fechas de las tarjetas no permiten pagarlas todas en una sola sesión, ¿qué hace la app? → A: Propone el menor número de sesiones posible (normalmente 2), cada una con su ventana y sus tarjetas.
- Q: ¿Marcar el corte más reciente liquida también los cortes anteriores sin marcar? → A: Sí; el estado de cuenta del banco incluye el saldo anterior (FR-004).
- Q: ¿Se conservan "Pagar tarjeta" en la hoja ＋ y el atajo P? → A: No; marcar solo se hace desde las tarjetas (FR-011).
- Q: ¿Los pagos de tarjeta siguen apareciendo en Gastos y en la Bitácora? → A: No; ya no son movimientos con monto (FR-012).
- Q: ¿Qué pasa con los pagos con monto ya registrados? → A: Cada uno se convierte en la marca del corte que pagaba y se descarta cualquier excedente; antes de aplicarlo a los datos reales se le muestra al dueño qué cortes quedarían marcados (FR-018, FR-032).
- Q: ¿Qué muestra un corte cerrado sin compras propias registradas? → A: "Nada que pagar", sin botón ni alerta (FR-008).
- Q: ¿Desde cuándo avisa el Dashboard de la sesión de pago? → A: Desde 7 días antes de que empiece la ventana: "Próxima sesión de pago" con sus fechas y tarjetas, en lugar de las alertas individuales de esas tarjetas; dentro de la ventana cambia a "Hoy toca pagar tus tarjetas" con sus "Ya la pagué" (FR-029).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Palomear que ya pagué el corte (Priority: P1)

Como dueño totalero, cuando ya pagué al banco el estado de cuenta de una tarjeta, quiero marcar ese corte como pagado con un solo toque, sin escribir montos ni elegir de qué cuenta salió el dinero, para que la app deje de avisarme y la tarjeta quede al corriente.

**Why this priority**: es el cambio que pidió el dueño. Hoy "Pagar" pide un monto; como su familia usa la tarjeta y le paga a él, el monto real del banco no coincide con lo registrado, y capturarlo descompone los cortes siguientes.

**Independent Test**: con una tarjeta que tiene un corte cerrado pendiente, tocar "Ya la pagué" en Crédito; el corte pasa a "Pagado" sin abrir ningún formulario y la alerta del Dashboard desaparece.

**Acceptance Scenarios**:

1. **Given** una tarjeta cuyo último corte cerrado está pendiente, **When** el dueño toca "Ya la pagué" en Crédito, **Then** el corte queda en "Pagado" de inmediato, sin pedir monto, fecha ni cuenta de origen.
2. **Given** el mismo corte pendiente, **When** el dueño lo marca desde Gastos (sección de tarjetas de crédito) o desde la alerta del Dashboard, **Then** el resultado es el mismo y las tres vistas muestran el corte como pagado.
3. **Given** un corte vencido (pasó su fecha límite sin marcarse), **When** el dueño lo marca, **Then** deja de mostrarse como vencido y su alerta desaparece.
4. **Given** un corte marcado como pagado, **When** se revisa el siguiente corte, **Then** este solo incluye las compras registradas después del corte pagado (y las cuotas MSI que le tocan), sin arrastrar nada del anterior.
5. **Given** el dueño registró en la app menos compras de las que trae el estado de cuenta real, **When** marca el corte, **Then** ningún corte futuro aparece como pagado por adelantado.
6. **Given** el modo demo, **When** el visitante toca "Ya la pagué", **Then** aparece el aviso de solo lectura y el corte no cambia.

---

### User Story 2 - Desmarcar un corte (Priority: P1)

Como dueño, quiero poder deshacer una marca hecha por error, en el momento o después, para que el estado de la tarjeta refleje la realidad.

**Why this priority**: una marca de un toque necesita una salida igual de fácil; sin ella, un toque accidental deja la tarjeta como pagada y oculta su alerta.

**Independent Test**: marcar un corte, tocar "Deshacer" en el aviso; el corte vuelve a pendiente. Marcarlo de nuevo, esperar a que el aviso se vaya y desmarcarlo desde la tarjeta; vuelve a pendiente.

**Acceptance Scenarios**:

1. **Given** el dueño acaba de marcar un corte, **When** toca "Deshacer" en el aviso (6 s), **Then** el corte vuelve a su estado anterior (pendiente o vencido) y su alerta reaparece.
2. **Given** un corte marcado hace tiempo, **When** el dueño elige "Desmarcar" en esa tarjeta, **Then** el corte vuelve a pendiente o vencido según su fecha límite, con un aviso que también permite deshacer.

---

### User Story 3 - Ver la tarjeta al corriente sin montos inventados (Priority: P2)

Como dueño, quiero que la deuda de la tarjeta, el patrimonio y la bitácora reflejen solo lo que registré y lo que marqué, sin "pagos" con montos que no capturé, para que los números sigan teniendo sentido.

**Why this priority**: sin montos de pago, las vistas que antes restaban pagos deben definir qué muestran; si no, la deuda y el patrimonio quedarían inflados o la bitácora vacía de sentido.

**Independent Test**: con un corte marcado y compras nuevas después del corte, la deuda total de la tarjeta es igual a las compras registradas que caen en cortes no pagados más las cuotas MSI pendientes; la bitácora no muestra filas de "Pago de tarjeta" con monto.

**Acceptance Scenarios**:

1. **Given** cortes marcados y compras posteriores, **When** se ve la tarjeta, **Then** la deuda total = compras registradas en cortes sin marcar (incluido el periodo abierto) + cuotas MSI de terceros aún no cubiertas por un corte pagado.
2. **Given** lo anterior, **When** se ve Patrimonio, **Then** las deudas usan esa misma deuda total.
3. **Given** la bitácora, **When** se listan movimientos o se calculan Entradas/Salidas/Neto, **Then** no aparece ningún pago de tarjeta con monto ni se cuenta como salida.
4. **Given** el disponible para gastar de cualquier quincena, **When** se marca o desmarca un corte, **Then** no cambia.

---

### User Story 4 - Historial anterior coherente (Priority: P2)

Como dueño con pagos de tarjeta ya registrados con monto (antes de este cambio), quiero que ese historial se convierta en marcas de "pagado" sin perder qué cortes ya estaban liquidados, para no tener que volver a palomear meses pasados.

**Why this priority**: el dueño ya tiene datos reales; sin una conversión, los cortes pasados aparecerían vencidos de golpe.

**Independent Test**: con datos que incluyen pagos con monto anteriores, tras el cambio cada corte que esos pagos cubrían aparece "Pagado" y ningún corte posterior aparece pagado por un saldo a favor.

**Acceptance Scenarios**:

1. **Given** un pago registrado con monto entre el corte de un estado de cuenta y su fecha límite (o después), **When** se aplica el cambio, **Then** ese corte queda marcado como pagado.
2. **Given** un pago anterior que excedía lo registrado (saldo a favor), **When** se aplica el cambio, **Then** el excedente desaparece y los cortes siguientes quedan pendientes hasta que se marquen.
3. **Given** el demo, **When** se genera su historial, **Then** los cortes pasados aparecen pagados mediante marcas, no mediante pagos con monto.

---

### User Story 5 - Sesión de pago del mes (Priority: P2)

Como dueño, quiero que la app me diga en qué días del mes puedo pagar todas mis tarjetas de crédito de una sola vez (una ventana de unos 3 días donde ya cerraron todos los cortes y ninguna fecha límite ha pasado), para hacer una sola sesión de pagos al mes en lugar de estar pendiente de cada tarjeta.

**Why this priority**: es la forma en que el dueño ya paga: una sesión al mes. Junto con el checklist (US1), convierte el pago de tarjetas en una tarea mensual: ir a la sesión, pagar y palomear.

**Independent Test**: con dos tarjetas (A: corte el 10 de noviembre y límite el 30; B: corte el 25 de octubre y límite el 14 de noviembre) los rangos de pago son del 11 al 29 y del 26 de octubre al 13 de noviembre, y se cruzan del 11 al 13. Ningún día de pago cae en el cruce, así que Crédito muestra una sesión del 11 al 13 de noviembre con ambas tarjetas. Con el Dashboard en un día de esa ventana aparece el aviso de la sesión con las tarjetas por palomear.

**Acceptance Scenarios**:

1. **Given** varias tarjetas cuyos rangos de pago (del día siguiente al corte hasta el día anterior a la fecha límite) se cruzan, **When** el dueño abre Crédito, **Then** ve la próxima sesión de pago: una ventana de hasta 3 días dentro del cruce, con cada tarjeta, su fecha límite y su estado (pendiente, pagada o nada que pagar).
2. **Given** el cruce incluye un día de pago, **When** se calcula la ventana, **Then** la ventana incluye ese día de pago y empieza en él, salvo que no quepan 3 días antes del fin del cruce; en ese caso termina el último día del cruce.
3. **Given** el cruce no incluye ningún día de pago, **When** se calcula la ventana, **Then** empieza el día siguiente al último corte.
4. **Given** los rangos no se cruzan para todas las tarjetas, **When** el dueño abre Crédito, **Then** ve el menor número de sesiones posible, cada una con su ventana y sus tarjetas.
5. **Given** faltan 7 días o menos para que empiece la ventana de una sesión con tarjetas pendientes, **When** el dueño abre el Dashboard, **Then** ve "Próxima sesión de pago" con las fechas de la ventana y sus tarjetas, en lugar de una alerta por cada una de esas tarjetas.
6. **Given** hoy está dentro de la ventana de una sesión con tarjetas pendientes, **When** el dueño abre el Dashboard, **Then** ve un aviso "Hoy toca pagar tus tarjetas" con cada tarjeta pendiente y su "Ya la pagué".
7. **Given** el dueño marcó todas las tarjetas de la sesión, **When** la vuelve a ver, **Then** aparece como completada y Crédito muestra la fecha de la siguiente sesión.
8. **Given** la ventana ya pasó y quedan tarjetas sin marcar, **When** se ven Crédito y el Dashboard, **Then** esas tarjetas siguen con su propia alerta (pendiente o vencida) como en US1.

---

### Edge Cases

- **Corte sin compras registradas**: un corte cerrado en el que no se registró nada no requiere acción: aparece como "Nada que pagar" (como hoy), sin botón "Ya la pagué" y sin alerta. Si el dueño pagó compras de su familia en ese corte, no hay nada que marcar porque la app no tiene deuda registrada.
- **Marcar un corte cuando el anterior no está marcado**: marcar el corte más reciente también deja como pagados los cortes anteriores sin marcar de esa tarjeta, porque el estado de cuenta del banco incluye el saldo anterior y pagarlo liquida todo lo previo.
- **Desmarcar un corte que cubría a otros**: al desmarcar el corte más reciente, los cortes anteriores vuelven a su propio estado (pagados si tenían su propia marca, pendientes o vencidos si no).
- **Periodo abierto**: solo se pueden marcar cortes ya cerrados (fecha de corte ≤ hoy). Las compras del periodo abierto siguen como deuda del próximo corte.
- **Compra registrada después de marcar**: si el dueño registra tarde una compra con fecha dentro de un corte ya marcado, la compra queda cubierta por ese corte pagado (no reabre el corte ni genera deuda).
- **Cuotas MSI de terceros**: la cuota que cae en un corte forma parte de ese corte; al marcarlo, deja de contar como deuda de la tarjeta. El cobro al tercero sigue su propio flujo en Por cobrar, sin cambios.
- **Cambio de día de corte de la tarjeta**: las marcas pertenecen a una fecha de corte concreta; si cambian los términos de la tarjeta, una marca cuya fecha ya no coincide con un corte sigue cubriendo todo lo registrado hasta esa fecha.
- **Tarjeta archivada**: conserva sus marcas; no muestra acciones de marcar.
- **Sin conexión o error al guardar**: la marca se muestra de inmediato y, si falla al guardar, se revierte con el aviso de error habitual.
- **Modo privacidad**: el botón y los estados no muestran montos nuevos; los montos existentes siguen enmascarados.
- **Una sola tarjeta**: la sesión es su propia ventana (de hasta 3 días), con las mismas reglas.
- **Cruce de menos de 3 días**: la ventana ocupa todo el cruce (1 o 2 días); sigue siendo una sola sesión.
- **Fechas límite en día inhábil**: se usan las fechas límite ya ajustadas a día hábil (spec 007).
- **Tarjeta sin términos completos o archivada**: no participa en la sesión.
- **Sesión con una tarjeta sin compras registradas**: la tarjeta aparece como "Nada que pagar" dentro de la sesión y no impide que la sesión se complete.
- **Ciclos**: cada sesión agrupa, de cada tarjeta, el estado de cuenta cuyo rango de pago cae en la ventana; la siguiente sesión es la del mes siguiente.

## Requirements *(mandatory)*

### Functional Requirements

**Marcar y desmarcar**

- **FR-001**: Cada corte cerrado de una tarjeta con deuda registrada y sin marcar MUST ofrecer una acción de un toque "Ya la pagué" (EN "Mark as paid") en Crédito, en la sección de tarjetas de crédito de Gastos y en la alerta de tarjeta del Dashboard.
- **FR-002**: Marcar un corte MUST NOT pedir monto, fecha, cuenta de origen ni confirmación; MUST quedar reflejado al instante (actualización optimista) en todas las vistas.
- **FR-003**: Un corte marcado MUST mostrarse en estado "Pagado" y MUST NOT generar alerta en el Dashboard.
- **FR-004**: Marcar un corte MUST cubrir todo lo registrado en esa tarjeta con fecha ≤ su fecha de corte (compras propias y cuotas MSI que le tocan) y MUST dejar como pagados los cortes anteriores sin marcar.
- **FR-005**: Una marca MUST NOT cubrir nada posterior a su fecha de corte: el siguiente corte MUST incluir solo lo registrado después, y ningún corte futuro MUST aparecer pagado por una marca anterior.
- **FR-006**: Tras marcar, MUST aparecer un aviso con "Deshacer" durante 6 s; deshacer MUST devolver el corte (y los anteriores que cubría) a su estado previo.
- **FR-007**: Un corte marcado MUST ofrecer "Desmarcar" (EN "Unmark") en su tarjeta; desmarcar MUST ser inmediato, con aviso y "Deshacer".
- **FR-008**: Solo los cortes cerrados (fecha de corte ≤ hoy) MUST poder marcarse; un corte sin deuda registrada MUST mostrarse como "Nada que pagar" sin acción.
- **FR-009**: Un corte no marcado cuya fecha límite ya pasó MUST mostrarse como "Vencido" y su alerta MUST permanecer en el Dashboard hasta que se marque.

**Lo que desaparece**

- **FR-010**: El diálogo de pago con monto y cuenta de origen MUST eliminarse; MUST NOT existir otra forma de registrar un pago con monto.
- **FR-011**: La opción "Pagar tarjeta" de la hoja ＋ y su atajo de teclado (P) MUST eliminarse; marcar se hace solo desde las tarjetas.
- **FR-012**: La lista de movimientos de Gastos y la Bitácora MUST NOT mostrar pagos de tarjeta; el tipo "Pago de tarjeta" MUST desaparecer del filtro de la Bitácora y las Entradas/Salidas/Neto MUST NOT incluirlos.

**Cálculos**

- **FR-013**: El monto "para no generar intereses" de un corte MUST ser lo registrado en esa tarjeta desde el último corte marcado (exclusivo) hasta ese corte (inclusivo): compras propias más cuotas MSI cuyo límite de pago es el de ese corte o anterior.
- **FR-014**: La deuda total de una tarjeta MUST ser todo lo registrado después del último corte marcado (incluido el periodo abierto) más las cuotas MSI futuras aún no cubiertas por una marca.
- **FR-015**: El patrimonio (deudas) y su historial mensual MUST usar la deuda total de FR-014.
- **FR-016**: Marcar o desmarcar MUST NOT cambiar el disponible para gastar de ninguna quincena ni ningún otro cálculo de presupuesto.
- **FR-017**: La línea de tiempo de Crédito MUST mostrar cada fecha límite con el monto del corte según FR-013, o como pagado si está marcado.

**Historial y datos**

- **FR-018**: Cada pago de tarjeta existente con monto MUST convertirse en una marca del corte que estaba pagando: el corte más reciente de esa tarjeta cuya fecha de corte es anterior a la fecha del pago. Varias conversiones sobre el mismo corte MUST producir una sola marca.
- **FR-019**: Tras la conversión, los montos de los pagos anteriores MUST NOT intervenir en ningún cálculo; un excedente anterior MUST NOT cubrir cortes posteriores.
- **FR-020**: El respaldo completo (exportación) MUST incluir las marcas de corte pagado; la bitácora en CSV MUST NOT incluir pagos de tarjeta.
- **FR-021**: El demo MUST mostrar cortes pasados pagados mediante marcas y al menos un corte reciente pendiente, y MUST bloquear marcar y desmarcar con el aviso de solo lectura.
- **FR-032**: Antes de aplicar la conversión de FR-018 a los datos reales, MUST poder revisarse qué cortes de cada tarjeta quedarían marcados como pagados.
- **FR-022**: Las marcas MUST pertenecer solo a su dueño, con el mismo aislamiento por usuario que el resto de los datos.

**Calidad**

**Sesión de pago del mes**

- **FR-025**: El rango de pago de un estado de cuenta MUST ir del día siguiente a su fecha de corte hasta el día anterior a su fecha límite (ajustada a día hábil), ambos inclusive.
- **FR-026**: La app MUST agrupar los estados de cuenta próximos de todas las tarjetas activas con términos completos en el menor número de sesiones tal que, en cada sesión, los rangos de pago de sus estados de cuenta se crucen al menos un día.
- **FR-027**: La ventana de cada sesión MUST durar 3 días (o todo el cruce si es más corto) y quedar completa dentro del cruce. Si algún día de pago (Preferencias) cae en el cruce, la ventana MUST incluir el primero de ellos, empezando en él o, si no caben 3 días antes del fin del cruce, terminando el último día del cruce. Si ningún día de pago cae en el cruce, MUST empezar el primer día del cruce.
- **FR-028**: Crédito MUST mostrar la próxima sesión (la primera cuya ventana termina hoy o después y tiene estados de cuenta sin marcar, o la siguiente si la actual ya está completa), con su ventana, cada tarjeta, su fecha límite, su estado y la acción "Ya la pagué" en las pendientes.
- **FR-029**: Desde 7 días antes del inicio de la ventana de una sesión con tarjetas pendientes, el Dashboard MUST mostrar "Próxima sesión de pago" con las fechas de la ventana y sus tarjetas; dentro de la ventana MUST cambiar a "Hoy toca pagar tus tarjetas" con cada tarjeta pendiente y su "Ya la pagué". Mientras se muestre el aviso de sesión, las tarjetas de esa sesión MUST NOT tener además su alerta individual; una tarjeta vencida conserva su alerta de vencida.
- **FR-030**: Una sesión con todas sus tarjetas marcadas o sin deuda registrada MUST mostrarse como completada, junto con la ventana de la siguiente sesión.
- **FR-031**: La sesión MUST calcularse en el cliente a partir de los términos de las tarjetas y las Preferencias, sin datos nuevos guardados ni recordatorios fuera de la app.

**Calidad**

- **FR-023**: Todo texto nuevo MUST existir en inglés y español; la función MUST verificarse en modo normal y demo, en ambos idiomas.
- **FR-024**: Las acciones "Ya la pagué" y "Desmarcar" MUST tener un área táctil de al menos 44 px y un nombre accesible que incluya la tarjeta.

### Key Entities

- **Marca de corte pagado**: indica que el dueño ya pagó al banco el estado de cuenta de una tarjeta que cerró en una fecha de corte concreta. Atributos: tarjeta, fecha de corte, cuándo se marcó. Una por tarjeta y fecha de corte. Sin monto.
- **Corte (estado de cuenta)**: derivado de los términos de la tarjeta (día de corte y días para pagar). Su estado es Pagado (cubierto por una marca propia o posterior), Pendiente (sin marca, antes de la fecha límite), Vencido (sin marca, después de la fecha límite) o Nada que pagar (sin deuda registrada).
- **Sesión de pago**: derivada, no se guarda. Agrupa un estado de cuenta próximo de una o más tarjetas cuyos rangos de pago se cruzan, con una ventana de hasta 3 días y un estado (pendiente o completada).
- **Pago de tarjeta (anterior)**: registro con monto que deja de usarse; existe solo como origen de la conversión a marcas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Marcar un corte como pagado toma un solo toque desde Crédito, Gastos o el Dashboard, sin abrir ningún formulario.
- **SC-002**: En el 100 % de los casos de prueba, registrar menos compras que el estado de cuenta real y marcar el corte deja el siguiente corte con solo sus propias compras (cero cortes futuros pagados por adelantado).
- **SC-003**: Deshacer o desmarcar devuelve el corte a su estado previo en menos de 1 s, sin recargar.
- **SC-004**: Después de la conversión, todos los cortes que estaban liquidados con los pagos anteriores del dueño aparecen "Pagado" y ninguno cambia a Vencido.
- **SC-005**: Ninguna vista (Gastos, Bitácora, exportación CSV) muestra un pago de tarjeta con monto.
- **SC-007**: Con las tarjetas del dueño, la app propone una sola sesión al mes siempre que sus rangos de pago se crucen, y en el 100 % de los casos de prueba la ventana queda completa dentro de todos los rangos (ninguna tarjeta se paga antes de su corte ni después de su fecha límite).
- **SC-008**: Marcar todas las tarjetas de una sesión desde su aviso en el Dashboard toma un toque por tarjeta, sin salir del Dashboard.
- **SC-006**: El disponible para gastar de todas las quincenas es idéntico antes y después de marcar o desmarcar cualquier corte.

## Assumptions

- El dueño es totalero: cuando paga, paga el estado de cuenta completo, así que una marca siempre significa "corte liquidado". El pago mínimo o parcial queda fuera de alcance.
- Lo que la familia compra con la tarjeta no se registra y no forma parte de la deuda que muestra la app; la app refleja solo las compras propias.
- La fecha en que se marcó se guarda como referencia, pero no se muestra ni afecta cálculos.
- La alerta individual de tarjeta del Dashboard conserva su ventana actual (7 días antes de la fecha límite, o vencida) para las tarjetas que no están cubiertas por un aviso de sesión (FR-029).
- La conversión de pagos anteriores se aplica una sola vez a los datos reales y al demo; los pagos con monto no se borran hasta que la conversión se verifica, pero dejan de usarse.
- La sesión de pago no envía notificaciones fuera de la app (Principio I: sin servidor ni tareas programadas); el aviso aparece al abrir el Dashboard.
- Los días de pago de la sesión son los de Preferencias (por defecto el 15 y el último día del mes); el spec 006 (quincena por día de pago real) podrá ajustarlos después.
- El cálculo de "pagado" usa los términos actuales de la tarjeta (día de corte y días para pagar, ajustados a día hábil como en el spec 007).
