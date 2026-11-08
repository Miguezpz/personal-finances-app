# Feature Specification: Animaciones y pulido

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Spec 010 — Animaciones y pulido (P2–P3), según docs/ux-roadmap.md, dentro de las reglas de motion del spec 003 (solo CSS y la transición de vistas nativa del navegador; ≤ 300 ms; solo opacidad, desplazamiento y color de fondo; nunca animar montos; sin bibliotecas nuevas; todo se apaga con movimiento reducido). Cambio de ruta con salida, revelado del contenido al terminar de cargar, entrada y salida de filas, hojas inferiores con asa y arrastre para cerrar, pulso al guardar, destello de montos que cambian en metas y patrimonio, barra de metas que crece desde cero, aparición suave de errores de validación, giro del botón ＋, y ajustes de accesibilidad (áreas táctiles en menús, radios e interruptores; foco visible en menús)."

## Clarifications

### Session 2026-11-07

Respondidas en modo autónomo con `docs/ux-roadmap.md`, el spec 003 y la opción recomendada (el usuario no estuvo disponible).

- Q: ¿La transición de ruta distingue la dirección (adelante o atrás)? → A: No. Siempre es el mismo desvanecimiento con desplazamiento de 4 px, también con el botón atrás del navegador; los desplazamientos laterales grandes no encajan con el límite de 300 ms ni con el tono sobrio del spec 003.
- Q: ¿Las filas se animan también en la primera carga de una lista? → A: No. Solo las que aparecen después de que la lista ya estaba en pantalla (altas y deshacer); la primera carga ya tiene el revelado (FR-003) y la transición de ruta.
- Q: ¿Qué destella al guardar: el alta, la edición o ambas? → A: La edición destella su fila; un alta usa la animación de entrada de fila, para no duplicar efectos.
- Q: ¿Qué cuenta como "gesto rápido" al arrastrar una hoja? → A: Soltar con una velocidad hacia abajo de al menos 0.5 px/ms, aunque no se hayan recorrido 80 px.
- Q: ¿Qué elementos se revelan al terminar de cargar? → A: Solo los elementos que ocupan el lugar de un esqueleto (los que se insertan en el mismo cambio en que el esqueleto desaparece), no la página completa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar y cargar con continuidad (Priority: P2)

Como dueño, quiero que al cambiar de sección el contenido anterior se desvanezca y el nuevo entre suavemente, y que al terminar de cargar los datos el contenido aparezca sin un corte seco, mientras el encabezado y la navegación se quedan quietos.

**Why this priority**: hoy el cambio de ruta solo tiene entrada, sin salida, y el paso del esqueleto al contenido es un corte brusco.

**Independent Test**: en un navegador con soporte de transiciones de vista, ir de Gastos a Metas: el contenido de Gastos sale con un desvanecimiento breve y el de Metas entra con un desplazamiento de 4 px; el encabezado no se mueve. Con movimiento reducido, el cambio es instantáneo.

**Acceptance Scenarios**:

1. **Given** dos secciones de la app, **When** el dueño navega entre ellas, **Then** el contenido saliente se desvanece y el entrante aparece con un desvanecimiento y un desplazamiento vertical de 4 px, en total ≤ 300 ms.
2. **Given** una navegación, **When** ocurre la transición, **Then** el encabezado, la barra lateral y la barra inferior permanecen fijos y se puede seguir interactuando con la página.
3. **Given** un navegador sin soporte de transiciones de vista, **When** el dueño navega, **Then** la app funciona igual, sin animación de salida.
4. **Given** una página mostrando su esqueleto, **When** llegan los datos, **Then** el contenido que reemplaza al esqueleto aparece con un desvanecimiento breve (≤ 200 ms), y los montos son legibles desde el primer cuadro (o enmascarados si la privacidad está activa).
5. **Given** movimiento reducido, **When** navega o cargan los datos, **Then** los cambios son instantáneos.

---

### User Story 2 - Ver qué cambió en las listas (Priority: P2)

Como dueño, quiero que un movimiento nuevo entre suavemente a su lista, que uno borrado salga con un desvanecimiento antes de desaparecer y que lo que acabo de guardar destelle un instante, para saber qué cambió.

**Why this priority**: las altas y bajas de filas no se animan y no hay retroalimentación visual al guardar, más allá del aviso.

**Independent Test**: con datos reales, agregar un gasto: su fila entra con un desvanecimiento; editarlo: la fila destella; borrarlo: sale con un desvanecimiento de ≤ 200 ms y luego desaparece; "Deshacer" la hace entrar de nuevo.

**Acceptance Scenarios**:

1. **Given** una lista de movimientos (Gastos, Ingresos, Gastos fijos), **When** aparece una fila nueva, **Then** entra con desvanecimiento y desplazamiento de 4 px en ≤ 200 ms.
2. **Given** una fila que el dueño borra, **When** confirma el borrado (sin diálogo, spec 009), **Then** la fila se desvanece en ≤ 200 ms y después deja de mostrarse; con movimiento reducido desaparece al instante.
3. **Given** un gasto o un ingreso editado con éxito, **When** su fila está en pantalla, **Then** su fondo destella brevemente con el realce de marca, sin animar el texto del monto.
4. **Given** el modo demo, **When** el dueño intenta borrar, **Then** no hay animación de salida (el borrado se rechaza antes).

---

### User Story 3 - Montos y metas que se sienten vivos sin animar cifras (Priority: P3)

Como dueño, quiero que cuando cambia el monto de una meta o de mi patrimonio su tarjeta destelle (como ya hacen los buckets) y que la barra de avance de cada meta crezca desde cero al aparecer.

**Independent Test**: en Metas, la barra de avance crece desde cero al cargar; al registrar una aportación, la tarjeta de la meta destella. En Patrimonio, al cambiar un saldo, la tarjeta del total destella. Los números aparecen siempre con su valor final.

**Acceptance Scenarios**:

1. **Given** una meta con avance, **When** se muestra por primera vez, **Then** su barra crece desde cero hasta su valor en ≤ 300 ms.
2. **Given** una meta o una tarjeta de Patrimonio en pantalla, **When** cambia su monto, **Then** su fondo destella brevemente; el texto del monto nunca se anima.
3. **Given** la gráfica de patrimonio, **When** se muestra, **Then** sigue sin animación (decisión del spec 003).

---

### User Story 4 - Hojas inferiores que se cierran como en el teléfono (Priority: P3)

Como dueño, en el teléfono quiero que las hojas inferiores (la hoja ＋, "Más", "Apariencia" y los formularios) muestren un asa y se puedan cerrar arrastrándolas hacia abajo.

**Independent Test**: a 390 px, abrir la hoja ＋ y arrastrar su asa 120 px hacia abajo: la hoja se cierra. Arrastrar 30 px y soltar: vuelve a su lugar.

**Acceptance Scenarios**:

1. **Given** una hoja inferior abierta en móvil, **When** se muestra, **Then** tiene un asa visible en la parte superior.
2. **Given** el asa, **When** el dueño la arrastra hacia abajo más de 80 px (o con un gesto rápido), **Then** la hoja se cierra.
3. **Given** un arrastre corto, **When** el dueño suelta, **Then** la hoja vuelve a su posición.
4. **Given** un teclado o un lector de pantalla, **When** se usa la hoja, **Then** se sigue cerrando con Escape y con el botón de cerrar; el asa no es obligatoria.

---

### User Story 5 - Detalles de pulido y accesibilidad (Priority: P3)

Como dueño, quiero que los errores de validación aparezcan suavemente, que el botón ＋ indique con su giro si la hoja está abierta, y que todos los controles táctiles tengan un área cómoda y foco visible.

**Acceptance Scenarios**:

1. **Given** un campo con error, **When** aparece el mensaje, **Then** entra con un desvanecimiento breve (≤ 200 ms).
2. **Given** la hoja ＋, **When** está abierta, **Then** el icono ＋ gira 45° (se ve como ×); al cerrar, regresa.
3. **Given** un dispositivo táctil, **When** el dueño usa elementos de menús, radios o interruptores, **Then** tienen un área táctil de al menos 44 × 44 px.
4. **Given** el teclado, **When** el foco llega a un elemento de menú, **Then** tiene un indicador de foco visible.

---

### Edge Cases

- **Navegación con el botón atrás del navegador**: aplica la misma transición (sin dirección), o es instantánea si el navegador no la soporta.
- **Clics durante una transición**: la página sigue respondiendo; la transición no bloquea interacciones.
- **Varias filas borradas seguidas**: cada una hace su propia salida.
- **Deshacer**: la fila restaurada entra con la animación de alta.
- **Arrastre que empieza en el contenido desplazable de la hoja**: solo el asa inicia el arrastre; desplazar el contenido no cierra la hoja.
- **Privacidad**: los destellos y revelados nunca hacen legible un monto enmascarado.
- **Movimiento reducido**: todo lo anterior es instantáneo, incluido el regreso de un arrastre corto.
- **Escritorio**: los diálogos siguen centrados, sin asa ni arrastre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al navegar entre secciones, el contenido entrante MUST aparecer con desvanecimiento y desplazamiento de 4 px; el total MUST ser ≤ 300 ms. *(Enmienda 2026-11-08: ya no se usa la transición de vistas nativa ni se desvanece el contenido saliente: sus capas se dibujaban sobre el encabezado y la barra inferior, y en iOS la barra desaparecía un instante en cada toque, contra FR-002.)*
- **FR-002**: El encabezado y la navegación MUST permanecer fijos durante la transición de ruta, y la página MUST seguir aceptando clics.
- **FR-003**: Los elementos que ocupan el lugar de un esqueleto de carga MUST aparecer con un desvanecimiento de ≤ 200 ms (no la página completa).
- **FR-004**: Las filas que aparecen en Gastos, Ingresos y Gastos fijos después de la primera carga de la lista (altas y deshacer) MUST entrar con desvanecimiento y desplazamiento de 4 px en ≤ 200 ms; la primera carga no anima filas.
- **FR-005**: Al borrar una fila de esas listas, la fila MUST desvanecerse en ≤ 200 ms antes de dejar de mostrarse.
- **FR-006**: Tras editar con éxito un gasto o un ingreso, su fila visible MUST destellar con el realce de marca (un alta usa la entrada de fila).
- **FR-007**: Las tarjetas de metas y de Patrimonio MUST destellar cuando cambia su monto, como los buckets.
- **FR-008**: La barra de avance de cada meta MUST crecer desde cero al aparecer, como la de los buckets.
- **FR-009**: Las hojas inferiores en móvil MUST mostrar un asa y cerrarse al arrastrarla hacia abajo más de 80 px o al soltarla con una velocidad hacia abajo ≥ 0.5 px/ms; un arrastre corto MUST regresar la hoja a su lugar.
- **FR-010**: Los mensajes de error de validación MUST aparecer con un desvanecimiento de ≤ 200 ms.
- **FR-011**: El icono del botón ＋ MUST girar 45° mientras la hoja ＋ está abierta.
- **FR-012**: Los elementos de menús, radios e interruptores MUST tener un área táctil de al menos 44 × 44 px en dispositivos táctiles, y los elementos de menú MUST mostrar foco visible con teclado.
- **FR-013**: Todas las animaciones MUST durar ≤ 300 ms, animar solo opacidad, desplazamiento o color de fondo, nunca animar el texto de un monto y desactivarse con movimiento reducido (reglas del spec 003).
- **FR-014**: MUST NOT agregarse bibliotecas de animación; la gráfica de patrimonio MUST seguir sin animación.
- **FR-015**: Las animaciones MUST NOT retrasar la aparición de datos ni bloquear la interacción, y la carga inicial MUST crecer como máximo 20 kB.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las animaciones nuevas dura ≤ 300 ms y ninguna queda activa con movimiento reducido (verificado por la prueba automática de movimiento en todas las rutas).
- **SC-002**: Con privacidad activa, el 0 % de los cuadros durante revelados y destellos muestra un monto legible.
- **SC-003**: Cerrar una hoja inferior con un arrastre requiere un solo gesto.
- **SC-004**: La auditoría de accesibilidad sigue sin violaciones serias en claro, oscuro, neón y móvil.
- **SC-005**: La carga inicial crece como máximo 20 kB respecto a la versión anterior.

## Assumptions

- La transición de vistas de React (`<ViewTransition>`) solo se activa con transiciones, `Suspense` o valores diferidos. Las navegaciones de Next son transiciones, así que el cambio de ruta sí la usa. Las actualizaciones de datos (consulta resuelta) y de los stores de estado son síncronas, así que el revelado del contenido y la salida de filas usan CSS y la API de animaciones del navegador sobre opacidad y desplazamiento.
- El roadmap menciona animar la altura de los errores con `interpolate-size`. El spec 003 solo permite opacidad, desplazamiento y color de fondo, así que los errores entran con desvanecimiento y desplazamiento, sin animar la altura.
- El giro del ＋ ya existe desde el spec 008; este spec solo lo verifica.
- El arrastre para cerrar se implementa con eventos de puntero nativos, solo desde el asa y solo en móvil (diálogos presentados como hoja inferior y `Sheet side="bottom"`).
- Las verificaciones con backend local o en vivo y la revisión visual en el deploy se omiten por decisión del usuario; las animaciones que dependen de escrituras (alta, baja y destello tras guardar) se prueban con pruebas unitarias y e2e `@live` que no se ejecutan.
- Depende de los specs 003 (tokens y kill-switch de motion), 008 (hoja ＋, barra móvil) y 009 (borrado con deshacer, `PageQueryState`).
