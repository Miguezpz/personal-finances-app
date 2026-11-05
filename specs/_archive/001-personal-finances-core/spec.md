# Feature Specification: Personal Finances Core

**Feature Branch**: `001-personal-finances-core`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Crea la especificación funcional completa basándote en @project-resume.md. Detalla las reglas del motor de ingresos (splitter), la deducción programada de gastos fijos, el semáforo de liquidez quincenal (Safe-to-Spend), la gestión de deudas/MSI a terceros, la paridad cambiaria en tiempo real (MXN/USD/EUR) y el toggle EN/ES."

## Clarifications

### Session 2026-10-31

- Q: Cuando termina una quincena y sobra o falta dinero en Needs o Wants, ¿qué pasa con ese saldo en la quincena siguiente? → A: Se arrastra: el sobrante suma y el déficit resta en la misma bolsa (Needs o Wants) de la quincena siguiente.
- Q: Cuando pagas un gasto con tarjeta de crédito, ¿en qué momento baja el Safe-to-Spend? → A: En la fecha de la compra; el pago de la tarjeta es una liquidación de deuda que no vuelve a afectar Needs ni Wants.
- Q: Un ingreso fijo recibido en el día de pago, ¿alimenta la quincena que empieza o la que termina? → A: La quincena que comienza con el pago (el del día 15 cubre del 16 a fin de mes; el del último día cubre del 1 al 15 del mes siguiente).
- Q: Un gasto fijo, ¿se resta del Safe-to-Spend desde el primer día de la quincena o solo en su día de cargo? → A: Se reserva desde el primer día de la quincena como "pendiente" y pasa a "aplicado" al llegar su día de cargo; el saldo disponible es el mismo en ambos estados.
- Q: Cuando un deudor paga una mensualidad, ¿ese dinero suma al Safe-to-Spend? → A: No; queda fuera del presupuesto personal: solo reduce el saldo del deudor y se muestra como "destinado al pago de la tarjeta".

### Session 2026-11-01

Decisiones tomadas por el criterio más simple y acorde a Zero-Cost, a partir del análisis de consistencia:

- Base del semáforo → la asignación de la quincena más el arrastre positivo (no se incluye el arrastre negativo).
- Ventana de alertas de cobro → 7 días fijos (no configurable).
- "Gastos vitales" del fondo de emergencia → promedio mensual de los gastos aplicados en Needs de los últimos 3 meses completos.
- Patrimonio neto → saldos iniciales de cuentas que no son tarjeta + inversión acumulada + aportaciones a metas desde Needs/Wants + cobros pendientes a terceros + saldo disponible de Needs y Wants, menos la deuda total de tarjetas.
- "Tiempo real" de la paridad cambiaria → tasa vigente publicada por la fuente (normalmente una actualización diaria), siempre mostrada con su fecha.
- Pago "totalero" con MSI a terceros → incluye solo las mensualidades cuyo límite de pago cae en el estado de cuenta vigente, no el total del MSI.
- Operaciones automáticas en segundo plano → no se ejecutan en demo (sin escrituras ni avisos).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Distribución automática de ingresos (Splitter) (Priority: P1)

El usuario configura una vez los porcentajes con los que quiere repartir sus ingresos fijos entre Inversiones, Necesidades (Needs) y Gustos (Wants), y la subdivisión del rubro de Inversión entre vehículos (p. ej. 90% Bolsa, 10% Sofipos). Cada vez que registra un ingreso recurrente, el sistema lo fragmenta automáticamente en bolsas, sin cálculos manuales.

**Why this priority**: Es la base del sistema: sin las bolsas asignadas no existe presupuesto, Safe-to-Spend ni metas. Entrega valor por sí sola al mostrar a dónde debe ir cada peso.

**Independent Test**: Configurar porcentajes, registrar un ingreso de $20,000 MXN y verificar que las bolsas y sub-bolsas de inversión muestran los montos esperados y que su suma es exactamente $20,000.

**Acceptance Scenarios**:

1. **Given** reglas configuradas de 50% Needs, 30% Wants, 20% Inversión, **When** el usuario registra un ingreso recurrente de $20,000 MXN, **Then** se crean asignaciones de $10,000 (Needs), $6,000 (Wants) y $4,000 (Inversión).
2. **Given** una sub-regla de inversión de 90% Bolsa y 10% Sofipos, **When** se distribuye el rubro de Inversión de $4,000, **Then** se asignan $3,600 a Bolsa y $400 a Sofipos.
3. **Given** porcentajes que no suman 100%, **When** el usuario intenta guardar la configuración, **Then** el sistema rechaza el guardado y explica la diferencia faltante o excedente.
4. **Given** un monto cuyo reparto produce fracciones de centavo, **When** se distribuye, **Then** la suma de las asignaciones es exactamente igual al ingreso original (el residuo de redondeo se asigna de forma determinista y documentada).
5. **Given** un ingreso fijo de $20,000 recibido el día 15, **When** se distribuye, **Then** las asignaciones financian la quincena del 16 al fin de mes y no alteran el Safe-to-Spend de la quincena que termina.
6. **Given** un ingreso fijo recibido el último día del mes, **When** se distribuye, **Then** las asignaciones financian la quincena del 1 al 15 del mes siguiente.
7. **Given** un ingreso que no es recurrente/fijo, **When** el usuario lo registra, **Then** el sistema pregunta si debe aplicarse la distribución por reglas o registrarse como ingreso sin repartir.

---

### User Story 2 - Semáforo de liquidez quincenal (Safe-to-Spend) (Priority: P1)

El usuario abre el dashboard y ve de inmediato cuánto puede gastar en la quincena actual, separado en Needs y Wants, con un indicador de color (semáforo) que refleja qué tan cerca está de agotar cada bolsa hasta el próximo día de pago.

**Why this priority**: Es la pantalla de uso diario y la propuesta de valor central: responder "¿cuánto puedo gastar hoy?" con un saldo real.

**Independent Test**: Con asignaciones, un gasto fijo programado y dos gastos manuales registrados, verificar que el saldo mostrado = asignación − fijos − manuales, por bolsa, y que el color corresponde al umbral.

**Acceptance Scenarios**:

1. **Given** una asignación de Wants de $3,000 en la quincena actual, un gasto fijo de $500 y gastos manuales por $700, **When** el usuario abre el dashboard, **Then** el Safe-to-Spend de Wants es $1,800.
2. **Given** un saldo disponible mayor o igual al 50% de la base (asignación de la quincena más el arrastre positivo), **When** se muestra el semáforo, **Then** aparece en verde; entre 20% y 49% en amarillo; menor a 20% o negativo en rojo.
3. **Given** que se registra un nuevo gasto manual, **When** se guarda, **Then** el saldo y el color se actualizan sin recargar la página.
4. **Given** un gasto que excede el saldo de su bolsa, **When** se guarda, **Then** el saldo se muestra negativo en rojo y el sistema no bloquea el registro.
5. **Given** el cambio de quincena, **When** el usuario abre la app en la quincena siguiente, **Then** el dashboard muestra la asignación, fijos y gastos de la nueva quincena más el saldo arrastrado de la quincena anterior en la misma bolsa.
6. **Given** que Wants cerró la quincena anterior con $400 de sobrante (o con −$400 de déficit), **When** inicia la nueva quincena con una asignación de $3,000, **Then** el Safe-to-Spend inicial de Wants es $3,400 (o $2,600), y Needs no se ve afectado.
7. **Given** una asignación de Wants de $3,000 con un arrastre positivo de $1,000 (base $4,000), **When** el saldo disponible es $1,800, **Then** el indicador es amarillo (45% de la base) y no verde.

---

### User Story 3 - Gastos fijos con deducción programada (Priority: P1)

El usuario da de alta pagos fijos (Renta, Internet, Netflix, Gimnasio) con monto, día de cargo mensual y subcategoría. El sistema los deduce automáticamente de la bolsa correcta (Needs o Wants) en la quincena a la que corresponde su día de cargo, sin captura manual cada mes.

**Why this priority**: Sin los fijos descontados, el Safe-to-Spend sería engañoso; además elimina la fricción de registrar lo mismo cada mes.

**Independent Test**: Dar de alta "Renta $8,000, día 1, Needs" y verificar que se descuenta automáticamente en la quincena 1–15 de cada mes en la bolsa de Needs, sin intervención del usuario.

**Acceptance Scenarios**:

1. **Given** un gasto fijo de $8,000 con día de cargo 5, **When** inicia la quincena 1–15, **Then** el Safe-to-Spend ya lo descuenta como "pendiente" y, al llegar el día 5, pasa a "aplicado" sin que el saldo cambie.
2. **Given** un gasto fijo con día de cargo 20, **When** se abre la quincena 16–fin de mes, **Then** se deduce en esa quincena y no en la primera.
3. **Given** un día de cargo 31 en un mes de 30 días (o 29/30/31 en febrero), **When** se calcula la quincena, **Then** el cargo se ubica en el último día del mes y en la segunda quincena.
4. **Given** una app que no se abrió durante varios días, **When** el usuario la abre, **Then** todos los fijos vencidos desde la última sesión aparecen aplicados, sin duplicados ni omisiones.
5. **Given** un gasto fijo editado o pausado, **When** se guarda el cambio, **Then** solo afecta a periodos futuros y no altera el historial ya aplicado.
6. **Given** un fijo que el usuario elimina o pausa, **When** pasa su día de cargo, **Then** no se deduce.

---

### User Story 4 - Registro de gastos con auto-clasificación (Priority: P2)

El usuario registra un gasto eventual indicando monto, fecha, subcategoría y método de pago; el sistema hereda automáticamente la categoría macro (Needs/Wants) de la subcategoría elegida.

**Why this priority**: Es la entrada de datos diaria que alimenta el Safe-to-Spend, pero depende de que ya existan bolsas y categorías.

**Independent Test**: Registrar un gasto con la subcategoría "Supermercado" (Needs) y verificar que se descuenta de la bolsa Needs sin que el usuario elija la categoría macro.

**Acceptance Scenarios**:

1. **Given** una subcategoría vinculada a Wants, **When** el usuario registra un gasto con ella, **Then** el gasto se asigna a Wants.
2. **Given** una fecha del gasto dentro de una quincena anterior, **When** se guarda, **Then** afecta a esa quincena y no a la actual.
3. **Given** un monto vacío, cero o negativo, **When** se intenta guardar, **Then** el sistema lo rechaza con un mensaje claro.
4. **Given** un gasto de $500 pagado con tarjeta de crédito, **When** se registra, **Then** el Safe-to-Spend de su bolsa baja $500 ese día y la deuda de la tarjeta sube $500.
5. **Given** el pago de $500 de esa tarjeta, **When** se registra como pago de tarjeta, **Then** la deuda de la tarjeta baja $500 y el Safe-to-Spend no cambia.

---

### User Story 5 - Cuentas por cobrar y MSI a terceros (Priority: P2)

El usuario registra compras a meses sin intereses (MSI) hechas con su tarjeta para otra persona: monto, plazo, deudor y tarjeta. El sistema genera el calendario de cobros por mensualidad, anticipado a la fecha de corte/pago de la tarjeta, avisa cuándo cobrar y mantiene estos cargos fuera de las estadísticas de gasto personal.

**Why this priority**: Evita que el dinero adelantado a terceros distorsione el presupuesto personal y asegura que el usuario cobre a tiempo.

**Independent Test**: Registrar una compra de $12,000 a 6 MSI para un deudor y verificar el calendario de 6 cobros de $2,000, con fechas anteriores al límite de pago de la tarjeta, y que el gasto personal del periodo no cambia.

**Acceptance Scenarios**:

1. **Given** una compra de $12,000 a 6 MSI, **When** se registra, **Then** se generan 6 mensualidades que suman exactamente $12,000.
2. **Given** una tarjeta con fecha de corte y fecha límite de pago, **When** se genera el calendario, **Then** cada fecha de cobro al deudor cae antes de la fecha límite de pago de la mensualidad correspondiente.
3. **Given** una fecha de cobro próxima o vencida, **When** el usuario abre la app, **Then** aparece una alerta dentro de la app indicando deudor, monto y fecha.
4. **Given** que el deudor paga una mensualidad, **When** el usuario la marca como cobrada, **Then** el saldo pendiente del deudor disminuye y el registro queda en el historial.
5. **Given** cargos a terceros registrados, **When** el usuario consulta métricas de gasto personal y Safe-to-Spend, **Then** estos cargos no se incluyen.
6. **Given** un deudor que paga una mensualidad de $2,000, **When** el usuario la marca como cobrada, **Then** el Safe-to-Spend no cambia, el saldo del deudor baja $2,000 y el monto aparece como "destinado al pago de la tarjeta".
7. **Given** un deudor con varias compras, **When** el usuario consulta su ficha, **Then** ve el saldo total pendiente y el detalle por compra.

---

### User Story 6 - Visualización multi-divisa con tipo de cambio vigente (Priority: P2)

El usuario cambia la divisa de visualización entre MXN, USD y EUR. Al abrir la app se consulta la paridad vigente y todos los montos mostrados (patrimonio neto, saldos, gráficas) se expresan en la divisa elegida, sin modificar los datos guardados en MXN.

**Why this priority**: Aporta valor internacional al portafolio y comparabilidad, pero la app es plenamente usable solo en MXN.

**Independent Test**: Con un patrimonio de $100,000 MXN y una paridad de 17.00 MXN/USD, seleccionar USD y verificar que se muestra $5,882.35; regresar a MXN y verificar que los datos son idénticos a los originales.

**Acceptance Scenarios**:

1. **Given** paridades vigentes, **When** el usuario selecciona USD o EUR, **Then** todos los montos del dashboard se convierten y se identifican con su divisa.
2. **Given** una divisa de visualización seleccionada, **When** se registra un gasto, **Then** el monto se captura y almacena en MXN (nunca en la divisa convertida).
3. **Given** que el servicio de tipos de cambio no responde, **When** el usuario intenta ver USD/EUR, **Then** la app sigue mostrando MXN, indica que la paridad no está disponible y ofrece reintentar; si hay una paridad previa recordada, la muestra marcada como "no actualizada" con su fecha.
4. **Given** una divisa elegida, **When** el usuario recarga o regresa a la app, **Then** la preferencia se conserva.
5. **Given** la paridad obtenida, **When** se muestra la conversión, **Then** se informa la tasa utilizada y la fecha/hora de su última actualización.

---

### User Story 7 - Alternancia de idioma EN/ES (Priority: P2)

La interfaz se presenta en inglés por defecto. Un interruptor global en la navegación cambia al instante todo el texto a español y viceversa, conservando la preferencia.

**Why this priority**: Requisito de portafolio y accesibilidad; no bloquea la funcionalidad financiera.

**Independent Test**: Abrir la app por primera vez (inglés), activar ES y verificar que todas las pantallas, mensajes de error y notificaciones están en español sin textos mezclados.

**Acceptance Scenarios**:

1. **Given** una primera visita, **When** carga la app, **Then** la interfaz está en inglés.
2. **Given** el interruptor de idioma, **When** el usuario selecciona ES, **Then** todos los textos visibles cambian sin recargar ni perder el estado de la pantalla.
3. **Given** un idioma seleccionado, **When** el usuario vuelve a abrir la app, **Then** se conserva su elección.
4. **Given** un idioma activo, **When** se muestran números, divisas y fechas, **Then** siguen las convenciones de formato de ese idioma.
5. **Given** categorías por defecto y mensajes del sistema, **When** se cambia de idioma, **Then** también se traducen; los nombres creados por el usuario se muestran tal como los escribió.

---

### User Story 8 - Configuración global, catálogo y bitácora (Priority: P3)

El usuario administra porcentajes de distribución, subcategorías vinculadas a una categoría padre, y un catálogo de cuentas, tarjetas y plataformas de inversión con fechas de corte y tipo de instrumento. Puede consultar y exportar a CSV la bitácora completa de movimientos.

**Why this priority**: Soporta las demás historias y el respaldo de datos, pero puede iniciar con valores por defecto.

**Independent Test**: Crear una tarjeta con fecha de corte, una subcategoría vinculada a Wants y exportar la bitácora a CSV verificando que contiene todos los movimientos.

**Acceptance Scenarios**:

1. **Given** el catálogo, **When** el usuario da de alta una tarjeta con fecha de corte y fecha límite de pago, **Then** queda disponible como método de pago y para MSI.
2. **Given** la bitácora, **When** el usuario filtra por fecha, categoría o cuenta, **Then** se listan solo los movimientos que coinciden.
3. **Given** el botón "Exportar datos", **When** se activa, **Then** se descarga un CSV con todo el historial en MXN.
4. **Given** una subcategoría con movimientos, **When** el usuario intenta eliminarla, **Then** el sistema impide la eliminación o exige reasignar los movimientos.

---

### User Story 9 - Privacidad y modo demo para reclutadores (Priority: P3)

El usuario activa un Modo Privacidad que enmascara todos los importes y ejes de gráficas. Un visitante externo accede con un botón "Explorar Demo / Reclutadores" a una versión navegable con datos ficticios en solo lectura.

**Why this priority**: Protege la privacidad y habilita el portafolio, pero no altera la lógica financiera central.

**Independent Test**: Activar privacidad y confirmar que ningún importe es legible en ninguna pantalla; entrar al demo, intentar crear un gasto y recibir el aviso de solo lectura sin que se guarde nada.

**Acceptance Scenarios**:

1. **Given** el Modo Privacidad activo, **When** el usuario navega por cualquier pantalla, **Then** montos, saldos y ejes de gráficas aparecen enmascarados.
2. **Given** el Modo Privacidad, **When** se recarga la app, **Then** conserva su estado.
3. **Given** el modo demo, **When** el visitante intenta crear, editar o eliminar, **Then** aparece una notificación de "demo de solo lectura" y no se modifica ningún dato.
4. **Given** el modo demo, **When** el visitante navega, **Then** ve dashboards, filtros y gráficas con datos ficticios verosímiles, sin datos reales del propietario.

---

### User Story 10 - Crédito, patrimonio y metas (Priority: P3)

El usuario ve una línea de tiempo que cruza sus días de pago con las fechas límite de sus tarjetas, con el "Pago para no generar intereses" destacado. Además mantiene un fondo de emergencia, apartados (sinking funds) y una gráfica histórica de patrimonio neto.

**Why this priority**: Complementa el control del flujo de caja con visión de largo plazo; es valioso pero posterior al núcleo.

**Independent Test**: Con una tarjeta con saldo, verificar que la línea de tiempo muestra el pago total para no generar intereses y su fecha límite; crear un apartado anual y verificar la fracción mensual retenida.

**Acceptance Scenarios**:

1. **Given** una tarjeta con saldo, **When** el usuario abre la gestión de crédito, **Then** se destaca el pago para no generar intereses y no se promueve el pago mínimo.
1a. **Given** una tarjeta con $3,000 de compras directas hasta el último corte y una compra a terceros de $12,000 a 6 MSI, **When** el usuario abre la gestión de crédito, **Then** el pago para no generar intereses es $5,000 ($3,000 más una mensualidad de $2,000) y la deuda total mostrada incluye los $10,000 restantes del MSI.
2. **Given** un apartado de $12,000 anuales, **When** transcurre cada mes, **Then** se retiene $1,000 mensuales de la bolsa definida.
3. **Given** un fondo de emergencia con meta de N meses, **When** el usuario lo consulta, **Then** ve el avance contra N veces su gasto vital promedio.
4. **Given** activos y deudas registrados, **When** se abre la gráfica de patrimonio neto, **Then** muestra la evolución histórica de activos menos deudas.

---

### Edge Cases

- Ingreso registrado sin reglas configuradas: se solicita configurar porcentajes antes de distribuir o se ofrece registrarlo sin repartir.
- Porcentaje de una bolsa en 0%: la bolsa existe con asignación $0 y el semáforo la muestra sin dividir entre cero.
- Gasto fijo cuyo día de cargo es 15 o 16: debe ubicarse sin ambigüedad en una sola quincena (ver Supuestos).
- Fijos que superan la asignación de su bolsa: el saldo queda negativo y en rojo, con aviso.
- Cambio de reglas de distribución a mitad de quincena: el cambio aplica a ingresos futuros; las asignaciones ya generadas no se alteran.
- Cambio de reglas el mismo día en que ya se registró un ingreso con la regla vigente: la nueva regla rige desde el día siguiente y la regla de ese día no se modifica.
- Déficit arrastrado mayor que la asignación de la nueva quincena: el saldo inicial queda negativo y en rojo desde el primer día.
- Edición de un gasto en una quincena cerrada: todos los saldos arrastrados de las quincenas posteriores se recalculan.
- Ingreso registrado dos veces por error: el usuario puede eliminarlo o editarlo y las asignaciones derivadas se recalculan.
- MSI con plazo de 1 mes, o monto que no divide exacto: la suma de mensualidades siempre iguala el total (el residuo va en la última mensualidad).
- Tarjeta eliminada con MSI activos: se impide la eliminación mientras existan cobros pendientes.
- Tipo de cambio inválido, cero o con variación anómala: la conversión no se aplica y se informa al usuario.
- Primera carga tras inactividad prolongada de la base de datos: se muestran estados de carga y reintento, sin errores crudos.
- Usuario sin conexión: puede ver el último dato cargado y se le informa que los cambios no se pueden guardar.
- Cambio de idioma o divisa mientras hay un formulario a medias: el contenido capturado no se pierde.

## Requirements *(mandatory)*

### Functional Requirements

**Motor de ingresos (Splitter)**

- **FR-001**: El sistema MUST permitir configurar el porcentaje de ingresos fijos destinado a Inversión, Needs y Wants, y MUST exigir que la suma sea exactamente 100%.
- **FR-002**: El sistema MUST permitir definir sub-reglas porcentuales para el rubro de Inversión entre vehículos del catálogo, con suma exacta de 100%.
- **FR-003**: Al registrar un ingreso recurrente, el sistema MUST dividirlo automáticamente en asignaciones por bolsa y sub-bolsa de inversión según las reglas vigentes.
- **FR-004**: La suma de las asignaciones MUST ser exactamente igual al ingreso original; el residuo de redondeo MUST asignarse de forma determinista.
- **FR-005**: Los cambios a las reglas MUST aplicar solo a ingresos posteriores y MUST NOT modificar asignaciones ya generadas.
- **FR-006**: El sistema MUST asociar las asignaciones de un ingreso fijo a la quincena que comienza con su día de pago (el ingreso del día 15 financia del 16 a fin de mes; el del último día financia del 1 al 15 del mes siguiente), y MUST registrar el ingreso en la bitácora con su fecha real de recepción.

**Gastos fijos y deducción programada**

- **FR-007**: El usuario MUST poder crear, editar, pausar y eliminar gastos fijos con nombre, monto, día de cargo mensual y subcategoría.
- **FR-008**: El sistema MUST deducir cada gasto fijo de la bolsa (Needs o Wants) heredada de su subcategoría, en la quincena que contiene su día de cargo.
- **FR-008a**: Los gastos fijos de una quincena MUST reservarse (restarse del Safe-to-Spend) desde el primer día de esa quincena con estado "pendiente", y MUST pasar a "aplicado" al llegar su día de cargo sin cambiar el saldo disponible; el dashboard MUST distinguir visualmente ambos estados.
- **FR-009**: Para días de cargo inexistentes en un mes (p. ej. 31 en un mes corto), el sistema MUST aplicar el cargo en el último día del mes.
- **FR-010**: El sistema MUST aplicar todos los fijos vencidos desde la última sesión del usuario, sin duplicados ni omisiones, sin depender de procesos en servidor.
- **FR-011**: Los cambios a un gasto fijo MUST aplicar solo a periodos futuros; los cargos ya aplicados MUST conservarse como historial.
- **FR-012**: Los cargos fijos aplicados MUST aparecer en la bitácora identificados como automáticos.

**Registro de gastos**

- **FR-013**: El usuario MUST poder registrar un gasto con monto positivo, fecha, subcategoría y método de pago.
- **FR-013a**: Un gasto pagado con tarjeta de crédito MUST descontarse de su bolsa (Needs o Wants) en la fecha de la compra y MUST incrementar el saldo adeudado de esa tarjeta.
- **FR-013b**: El pago de una tarjeta MUST registrarse como una liquidación de deuda (movimiento de tipo "pago de tarjeta") que reduce el saldo adeudado y MUST NOT volver a descontarse de Needs ni Wants.
- **FR-014**: El sistema MUST heredar la categoría macro (Needs/Wants) de la subcategoría elegida, sin pedirla al usuario.
- **FR-015**: El usuario MUST poder crear subcategorías personalizadas vinculadas a una categoría padre, y editar o eliminar gastos registrados.

**Semáforo de liquidez (Safe-to-Spend)**

- **FR-016**: El dashboard MUST mostrar, para la quincena actual y por separado para Needs y Wants, el saldo disponible = saldo arrastrado de la quincena anterior (positivo o negativo) + asignación − gastos fijos − gastos manuales − aportaciones a metas (fondo de emergencia y apartados) cuya bolsa de origen sea esa bolsa.
- **FR-016a**: El sistema MUST arrastrar al cierre de cada quincena el sobrante o déficit de cada bolsa (Needs y Wants) a la misma bolsa de la quincena siguiente, y MUST recalcular la cadena de saldos posteriores si se edita o elimina un movimiento de una quincena pasada.
- **FR-017**: El sistema MUST mostrar el saldo con un indicador de color calculado sobre la base = asignación de la quincena + arrastre positivo (el arrastre negativo no aumenta la base): verde (≥ 50% de la base), amarillo (20%–49%) y rojo (< 20% o saldo negativo). Si la base es 0, el indicador es rojo con saldo negativo y neutral con saldo 0.
- **FR-018**: El saldo MUST actualizarse inmediatamente al registrar, editar o eliminar cualquier gasto o ingreso.
- **FR-019**: El dashboard MUST indicar los días restantes hasta el próximo día de pago.
- **FR-020**: Los cargos a terceros (MSI) MUST excluirse del cálculo de Safe-to-Spend y de las métricas de gasto personal.
- **FR-021**: El sistema MUST permitir saldos negativos y mostrarlos claramente sin bloquear el registro.

**Cuentas por cobrar y MSI**

- **FR-022**: El usuario MUST poder registrar una compra a terceros con monto, plazo en meses, deudor y tarjeta del catálogo.
- **FR-023**: El sistema MUST generar el calendario de mensualidades, cuya suma sea exactamente el monto total, con el residuo de redondeo en la última mensualidad.
- **FR-024**: Las fechas de cobro sugeridas MUST anticiparse a la fecha límite de pago de la tarjeta para cada mensualidad.
- **FR-025**: El sistema MUST mostrar alertas dentro de la app para cobros vencidos y para los que vencen en los próximos 7 días (ventana fija), calculadas al abrir la aplicación.
- **FR-026**: El usuario MUST poder marcar cada mensualidad como cobrada, parcial o pendiente, y consultar el saldo pendiente por deudor y por compra.
- **FR-026a**: El cobro de una mensualidad MUST NOT sumarse al Safe-to-Spend ni a ninguna bolsa; solo MUST reducir el saldo pendiente del deudor y MUST mostrarse como dinero "destinado al pago de la tarjeta" utilizada.
- **FR-027**: Los movimientos de cuentas por cobrar MUST aparecer en la bitácora etiquetados como "terceros" y MUST ser filtrables.

**Crédito, patrimonio y metas**

- **FR-028**: El sistema MUST mostrar una línea de tiempo con días de pago de ingresos y fechas límite de pago de tarjetas.
- **FR-029**: El sistema MUST destacar el pago para no generar intereses como monto principal, sin promover el pago mínimo. Ese monto = compras directas con fecha hasta el último corte + mensualidades de compras a terceros (MSI) cuyo límite de pago cae en el estado de cuenta vigente − pagos de tarjeta posteriores a ese corte (mínimo 0); NO incluye las mensualidades futuras del MSI. La deuda total de la tarjeta sí incluye el saldo pendiente completo de los MSI.
- **FR-030**: El usuario MUST poder definir un fondo de emergencia con meta en meses de gastos vitales (promedio mensual de los gastos aplicados en Needs de los últimos 3 meses completos), y apartados (sinking funds) con monto anual y retención mensual.
- **FR-031**: El sistema MUST mostrar una gráfica histórica de patrimonio neto (activos menos deudas), donde activos = saldos iniciales de las cuentas que no son tarjeta + asignaciones acumuladas a Inversión + aportaciones a metas desde Needs/Wants + cobros pendientes a terceros + saldo disponible actual de Needs y Wants, y deudas = deuda total de tarjetas.

**Multi-divisa**

- **FR-032**: Todos los montos MUST capturarse, almacenarse y exportarse en MXN, que es la única fuente de verdad.
- **FR-033**: Al cargar la aplicación, el sistema MUST obtener las paridades vigentes MXN/USD y MXN/EUR de una fuente pública gratuita; "vigente" significa la tasa más reciente publicada por la fuente (normalmente una actualización diaria, no cotización en vivo).
- **FR-034**: El usuario MUST poder cambiar la divisa de visualización entre MXN, USD y EUR, aplicándose a patrimonio neto, saldos, listados y gráficas sin alterar los datos originales.
- **FR-035**: El sistema MUST mostrar la tasa utilizada y la fecha/hora de su última actualización.
- **FR-036**: Si las paridades no están disponibles, el sistema MUST seguir operando en MXN, informar al usuario y permitir reintentar; MAY usar la última paridad conocida marcándola como no actualizada.
- **FR-037**: La divisa de visualización elegida MUST conservarse entre sesiones.

**Internacionalización**

- **FR-038**: La interfaz MUST estar en inglés por defecto y MUST ofrecer un interruptor global para cambiar a español y viceversa.
- **FR-039**: El cambio de idioma MUST aplicarse a todo texto de la interfaz, mensajes de error y notificaciones, de inmediato y sin perder el estado de la pantalla.
- **FR-040**: El idioma elegido MUST conservarse entre sesiones y los números, divisas y fechas MUST formatearse según el idioma activo.

**Configuración, bitácora y respaldo**

- **FR-041**: El usuario MUST poder administrar un catálogo de cuentas, tarjetas y plataformas de inversión con fechas de corte, fecha límite de pago y tipo de instrumento.
- **FR-042**: El sistema MUST ofrecer una bitácora filtrable por fecha, categoría, cuenta y tipo de movimiento.
- **FR-043**: El sistema MUST permitir exportar el historial completo a CSV desde un botón "Exportar datos".
- **FR-044**: El sistema MUST registrar únicamente texto y números; no se admite la carga de imágenes ni archivos.

**Privacidad y demo**

- **FR-045**: El usuario MUST poder activar un Modo Privacidad global que enmascare todos los montos, saldos y ejes de gráficas, y cuyo estado se conserve entre sesiones.
- **FR-046**: La pantalla de inicio MUST incluir un acceso "Explorar Demo / Reclutadores" a una experiencia con datos ficticios.
- **FR-047**: En modo demo toda acción de crear, editar o eliminar iniciada por el usuario MUST bloquearse y notificar que la demo es de solo lectura; MUST NOT persistirse ningún cambio.
- **FR-047a**: En modo demo las operaciones automáticas en segundo plano (aplicar gastos fijos, generar aportaciones a metas, guardar instantáneas de patrimonio, cargar valores iniciales) MUST NOT ejecutarse ni mostrar avisos de solo lectura.
- **FR-048**: Los datos de la demo MUST ser ficticios y MUST NOT incluir información financiera real del propietario.
- **FR-049**: Los datos financieros de un usuario MUST ser accesibles únicamente por ese usuario autenticado.
- **FR-050**: El sistema MUST mostrar estados de carga y reintento claros cuando los datos tarden en responder tras un periodo de inactividad.

### Key Entities *(include if feature involves data)*

- **Quincena (Pay Period)**: Periodo de presupuesto de medio mes (1–15 y 16–fin de mes). Agrupa ingresos, asignaciones, fijos y gastos; tiene un día de pago.
- **Ingreso (Income)**: Entrada de capital con monto MXN, fecha de recepción, tipo (recurrente o no) y quincena que financia (la que comienza con su día de pago).
- **Regla de Distribución (Distribution Rule)**: Porcentajes de Inversión, Needs y Wants, con sub-reglas de inversión por vehículo; con vigencia temporal.
- **Asignación (Allocation)**: Monto resultante de aplicar una regla a un ingreso, por bolsa y quincena.
- **Bolsa (Bucket)**: Contenedor de presupuesto (Needs, Wants, Inversión y sub-bolsas de inversión) con saldo disponible por quincena.
- **Categoría / Subcategoría**: Jerarquía de clasificación; la subcategoría pertenece a una categoría macro (Needs/Wants).
- **Gasto Fijo (Recurring Expense)**: Pago mensual con monto, día de cargo, subcategoría y estado (activo/pausado).
- **Gasto (Expense)**: Salida eventual o aplicada automáticamente, con monto, fecha, subcategoría, método de pago y origen (manual/automático).
- **Cuenta / Tarjeta / Plataforma (Account)**: Elemento del catálogo con tipo de instrumento, fecha de corte y fecha límite de pago.
- **Deudor (Debtor)**: Persona que debe dinero por compras a terceros; agrupa saldo pendiente.
- **Cuenta por Cobrar (Receivable / MSI Purchase)**: Compra a terceros con monto total, plazo, deudor y tarjeta.
- **Mensualidad (Installment)**: Cobro individual de una cuenta por cobrar con fecha, monto y estado (pendiente/parcial/cobrada).
- **Tipo de Cambio (Exchange Rate)**: Paridad MXN→USD/EUR con fecha/hora de obtención y estado de vigencia (efímera, no es dato del usuario).
- **Meta (Goal)**: Fondo de emergencia o apartado con objetivo, avance y retención mensual.
- **Preferencias**: Idioma, divisa de visualización y Modo Privacidad.
- **Movimiento (Ledger Entry)**: Registro de bitácora de cualquier flujo de caja, con origen y etiquetas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras registrar un ingreso recurrente, el 100% de las asignaciones suman exactamente el monto original (diferencia $0.00).
- **SC-002**: El usuario puede registrar un gasto eventual en menos de 20 segundos.
- **SC-003**: El usuario identifica su Safe-to-Spend de Needs y Wants en menos de 5 segundos tras abrir la app.
- **SC-004**: Tras registrar un gasto, el saldo y el color del semáforo se actualizan en menos de 1 segundo percibido.
- **SC-005**: El 100% de los gastos fijos con cargo vencido aparecen aplicados exactamente una vez al abrir la app, sin captura manual.
- **SC-006**: En una compra a terceros a N MSI, las N mensualidades suman exactamente el total y el 100% de las fechas de cobro sugeridas anteceden al límite de pago de la tarjeta.
- **SC-007**: Los cargos a terceros tienen un impacto de $0 en las métricas de gasto personal y Safe-to-Spend.
- **SC-008**: Al cambiar a USD o EUR, el 100% de los importes mostrados se convierten y al regresar a MXN los valores coinciden exactamente con los originales.
- **SC-009**: Si el servicio de tipos de cambio falla, el 100% de las funciones en MXN siguen operativas y el usuario es informado en menos de 10 segundos.
- **SC-010**: El 100% del texto de la interfaz está disponible en inglés y español, y el cambio de idioma se percibe como instantáneo (menos de 1 segundo) sin perder datos capturados.
- **SC-011**: Con el Modo Privacidad activo, 0 importes son legibles en cualquier pantalla.
- **SC-012**: Un visitante del demo puede explorar todos los dashboards en menos de 2 minutos y 0 de sus acciones modifica datos persistentes.
- **SC-013**: El historial completo puede exportarse a CSV en menos de 10 segundos para al menos 5 años de datos de uso personal.
- **SC-014**: La operación continua del producto no genera costo recurrente.

## Assumptions

- **Terminología**: "Needs" = Necesidades y "Wants" = Gustos (los términos en inglés se usan en la interfaz EN y los equivalentes en la ES); "Safe-to-Spend" = saldo disponible de una bolsa en la quincena actual; "semáforo" = el indicador de color de ese saldo.

- **Usuario único**: la app es de uso personal para un solo propietario autenticado; no hay roles ni cuentas compartidas. El visitante del demo no se autentica.
- **Quincenas**: la primera quincena abarca los días 1–15 y la segunda del 16 al último día del mes; los días de pago son el 15 y el último día (ajustables en configuración). Un gasto fijo con día de cargo 1–15 pertenece a la primera quincena y con 16–31 a la segunda.
- **Gastos fijos y Needs/Wants**: cada fijo se descuenta de la quincena en que cae su día de cargo, tomando el 100% de su monto en esa quincena (no se prorratea entre ambas).
- **Umbrales del semáforo**: verde ≥ 50%, amarillo 20%–49%, rojo < 20% o negativo del monto asignado, valores por defecto del producto.
- **Redondeo**: los importes se manejan a centavos; el residuo de redondeo se asigna a la bolsa de mayor porcentaje (en el reparto de ingresos) o a la última mensualidad (en MSI).
- **MSI**: las compras a terceros son a meses sin intereses (sin costo financiero); el cobro al deudor es mensual por montos iguales.
- **Alertas**: las notificaciones son dentro de la aplicación y se calculan al abrirla; no hay notificaciones push, correo ni SMS.
- **Tipos de cambio**: se obtienen una vez por carga de la aplicación desde una fuente pública gratuita (tasa diaria, mostrada con su fecha); los valores convertidos son solo informativos y no tienen efecto contable.
- **Moneda**: todas las operaciones del usuario ocurren en MXN; no se registran movimientos nativos en USD o EUR.
- **Conectividad**: se requiere conexión para guardar cambios; sin conexión solo se visualiza la última información cargada.
- **Dispositivos**: la interfaz es web responsiva y utilizable en móvil y escritorio.
- **Fuera de alcance (v1)**: carga de imágenes/recibos, conciliación bancaria automática, importación de estados de cuenta, cálculo de intereses, múltiples usuarios y notificaciones push.
- **Gobernanza**: esta especificación se rige por la constitución del proyecto (Zero-Cost, privacidad, aislamiento del demo, MXN como fuente única de verdad e i18n).
