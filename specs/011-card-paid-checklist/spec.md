# Feature Specification: Pago de tarjeta como checklist

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Spec 011 — Pago de tarjeta como checklist ("Ya la pagué"). Contexto del dueño: su familia usa sus tarjetas de crédito y le paga a él directamente; él solo registra SUS propias compras, y antes de la fecha límite paga al banco el total para no generar intereses (totalero). Por eso el monto que la app tiene registrado por corte es menor que el del estado de cuenta real, y registrar el monto real como pago deja un saldo a favor que oculta los cortes siguientes. Objetivo: que "Pagar tarjeta" funcione como una tarea por palomear por corte, sin capturar montos. Decisiones ya acordadas con el usuario: (1) Cada corte pendiente o vencido muestra una acción de un toque "Ya la pagué" (EN "Mark as paid") en lugar del diálogo con monto, en Crédito, en Gastos (tarjetas de crédito) y en la alerta del Dashboard; el diálogo de pago con monto y cuenta de origen desaparece, sin opción de "otro monto". (2) Marcar un corte como pagado lo deja en estado "Pagado", quita la alerta del Dashboard y hace que el siguiente corte empiece limpio: nunca genera saldo a favor ni hace que cortes futuros parezcan pagados. (3) Se puede desmarcar (Deshacer de 6 s como el resto de la app, y también desmarcar después). (4) El disponible para gastar no cambia: las compras ya se descontaron el día que se hicieron. (5) Lo que pasa si no se marca: el corte pasa a Vencido tras la fecha límite y la alerta permanece; definir cómo se ven la deuda total, patrimonio y bitácora con cortes marcados. (6) Los pagos de tarjeta ya registrados en el historial (datos reales del dueño y del demo) deben seguir siendo coherentes: definir migración o compatibilidad. (7) Las cuotas MSI de terceros siguen funcionando igual. (8) Atajo P y la opción "Pagar tarjeta" de la hoja ＋ se adaptan o se quitan. Debe verificarse en modo normal y demo, EN y ES."

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
- **FR-022**: Las marcas MUST pertenecer solo a su dueño, con el mismo aislamiento por usuario que el resto de los datos.

**Calidad**

- **FR-023**: Todo texto nuevo MUST existir en inglés y español; la función MUST verificarse en modo normal y demo, en ambos idiomas.
- **FR-024**: Las acciones "Ya la pagué" y "Desmarcar" MUST tener un área táctil de al menos 44 px y un nombre accesible que incluya la tarjeta.

### Key Entities

- **Marca de corte pagado**: indica que el dueño ya pagó al banco el estado de cuenta de una tarjeta que cerró en una fecha de corte concreta. Atributos: tarjeta, fecha de corte, cuándo se marcó. Una por tarjeta y fecha de corte. Sin monto.
- **Corte (estado de cuenta)**: derivado de los términos de la tarjeta (día de corte y días para pagar). Su estado es Pagado (cubierto por una marca propia o posterior), Pendiente (sin marca, antes de la fecha límite), Vencido (sin marca, después de la fecha límite) o Nada que pagar (sin deuda registrada).
- **Pago de tarjeta (anterior)**: registro con monto que deja de usarse; existe solo como origen de la conversión a marcas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Marcar un corte como pagado toma un solo toque desde Crédito, Gastos o el Dashboard, sin abrir ningún formulario.
- **SC-002**: En el 100 % de los casos de prueba, registrar menos compras que el estado de cuenta real y marcar el corte deja el siguiente corte con solo sus propias compras (cero cortes futuros pagados por adelantado).
- **SC-003**: Deshacer o desmarcar devuelve el corte a su estado previo en menos de 1 s, sin recargar.
- **SC-004**: Después de la conversión, todos los cortes que estaban liquidados con los pagos anteriores del dueño aparecen "Pagado" y ninguno cambia a Vencido.
- **SC-005**: Ninguna vista (Gastos, Bitácora, exportación CSV) muestra un pago de tarjeta con monto.
- **SC-006**: El disponible para gastar de todas las quincenas es idéntico antes y después de marcar o desmarcar cualquier corte.

## Assumptions

- El dueño es totalero: cuando paga, paga el estado de cuenta completo, así que una marca siempre significa "corte liquidado". El pago mínimo o parcial queda fuera de alcance.
- Lo que la familia compra con la tarjeta no se registra y no forma parte de la deuda que muestra la app; la app refleja solo las compras propias.
- La fecha en que se marcó se guarda como referencia, pero no se muestra ni afecta cálculos.
- La alerta del Dashboard conserva su ventana actual (7 días antes de la fecha límite, o vencida).
- La conversión de pagos anteriores se aplica una sola vez a los datos reales y al demo; los pagos con monto no se borran hasta que la conversión se verifica, pero dejan de usarse.
- El cálculo de "pagado" usa los términos actuales de la tarjeta (día de corte y días para pagar, ajustados a día hábil como en el spec 007).
