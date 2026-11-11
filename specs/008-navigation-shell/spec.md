# Feature Specification: Navegación y consistencia del shell

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Spec 008 — Navegación y consistencia del shell (P1), según docs/ux-roadmap.md. Trabajo solo de UI. (1) Destinos agrupados: Principal (Inicio, Gastos, Ingresos, Crédito), Planear (Gastos fijos, Metas), Deudas (Por cobrar), Análisis (Bitácora, Patrimonio) y Configuración al pie; barra lateral de escritorio con secciones, Configuración fija al fondo y scroll propio. (2) Barra móvil Inicio · Gastos · ＋ · Crédito · Más, sin el botón flotante; 'Más' marcado como activo en rutas secundarias; el panel 'Más' sube desde abajo, agrupado y titulado 'Más'. (3) Hoja de creación ＋ con Gasto, Ingreso, Pagar tarjeta y gastos rápidos; una sola instancia de cada diálogo, que cualquier página puede abrir. (4) Escritorio: botón '＋ Nuevo' en la barra superior con menú y atajos N/I/P; es el único CTA destacado. (5) Encabezado de página consistente en todas las pantallas; Reglas con enlace de regreso a Configuración; el panel 'Preferencias' de la barra superior pasa a llamarse 'Apariencia'. (6) Área segura del encabezado, espacio inferior solo en móvil, alertas del Dashboard arriba en móvil. (7) Estado de tarjeta unificado (último estado, próximo estado, Pagar) en Crédito y Gastos; corrige que Gold Card muestre $0.00 (30 oct) en Gastos y $13,190.50 (30 nov) en Crédito."

## Clarifications

### Session 2026-11-07

Respondidas en modo autónomo con `docs/ux-roadmap.md` y la opción recomendada (el usuario no estuvo disponible).

- Q: ¿Qué acciones propias de cada página se quitan y cuáles solo pierden el estilo destacado? → A: Se quitan las que repiten una acción global: "Agregar gasto" (Dashboard y Gastos) y "Registrar ingreso" (Ingresos). Las demás altas (meta, gasto fijo, cuenta por cobrar, regla, etc.) se quedan con estilo secundario. "Pagar" dentro de una tarjeta se queda porque precarga datos. Los estados vacíos conservan un enlace secundario que abre el diálogo global.
- Q: ¿El menú "＋ Nuevo" de escritorio también muestra los gastos rápidos? → A: No. Solo muestra las 3 acciones; en escritorio los gastos rápidos siguen en el Dashboard. (Enmienda 2026-11-09: ya no están en el Dashboard; en escritorio aparecen en el diálogo que abre "Nuevo › Gasto".)
- Q: ¿Los atajos N/I/P funcionan solo en escritorio o en cualquier ancho con teclado físico? → A: En cualquier ancho, con las mismas exclusiones (campo editable, diálogo o panel abierto, modificadores). Solo se anuncian en el menú de escritorio.
- Q: ¿Tocar ＋ con la hoja abierta la cierra? → A: Sí. ＋ alterna la hoja y anuncia si está abierta; el icono indica el estado.
- Q: ¿La franja compacta de alertas del Dashboard también se aplica en escritorio? → A: No. Solo en móvil (< 768 px); en escritorio las alertas se quedan en su lugar dentro de la cuadrícula.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar cualquier sección en móvil y escritorio (Priority: P1)

Como dueño, quiero que los 10 destinos de la app estén agrupados por intención (lo diario, lo que planeo, lo que me deben, lo que analizo) y que la navegación siempre me diga dónde estoy, también cuando la sección no está en la barra inferior del teléfono.

**Why this priority**: hoy 6 destinos (incluida Configuración) viven en un panel lateral que nunca se marca como activo, y en pantallas bajas la barra lateral de escritorio se corta. Es la base del resto del spec.

**Independent Test**: en un teléfono (390 px), abrir "Más", ir a Metas y comprobar que "Más" queda marcado como activo; el panel sube desde abajo con secciones agrupadas. En escritorio a 1440 × 700 px, la barra lateral muestra encabezados de sección, Configuración al fondo y se puede desplazar sin cortar ítems.

**Acceptance Scenarios**:

1. **Given** el escritorio (≥ 768 px), **When** se ve la barra lateral, **Then** los destinos aparecen en este orden y grupos: Principal (Inicio, Gastos, Ingresos, Crédito), Planear (Gastos fijos, Metas), Deudas (Por cobrar), Análisis (Bitácora, Patrimonio), y Configuración separada al fondo.
2. **Given** una ventana de escritorio de poca altura, **When** los destinos no caben, **Then** la navegación se desplaza por sí sola y ningún destino queda inalcanzable.
3. **Given** un teléfono (< 768 px), **When** se ve la barra inferior, **Then** muestra exactamente Inicio, Gastos, un botón ＋ central destacado, Crédito y Más.
4. **Given** una ruta que no está en la barra inferior (Ingresos, Gastos fijos, Metas, Por cobrar, Bitácora, Patrimonio, Configuración y sus subpáginas), **When** el dueño está en ella, **Then** "Más" se muestra como activo y se anuncia como página actual a lectores de pantalla.
5. **Given** el botón "Más", **When** se toca, **Then** se abre un panel que sube desde abajo, titulado "Más", con los destinos secundarios agrupados con los mismos encabezados que el escritorio, y el destino actual marcado.
6. **Given** el panel "Más" abierto, **When** el dueño elige un destino, **Then** navega y el panel se cierra.
7. **Given** cualquier pantalla en móvil, **When** se desplaza, **Then** ya no hay un botón flotante que tape montos.

---

### User Story 2 - Crear un gasto, un ingreso o un pago de tarjeta desde cualquier pantalla (Priority: P1)

Como dueño, quiero registrar un gasto, un ingreso o pagar una tarjeta desde donde esté, sin tener que ir antes a la página de cada uno.

**Why this priority**: hoy registrar un ingreso o pagar una tarjeta solo se puede desde su página, y el botón flotante se esconde al desplazarse.

**Independent Test**: en móvil, desde Metas, tocar ＋ → "Ingreso" abre el diálogo de ingreso. En escritorio, desde Patrimonio, pulsar `P` abre el diálogo de pago de tarjeta; con el foco en un campo de texto, `P` escribe una "p".

**Acceptance Scenarios**:

1. **Given** cualquier pantalla autenticada en móvil, **When** el dueño toca ＋, **Then** se abre una hoja inferior con tres acciones grandes (Gasto, Ingreso, Pagar tarjeta) y, debajo, los gastos rápidos del dueño.
2. **Given** la hoja ＋, **When** el dueño elige una acción, **Then** la hoja se cierra y se abre el diálogo correspondiente, el mismo que existe hoy en su página.
3. **Given** la hoja ＋, **When** el dueño toca un gasto rápido, **Then** se registra igual que hoy (con Deshacer) y la hoja se cierra.
4. **Given** el escritorio, **When** se ve la barra superior, **Then** hay un botón destacado "＋ Nuevo" que abre un menú con Gasto, Ingreso y Pagar tarjeta, cada uno con su atajo de teclado visible (N, I, P).
5. **Given** un teclado físico (en cualquier ancho), sin foco en un campo editable ni un diálogo abierto, **When** el dueño pulsa N, I o P (sin modificadores), **Then** se abre el diálogo de gasto, ingreso o pago de tarjeta, respectivamente.
6. **Given** el foco en un campo de texto, un área de texto, un selector o un elemento editable, o un diálogo ya abierto, **When** el dueño pulsa N, I o P, **Then** no se abre ningún diálogo.
7. **Given** cualquier página que ofrezca la acción (por ejemplo, "Pagar" en una tarjeta de Crédito), **When** el dueño la usa, **Then** se abre la única instancia de ese diálogo, prellenada con lo que la página aporte (tarjeta y monto).
8. **Given** cualquier pantalla, **When** se cuenta cuántas veces está montado cada diálogo de creación, **Then** hay exactamente una instancia de cada uno.
9. **Given** el escritorio, **When** se ve una pantalla, **Then** "＋ Nuevo" es la única llamada a la acción destacada; las acciones propias de cada página se muestran con estilo secundario o se quitan si repiten la acción global.
10. **Given** el modo demo, **When** el dueño completa cualquier diálogo abierto desde ＋ o "＋ Nuevo", **Then** guardar muestra el aviso de solo lectura, como hoy.

---

### User Story 3 - Ver un solo estado de cada tarjeta, el mismo en Crédito y en Gastos (Priority: P1)

Como dueño, quiero ver para cada tarjeta su último estado de cuenta (pagado, pendiente o vencido) y el próximo (monto y fecha), con un botón Pagar, y que Gastos y Crédito digan lo mismo.

**Why this priority**: hoy Gold Card aparece con "$0.00 · vence 30 oct" en Gastos y "$13,190.50 · vence 30 nov" en Crédito para el mismo concepto. Dos cifras distintas para "pagar para no generar intereses" minan la confianza en la app.

**Independent Test**: en la demo, con una tarjeta cuyo último estado ya está pagado y que tiene compras después del corte, Crédito muestra "Último estado: pagado ✓ (30 oct)" y "Próximo estado: $X · vence 30 nov", y el resumen de tarjetas de Gastos muestra los mismos valores.

**Acceptance Scenarios**:

1. **Given** una tarjeta cuyo último estado de cuenta ya se pagó por completo, **When** se muestra, **Then** el último estado aparece como "pagado" con su fecha límite, y el próximo estado muestra el monto proyectado (lo comprado desde el último corte, más las mensualidades MSI de ese estado) y su fecha límite.
2. **Given** una tarjeta cuyo último estado no está pagado y su límite no ha pasado, **When** se muestra, **Then** el último estado aparece como "pendiente" con el monto para no generar intereses y su fecha límite, como dato principal.
3. **Given** una tarjeta cuyo último estado no está pagado y su límite ya pasó, **When** se muestra, **Then** aparece como "vencido", destacado y con texto (no solo color).
4. **Given** cualquier tarjeta, **When** el dueño toca "Pagar", **Then** se abre el diálogo de pago de tarjeta prellenado con esa tarjeta y el monto pendiente del último estado; si está pagado, con el monto del próximo estado.
5. **Given** Crédito y Gastos, **When** se comparan los montos y fechas de una misma tarjeta, **Then** son idénticos.
6. **Given** la página de Gastos, **When** se ve la sección de tarjetas, **Then** es un resumen compacto (una línea por tarjeta con su estado, monto principal y Pagar) con un enlace "Ver en Crédito".
7. **Given** el modo privacidad activo, **When** se ve cualquier estado de tarjeta, **Then** todos los montos están enmascarados.

---

### User Story 4 - Encabezados y paneles consistentes (Priority: P2)

Como dueño, quiero que cada pantalla tenga el mismo tipo de encabezado (icono, título y, si aplica, regreso a Configuración), y que el panel de la barra superior no se confunda con la página de Preferencias.

**Why this priority**: Configuración y Reglas no tienen icono y Reglas no tiene enlace de regreso; existen un panel "Preferencias" y una página "Preferencias" con contenido distinto.

**Independent Test**: abrir Configuración y Configuración → Reglas; ambas tienen icono y título con el mismo estilo que Gastos, y Reglas muestra "‹ Configuración". El panel de la barra superior se llama "Apariencia".

**Acceptance Scenarios**:

1. **Given** cualquier página autenticada, **When** se ve su encabezado, **Then** tiene icono, título y, opcionalmente, descripción y acciones, con el mismo estilo en todas.
2. **Given** cualquier subpágina de Configuración (incluida Reglas), **When** se ve, **Then** muestra un enlace "‹ Configuración" que regresa al índice.
3. **Given** la barra superior, **When** el dueño abre el panel de idioma, moneda, tema y salir, **Then** se titula "Apariencia" (EN: "Appearance"); su botón conserva el icono de ajustes original.

---

### User Story 5 - Shell cómodo en teléfonos con muesca y alertas a la vista (Priority: P2)

Como dueño, quiero que el encabezado no quede bajo la muesca o la barra de estado del teléfono, que no haya espacio vacío al pie en escritorio, y que las alertas importantes del Dashboard (sobregiro, cobros pendientes) se vean sin desplazarme hasta el final.

**Why this priority**: son defectos visibles en cada uso, de bajo costo.

**Independent Test**: en un teléfono con área segura superior, el encabezado respeta el inset; en escritorio el contenido no tiene un relleno inferior de 5 rem; en el Dashboard móvil una alerta de sobregiro aparece arriba, compacta y tocable.

**Acceptance Scenarios**:

1. **Given** un dispositivo con área segura superior o lateral, **When** se ve el encabezado, **Then** su contenido no queda bajo la muesca ni los bordes redondeados.
2. **Given** el escritorio, **When** se llega al final de una página, **Then** el espacio inferior es el normal del diseño, sin el espacio que en móvil reserva la barra inferior.
3. **Given** el Dashboard en móvil con alertas activas (sobregiro, cobros por vencer), **When** se carga, **Then** las alertas aparecen arriba como una franja compacta y tocable que lleva a la sección correspondiente, y los saldos de los buckets siguen siendo el primer bloque de contenido destacado.
4. **Given** el Dashboard sin alertas, **When** se carga, **Then** no aparece una franja vacía.

---

### Edge Cases

- **Sin tarjetas de crédito**: "Pagar tarjeta" aparece deshabilitado en la hoja ＋ y en "＋ Nuevo", con una explicación breve, y el atajo P no hace nada. Crédito mantiene su estado vacío actual y Gastos no muestra la sección de tarjetas.
- **Sin gastos rápidos**: la hoja ＋ muestra solo las tres acciones (sin sección vacía).
- **Atajos con modificadores**: Ctrl/Cmd/Alt + N/I/P conservan su comportamiento del navegador (nueva ventana, imprimir, etc.).
- **Diálogo abierto desde ＋ con otra hoja abierta**: abrir un diálogo cierra primero la hoja ＋ o "Más"; nunca hay dos paneles modales apilados.
- **Navegar con un diálogo abierto**: con la navegación del navegador (atrás), el diálogo se cierra y no reaparece en la nueva página.
- **Tarjeta sin compras ni pagos**: último estado "pagado" con $0.00 y próximo estado $0.00.
- **Tarjeta con último estado pagado en parte**: se muestra como "pendiente" con el monto restante.
- **Tarjeta archivada**: no aparece en Crédito, en Gastos ni en "Pagar tarjeta", como hoy.
- **Rotación y teclado virtual**: la barra inferior no tapa el contenido y sigue respetando el área segura inferior.
- **Lectores de pantalla**: el botón ＋ tiene nombre accesible ("Crear"/"Create") y anuncia si la hoja está abierta.
- **Demo**: navegación, hoja ＋ y "＋ Nuevo" funcionan; cualquier guardado se bloquea con el aviso de solo lectura.

## Requirements *(mandatory)*

### Functional Requirements

**Navegación**

- **FR-001**: Los destinos MUST agruparse en: Principal (Inicio, Gastos, Ingresos, Crédito), Planear (Gastos fijos, Metas), Deudas (Por cobrar), Análisis (Bitácora, Patrimonio) y un pie con Configuración. Los nombres de los grupos MUST existir en español e inglés.
- **FR-002**: En escritorio (≥ 768 px), la barra lateral MUST mostrar los grupos con un encabezado discreto, Configuración separada al fondo, y MUST poder desplazarse por sí sola cuando la altura de la ventana no alcanza.
- **FR-003**: En móvil (< 768 px), la barra inferior MUST mostrar, en orden: Inicio, Gastos, ＋ (central, destacado), Crédito y Más, respetando el área segura inferior. Reemplaza la composición de la barra inferior de spec 003 (FR-019). *(Enmienda spec 012: el ＋ queda dentro de la barra, sin sobresalir ni anillo, para no tapar contenido.)*
- **FR-004**: El botón flotante "Agregar gasto" de móvil MUST eliminarse (reemplaza spec 003 FR-020); el botón ＋ de la barra cumple su función.
- **FR-005**: "Más" MUST mostrarse como activo y anunciarse como página actual cuando la ruta pertenece a un destino que no está en la barra inferior, incluidas sus subrutas.
- **FR-006**: "Más" MUST abrir un panel que sube desde abajo, titulado "Más", con los destinos secundarios agrupados según FR-001 (Ingresos dentro de Principal) y el destino actual marcado. Elegir un destino MUST navegar y cerrar el panel. *(Enmienda spec 012: los destinos van en cuadrícula de 3 columnas con Configuración como fila aparte; los encabezados de grupo quedan solo para lectores de pantalla.)*

**Creación global**

- **FR-007**: El botón ＋ MUST abrir y cerrar (alternar) una hoja inferior con tres acciones: Gasto, Ingreso y Pagar tarjeta, más los gastos rápidos del dueño debajo cuando existan.
- **FR-008**: Cada acción MUST abrir el diálogo existente de esa operación (mismos campos, validación y comportamiento) y cerrar la hoja.
- **FR-009**: Cada diálogo de creación (gasto, ingreso, pago de tarjeta) MUST montarse una sola vez en toda la app, y cualquier página MUST poder abrirlo, opcionalmente con datos iniciales (por ejemplo, tarjeta y monto).
- **FR-010**: En escritorio, la barra superior MUST incluir un botón destacado "＋ Nuevo" con un menú de solo tres opciones (Gasto, Ingreso y Pagar tarjeta, sin gastos rápidos), que muestra el atajo de cada opción.
- **FR-011**: Con teclado físico (en cualquier ancho), las teclas N, I y P (sin modificadores) MUST abrir los diálogos de gasto, ingreso y pago de tarjeta, salvo que el foco esté en un campo editable o haya un diálogo o panel abierto.
- **FR-012**: Cada pantalla MUST tener como máximo una llamada a la acción destacada; en escritorio es "＋ Nuevo" (reemplaza la asignación por página de spec 003 FR-006). Las acciones que repiten una acción global ("Agregar gasto" en Dashboard y Gastos, "Registrar ingreso" en Ingresos) MUST quitarse; las demás acciones de página MUST usar estilo secundario. Los estados vacíos MAY ofrecer un enlace secundario que abre el diálogo global. *(Enmienda spec 012: cumplido también en Metas, Cuentas, Cobros, Recurrentes y Categorías, cuyos botones "Agregar" pasan a estilo secundario.)*
- **FR-013**: "Pagar tarjeta" MUST mostrarse deshabilitado, con explicación, cuando no hay tarjetas de crédito activas.

**Encabezados y paneles**

- **FR-014**: Todas las páginas autenticadas MUST usar el mismo encabezado (icono, título, descripción y acciones opcionales), incluidos el índice de Configuración y Reglas.
- **FR-015**: Todas las subpáginas de Configuración MUST mostrar un enlace de regreso "‹ Configuración".
- **FR-016**: El panel de la barra superior con idioma, moneda, tema y cerrar sesión MUST llamarse "Apariencia" ("Appearance") (actualiza spec 003 FR-021). Conserva su icono original de ajustes (`SlidersHorizontal`) por preferencia del usuario (2026-11-08).

**Shell**

- **FR-017**: El encabezado MUST respetar las áreas seguras superior y laterales del dispositivo.
- **FR-018**: El espacio inferior reservado para la barra móvil MUST aplicarse solo en móvil.
- **FR-019**: En el Dashboard móvil, las alertas activas MUST aparecer arriba como una franja compacta y tocable que lleva a la sección correspondiente; los saldos de los buckets MUST seguir siendo el primer bloque de contenido destacado (ajusta spec 003 FR-027). En escritorio, las alertas conservan su lugar en la cuadrícula.

**Estado de tarjetas**

- **FR-020**: Cada tarjeta de crédito activa MUST mostrar su último estado de cuenta (pagado, pendiente o vencido, con fecha límite y, si no está pagado, el monto para no generar intereses) y su próximo estado (monto proyectado y fecha límite).
- **FR-021**: El estado de una tarjeta MUST calcularse en un solo lugar. (Enmienda 2026-11-09: se muestra solo en Crédito.)
- **FR-022**: Cada estado de tarjeta MUST ofrecer "Pagar", que abre el diálogo de pago con la tarjeta y el monto pendiente del último estado o, si está pagado, el del próximo.
- **FR-023**: ~~En Gastos, la sección de tarjetas MUST ser un resumen compacto con enlace a Crédito.~~ (Enmienda 2026-11-09: Gastos no muestra tarjetas; todo lo de crédito vive en Crédito.)
- **FR-024**: "Vencido" MUST comunicarse con texto e icono, no solo con color.

**Transversales**

- **FR-025**: Todos los textos nuevos (grupos, "Más", "Crear", "＋ Nuevo", "Apariencia", estados de tarjeta, atajos) MUST existir en español e inglés.
- **FR-026**: Todo monto nuevo o reubicado MUST enmascararse con el modo privacidad.
- **FR-027**: Las transiciones de paneles e indicadores MUST seguir las reglas de movimiento de spec 003 (≤ 300 ms, sin animar montos, desactivadas con movimiento reducido).
- **FR-028**: En modo demo, todo lo anterior MUST funcionar sin llamadas al backend, y cualquier guardado MUST bloquearse con el aviso de solo lectura.
- **FR-029**: Los controles nuevos MUST tener un área táctil mínima de 44 × 44 px en dispositivos táctiles y foco visible por teclado.

### Key Entities

- **Destino de navegación**: ruta, nombre, icono y grupo (Principal, Planear, Deudas, Análisis o pie), y si aparece en la barra inferior.
- **Acción de creación**: Gasto, Ingreso o Pagar tarjeta; tiene nombre, icono, atajo de escritorio y el diálogo que abre.
- **Estado de tarjeta**: último estado (fecha de corte, fecha límite, monto pendiente y situación pagado/pendiente/vencido) y próximo estado (fecha límite y monto proyectado). Se calcula; no se guarda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde cualquier pantalla autenticada, registrar un gasto, un ingreso o un pago de tarjeta empieza con un máximo de 2 toques en móvil (＋ → acción) y 1 tecla o 2 clics en escritorio.
- **SC-002**: En el 100 % de las rutas autenticadas, la navegación marca un destino como actual (en móvil, "Más" para las secundarias).
- **SC-003**: El 100 % de los destinos es alcanzable en una ventana de escritorio de 768 × 600 px y en un teléfono de 320 px de ancho, sin desplazamiento horizontal.
- **SC-004**: Para cada tarjeta, Crédito y Gastos muestran el mismo monto y la misma fecha en el 100 % de los casos.
- **SC-005**: Cada pantalla tiene como máximo 1 llamada a la acción destacada.
- **SC-006**: La carga inicial de la app crece como máximo 20 kB respecto a la versión anterior.
- **SC-007**: La auditoría automática de accesibilidad sigue sin violaciones en tema claro, oscuro y en móvil, incluidos la barra inferior, la hoja ＋ y el panel "Más".

## Assumptions

- Es trabajo solo de interfaz: no cambian datos, esquema ni cálculos financieros. El "estado de tarjeta" reutiliza los cálculos existentes de corte, límite ajustado (spec 007) y pago para no generar intereses.
- El "próximo estado" proyectado es el mismo que hoy muestra el calendario de crédito para el siguiente límite de esa tarjeta: compras posteriores al último corte, más las mensualidades MSI de ese estado.
- Cuando el último estado está pendiente o vencido, ese es el dato principal; cuando está pagado, el próximo estado es el principal. Así se resuelve la inconsistencia de Gold Card.
- Los atajos N/I/P funcionan con teclado físico en cualquier ancho, pero solo se anuncian en el menú "＋ Nuevo" de escritorio.
- La hoja ＋ y "＋ Nuevo" no incluyen "Por cobrar" ni "Gasto fijo"; esas altas siguen en sus páginas (decisión del roadmap: las 3 acciones más frecuentes).
- La gestión de plantillas de gasto rápido no cambia en este spec; el enlace "Administrar" en la hoja ＋ llega con el spec 009.
- El indicador animado de la navegación (spec 003 FR-028) se conserva en la barra lateral, en la barra inferior y en el panel "Más". *(Enmienda spec 012: el panel "Más" ya no lleva indicador deslizante; el destino activo se marca con tinte.)*
- Los e2e de navegación se verifican en modo demo; las verificaciones con backend local o en vivo se omiten por decisión del usuario (trabajo solo de UI).
- Depende de lo existente: los diálogos de gasto, ingreso y pago de tarjeta, los gastos rápidos (spec 005), el cálculo de fechas de tarjeta (spec 007) y el estado efímero de diálogos de la interfaz.
