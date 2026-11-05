# Feature Specification: Taxonomía completa, tipos de ingreso e íconos

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Spec 004 — Taxonomía completa, tipos de ingreso e íconos. Fuente: plan `entonces-comencemos-a-planear-compiled-abelson.md`. Tipo de ingreso obligatorio con 8 valores más 'otro'; ícono opcional en categorías y subcategorías; rellenar la cuenta existente (claves de traducción, íconos y la categoría Previous Balances en Needs); la taxonomía personal de 26 categorías como default de la app, el demo y las cuentas nuevas; ícono por categoría con selector en el editor de taxonomía; tipo de ingreso en el formulario, la lista de ingresos y el CSV; íconos decorativos minimalistas en tipo de cuenta, bucket, ledger, cobros, metas, KPIs y fechas de tarjeta, más un estado vacío y un encabezado de página compartidos; EN/ES. Fuera de alcance: tercer bucket Debt y catálogo editable de tipos de ingreso."

## Clarifications

### Session 2026-11-05

- Q: ¿Cada subcategoría tiene su propio ícono editable, o solo las categorías y las subcategorías heredan? → A: Las subcategorías heredan el ícono de su categoría y pueden tener uno propio opcional, elegido en el editor.
- Q: ¿El tipo viene preseleccionado en "Otro" en el formulario de nuevo ingreso, o hay que elegirlo? → A: Sin preselección; el formulario no deja guardar hasta elegir un tipo.
- Q: ¿Cómo se resuelven las traducciones ES de las 26 categorías y sus subcategorías? → A: Solo se traducen las 26 categorías; las subcategorías se muestran con su nombre en inglés en los dos idiomas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mi taxonomía es la de la app (Priority: P1)

Como dueño, quiero que la taxonomía que diseñé (26 categorías con sus subcategorías) sea la que trae la app por defecto: la veo en mi cuenta, la ve quien visita el demo y la recibe cualquier cuenta nueva, en lugar de las 8 categorías genéricas de hoy.

**Why this priority**: es la base de las demás historias (los íconos y Previous Balances cuelgan de ella) y hace que el demo refleje cómo uso realmente la app.

**Independent Test**: abrir el demo y una cuenta nueva y comprobar que ambas muestran las 26 categorías con sus subcategorías y buckets; en la cuenta del dueño, comprobar que no hay categorías duplicadas y que existe Previous Balances en Needs.

**Acceptance Scenarios**:

1. **Given** una cuenta recién creada, **When** termina el arranque inicial, **Then** tiene las 26 categorías por defecto, cada una con su bucket y sus subcategorías.
2. **Given** el demo público, **When** se abre el editor de taxonomía o el formulario de gasto, **Then** se ven las mismas 26 categorías, traducidas al idioma activo, con sus subcategorías en inglés.
3. **Given** la cuenta del dueño con sus 25 categorías cargadas a mano, **When** se aplica la actualización, **Then** sus categorías existentes quedan reconocidas como categorías por defecto (traducibles y con ícono), se agrega Previous Balances en Needs y no se crea ninguna categoría duplicada.
4. **Given** la cuenta del dueño, **When** se aplica la actualización, **Then** sus gastos, recurrentes, saldos y regla de reparto no cambian.
5. **Given** un gasto registrado en Previous Balances, **When** se consulta el Safe-to-Spend, **Then** se descuenta de Needs en la quincena actual, como cualquier otra categoría de Needs.

---

### User Story 2 - Clasificar mis ingresos por tipo (Priority: P1)

Como dueño, quiero indicar de qué tipo es cada ingreso (salario, regalo, pago de deuda, cashback, extra, ventas, ahorros, rendimientos de inversión u otro) para distinguir de dónde viene mi dinero.

**Why this priority**: hoy un ingreso solo tiene una etiqueta libre; sin tipo no se puede filtrar ni exportar por origen. Es independiente de los íconos.

**Independent Test**: registrar un ingreso eligiendo un tipo, comprobar que la lista de ingresos muestra ese tipo y que el CSV exportado lo incluye; comprobar que los ingresos anteriores aparecen como "Otro".

**Acceptance Scenarios**:

1. **Given** el formulario de nuevo ingreso, **When** el dueño elige un tipo y guarda, **Then** el ingreso queda registrado con ese tipo y la lista lo muestra junto a su etiqueta.
2. **Given** el formulario con la etiqueta vacía, **When** el dueño elige un tipo, **Then** la etiqueta se rellena con el nombre del tipo, y puede cambiarla libremente.
3. **Given** ingresos registrados antes de esta feature, **When** se consulta la lista, **Then** aparecen con el tipo "Otro" y sin perder ningún otro dato.
4. **Given** ingresos de varios tipos, **When** se exporta el historial a CSV, **Then** cada fila de ingreso incluye su tipo.
5. **Given** un ingreso existente, **When** el dueño lo edita y cambia el tipo, **Then** el cambio se guarda y el reparto del ingreso no se altera.
6. **Given** el formulario de nuevo ingreso, **When** se abre, **Then** ningún tipo viene preseleccionado; **When** intenta guardar sin elegir uno, **Then** el formulario no se envía y muestra, junto al campo, un mensaje traducido pidiendo elegir el tipo.

---

### User Story 3 - Reconocer categorías por su ícono (Priority: P2)

Como dueño, quiero que cada categoría tenga un ícono distintivo y poder cambiarlo desde el editor de taxonomía, para reconocer mis gastos de un vistazo.

**Why this priority**: mejora la lectura de listas y del ledger, pero la app funciona sin ella.

**Independent Test**: en el editor de taxonomía, cambiar el ícono de una categoría y comprobar que el nuevo ícono aparece en gastos, ledger y recurrentes; crear una categoría sin ícono y comprobar que muestra uno genérico.

**Acceptance Scenarios**:

1. **Given** las categorías por defecto, **When** se muestran en el editor de taxonomía, gastos, ledger, recurrentes e ingresos, **Then** cada una aparece con su ícono junto al nombre.
2. **Given** el editor de taxonomía, **When** el dueño abre el selector de ícono de una categoría, **Then** ve una cuadrícula con el conjunto curado de íconos, elige uno y queda guardado.
3. **Given** una categoría creada por el dueño sin ícono, **When** se muestra, **Then** aparece un ícono genérico.
4. **Given** una subcategoría sin ícono propio, **When** se muestra, **Then** aparece con el ícono de su categoría; **Given** que el dueño le asigna un ícono propio desde el editor, **Then** se muestra ese en su lugar, y quitarlo vuelve al de la categoría.
5. **Given** las listas desplegables nativas (selector de subcategoría, filtros del ledger), **When** se abren, **Then** siguen mostrando solo texto.

---

### User Story 4 - Íconos de apoyo en el resto de la app (Priority: P3)

Como dueño, quiero íconos discretos junto a los tipos de cuenta, buckets, tipos de movimiento, estados de cobro, tipos de meta, marcas de gasto, KPIs de patrimonio, fechas de tarjeta, deudores y preferencias, y encabezados y estados vacíos con ícono, para que la app se lea más rápido sin perder su estilo minimalista.

**Why this priority**: es pulido visual; no cambia datos ni comportamiento.

**Independent Test**: recorrer cada página en claro y oscuro, en EN y ES, y comprobar que los íconos aparecen junto al texto (nunca en su lugar), que los lectores de pantalla no los anuncian y que los estados vacíos y encabezados se ven iguales en todas las páginas.

**Acceptance Scenarios**:

1. **Given** cualquier superficie de la tabla de FR-014, **When** se muestra, **Then** el ícono correspondiente aparece junto al texto, pequeño y en color atenuado.
2. **Given** un lector de pantalla, **When** recorre esas superficies, **Then** anuncia solo el texto; los íconos son decorativos.
3. **Given** una página sin datos (cobros, metas, gastos, recurrentes, ingresos, ledger, historial de crédito, patrimonio), **When** se abre, **Then** muestra el mismo estado vacío compartido, con el ícono de esa página y su mensaje.
4. **Given** cualquier página principal, **When** se abre, **Then** su título aparece con el mismo ícono que tiene en la navegación.
5. **Given** el dashboard con un error de carga, **When** aparece el aviso, **Then** lleva un ícono de alerta.

---

### Edge Cases

- La cuenta del dueño tiene una categoría con el mismo nombre que una por defecto: se reconoce como esa categoría por defecto; no se crea otra.
- La cuenta del dueño tiene una categoría que no está en la lista por defecto: se conserva intacta, sin ícono asignado (muestra el genérico) y sin traducción.
- El dueño renombró o borró (archivó) una categoría por defecto: la actualización no la recrea ni la renombra.
- Una cuenta ya tiene Previous Balances: no se duplica.
- Un ícono guardado deja de existir en el conjunto curado (o llega con un valor no válido): se muestra el genérico y la pantalla no se rompe.
- El CSV exportado se reimporta o se abre en una hoja de cálculo: la columna de tipo de ingreso usa un valor estable, no el texto traducido.
- Un ingreso con tipo "Pago de deuda" no altera los saldos de cuentas por cobrar: cobrar una cuota sigue siendo una acción aparte.
- Pagar la deuda de una tarjeta de crédito se registra como pago de tarjeta, no como gasto en Previous Balances, para no contarla dos veces.
- En modo demo, cambiar el ícono o el tipo de ingreso se bloquea con el aviso de solo lectura, como cualquier otra edición.
- En modo privacidad, los íconos siguen visibles; solo se ocultan los montos.

## Requirements *(mandatory)*

### Functional Requirements

**Taxonomía**

- **FR-001**: La taxonomía por defecto MUST ser la del dueño: 26 categorías (las 25 que ya tiene más Previous Balances), cada una con su bucket, su clave de traducción, su ícono y sus subcategorías. Se retiran las 7 categorías genéricas actuales que se solapan; Housing se conserva.
- **FR-002**: Las cuentas nuevas y el demo MUST recibir esa misma taxonomía por defecto.
- **FR-003**: La actualización de la cuenta existente MUST reconocer por nombre las categorías que coinciden con las por defecto, asignándoles su clave de traducción y su ícono (sus subcategorías se dejan como están), sin crear duplicados ni modificar movimientos, recurrentes, saldos o reglas de reparto.
- **FR-004**: La categoría Previous Balances MUST existir en el bucket Needs, con una subcategoría "Previous balances", y comportarse como cualquier otra categoría de Needs en el Safe-to-Spend.
- **FR-005**: Las categorías creadas por el dueño MUST conservarse exactamente como las escribió, sin clave de traducción.

**Tipos de ingreso**

- **FR-006**: Cada ingreso MUST tener exactamente un tipo de una lista fija: salario, regalo, pago de deuda, cashback, extra, ventas, ahorros, rendimientos de inversión u otro. La lista no es editable por el usuario.
- **FR-007**: Los ingresos existentes MUST quedar con el tipo "Otro" tras la actualización.
- **FR-008**: El formulario de nuevo ingreso MUST exigir elegir el tipo, sin preselección (los 9 tipos se muestran con su ícono, y "Otro" es una opción más); MUST NOT guardarse un ingreso nuevo sin tipo. Al elegirlo con la etiqueta vacía, MUST sugerir la etiqueta; la etiqueta sigue siendo texto libre y editable.
- **FR-009**: La lista de ingresos MUST mostrar el tipo de cada ingreso con su ícono, y la edición de un ingreso MUST permitir cambiarlo.
- **FR-010**: La exportación CSV MUST incluir el tipo de ingreso como una columna con un valor estable independiente del idioma.

**Íconos**

- **FR-011**: Las categorías y las subcategorías MUST poder tener un ícono opcional, elegido de un conjunto curado de unos 40 íconos; el valor guardado MUST ser una clave corta de letras minúsculas, números y guiones. Las 26 categorías por defecto traen ícono; las subcategorías por defecto no traen ícono propio.
- **FR-012**: El editor de taxonomía MUST ofrecer un selector de ícono en cuadrícula con el conjunto curado, tanto para categorías como para subcategorías, con la opción de quitar el ícono propio de una subcategoría; y MUST validar que el ícono elegido pertenece al conjunto.
- **FR-013**: El ícono MUST mostrarse junto al nombre en el editor de taxonomía, gastos, ledger, recurrentes e ingresos, resuelto en este orden: ícono propio de la subcategoría → ícono de su categoría → ícono genérico (también cuando el valor guardado no se reconoce). Las listas desplegables nativas se quedan con texto.
- **FR-014**: La app MUST mostrar íconos decorativos junto al texto en estas superficies:

  | Superficie | Íconos |
  |---|---|
  | Tipo de cuenta | cheques, ahorro, tarjeta de crédito, inversión, efectivo |
  | Bucket | Needs, Wants, inversión |
  | Tipo de movimiento del ledger | gasto, ingreso, pago de tarjeta, cobro de cuota |
  | Estado de cobro | pendiente, parcial, cobrado |
  | Tipo de meta | fondo de emergencia, fondo de ahorro |
  | Marcas de gasto | automático, pausado |
  | KPIs de patrimonio | patrimonio neto, activos, pasivos |
  | Fechas de tarjeta | corte, pago, vencido |
  | Deudor | persona |
  | Preferencias | idioma, divisa |
  | Aviso de error del dashboard | alerta |

- **FR-015**: Las páginas sin datos MUST usar un único estado vacío compartido con el ícono de la página; los títulos de las páginas principales MUST usar un único encabezado compartido con el mismo ícono que tienen en la navegación.
- **FR-016**: Todos los íconos MUST ser decorativos: nunca reemplazan al texto, no se anuncian a lectores de pantalla y no alteran el nombre accesible de botones ni etiquetas; MUST respetar el contraste en tema claro y oscuro.
- **FR-017**: Añadir los íconos MUST NOT aumentar de forma apreciable el peso de la primera carga de la app (ver SC-005).

**Idiomas y demo**

- **FR-018**: Los nombres de las 26 categorías por defecto y de los 9 tipos de ingreso MUST estar disponibles en inglés y español y respetar el idioma activo. Las subcategorías por defecto NO se traducen: se muestran con su nombre en inglés tal como está guardado, en los dos idiomas, igual que las creadas por el dueño.
- **FR-019**: En modo demo, los datos ficticios MUST asignar un tipo a sus ingresos de ejemplo, y cambiar íconos o tipos MUST bloquearse con el aviso de solo lectura.

### Key Entities

- **Categoría**: agrupa subcategorías de gasto dentro de un bucket (Needs o Wants). Atributos nuevos: ícono opcional. Las por defecto tienen clave de traducción; las del dueño, no.
- **Traducción de la taxonomía**: solo las categorías por defecto tienen clave de traducción; las subcategorías por defecto no la tienen y se muestran con su nombre guardado.
- **Subcategoría**: pertenece a una categoría y hereda su bucket. Atributo nuevo: ícono opcional; si no tiene, usa el de su categoría.
- **Ingreso**: atributo nuevo obligatorio "tipo", de una lista fija de 9 valores; por defecto "Otro" para los existentes.
- **Tipo de ingreso**: valor de la lista fija, con nombre traducido e ícono; no es editable.
- **Conjunto curado de íconos**: lista cerrada de unos 40 íconos que se pueden asignar a categorías, más un genérico de respaldo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las cuentas nuevas y el demo muestran las 26 categorías por defecto con sus subcategorías e íconos.
- **SC-002**: Tras actualizar la cuenta del dueño, hay 0 categorías duplicadas, existe exactamente 1 Previous Balances en Needs y los totales de gastos, ingresos y saldos son idénticos a los de antes.
- **SC-003**: El 100 % de los ingresos tiene un tipo; los anteriores a la feature tienen "Otro".
- **SC-004**: El CSV exportado incluye el tipo en el 100 % de las filas de ingreso.
- **SC-005**: La primera carga de la app crece menos de 5 KB comprimidos por los íconos añadidos, y la verificación de aislamiento del demo sigue sin hallazgos.
- **SC-006**: 0 textos sin traducir en EN o ES para las 26 categorías por defecto y los 9 tipos de ingreso (las subcategorías quedan fuera de esta medida por diseño).
- **SC-007**: Las pruebas de accesibilidad pasan sin hallazgos nuevos en tema claro y oscuro: ningún ícono se anuncia ni cambia el nombre accesible de un control.
- **SC-008**: El dueño identifica la categoría de un gasto en el ledger sin leer su nombre en al menos 8 de cada 10 casos (verificación manual informal).

## Assumptions

- Las 25 categorías, 80 subcategorías, buckets y regla 40/20/40 ya cargados en la cuenta del dueño (2026-11-05) son la referencia exacta de la taxonomía por defecto; se extraen de esa cuenta durante el plan.
- Propuesta inicial de íconos por categoría (a afinar): Housing casa, Home Services enchufe, Telecom teléfono, Transport & Gas auto, Groceries carrito, Health & Insurance pulso, Gym & Wellness pesa, Fixed Subscriptions repetir, Maintenance llave, Education birrete, Bank Fees banco, Pets huella, Restaurants cubiertos, Entertainment boleto, Streaming TV, Clothes camisa, Personal Care tijeras, Gifts regalo, Pocket Money dulce, Tech audífonos, Travel avión, Home & Furniture sofá, Hobbies paleta, Donations mano con corazón, Other puntos suspensivos, Previous Balances historial.
- Las cuentas existentes no se rellenan solas al iniciar sesión; la actualización de la cuenta del dueño se hace una sola vez junto con el cambio de esquema, primero probada en local y después aplicada a la nube con aprobación expresa del dueño.
- Los datos ya cargados como marcadores provisionales (días de corte y pago de las 6 tarjetas, día de cobro y fecha de inicio de los 2 gastos fijos) los corrige el dueño en la app; no forman parte de esta feature.
- Los íconos de las superficies de FR-014 no requieren cambios de datos; son solo presentación.
- Las traducciones ES de las 26 categorías las propone el plan y el dueño las revisa antes de implementar. Mostrar las subcategorías en inglés no contradice la regla de no hardcodear textos de la interfaz: son datos guardados, como los nombres que escribe el dueño.
- Fuera de alcance: un tercer bucket "Debt" o cualquier cambio a los buckets; un catálogo editable de tipos de ingreso; íconos en listas desplegables nativas; cambiar íconos que ya existen en privacidad, tema y avisos.
