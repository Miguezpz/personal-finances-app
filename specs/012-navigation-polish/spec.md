# Feature Specification: Pulido visual de la navegación y del menú móvil

**Feature Branch**: `main` (sin rama de feature)

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Spec 012 — Pulido visual de la navegación y del menú móvil. Solo UI, sin datos ni migraciones. Enmienda spec 008. (1) Panel 'Más' en cuadrícula compacta. (2) ＋ dentro de la barra inferior. (3) En neón, lima sólido solo para acciones; 'activo/seleccionado' en tinte. (4) 'Agregar meta/cuenta' en estilo secundario. (5) Riel de iconos en tablet. (6) Aviso demo compacto en móvil. (7) Título de sección en el header móvil. (8) 'Cerrar sesión' al pie del sidebar. (9) Limpieza de claves i18n muertas."

## Clarifications

### Session 2026-11-11

Respondidas por el dueño antes de especificar; no quedan puntos abiertos.

- Q: ¿Cómo se presenta el panel "Más"? → A: Cuadrícula de 3 columnas con mosaicos; los grupos quedan solo para lectores de pantalla.
- Q: ¿Dónde vive el botón ＋ de la barra móvil? → A: Dentro de la barra, sin sobresalir.
- Q: ¿Cómo se distingue "activo" de "acción" en neón? → A: "Activo/seleccionado" en tinte oscuro con texto lima; el lima sólido solo para acciones.
- Q: ¿Extras? → A: Título de sección en el header móvil y "Cerrar sesión" al sidebar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menú "Más" compacto y barra que no tapa nada (Priority: P1)

Como dueño, en el teléfono quiero que el panel "Más" quede al alcance del pulgar y que la barra inferior no tape montos ni textos al desplazarme.

**Why this priority**: hoy "Más" ocupa ~68 % de la pantalla y el ＋ sobresale 20 px cortando contenido; es lo que más se nota en cada uso móvil.

**Independent Test**: en 390 × 844 px abrir "Más": 7 enlaces visibles, panel ≤ 50 % del alto; desplazar Metas y comprobar que el ＋ queda dentro del rectángulo de la barra.

**Acceptance Scenarios**:

1. **Given** un teléfono, **When** se abre "Más", **Then** los 6 destinos secundarios aparecen en cuadrícula de 3 columnas (icono arriba, texto abajo) y Configuración como fila de ancho completo bajo un separador; el panel mide como máximo 50 % del alto de la pantalla.
2. **Given** el panel "Más", **When** se ve el destino actual, **Then** está marcado con tinte de seleccionado y se anuncia como página actual.
3. **Given** un lector de pantalla, **When** recorre el panel, **Then** encuentra los cuatro encabezados de grupo (Principal, Planear, Deudas, Análisis); visualmente no se muestran.
4. **Given** la barra inferior, **When** se ve, **Then** el ＋ está por completo dentro del rectángulo de la barra, sin anillo ni halo, y el contenido de la página no queda tapado por él.
5. **Given** cualquier ancho de 320 a 767 px, **When** se llega al final de la página, **Then** la última línea queda visible sobre la barra.
6. **Given** los mosaicos de "Más" y de la hoja ＋, **When** se miden, **Then** comparten el mismo estilo y tienen un área táctil ≥ 44 px.

---

### User Story 2 - En neón, un solo elemento lima sólido por pantalla (Priority: P1)

Como dueño con el tema neón, quiero que el lima sólido señale solo la acción principal y que "activo/seleccionado" se vea distinto.

**Why this priority**: hoy 4–5 bloques lima por pantalla (destino activo, toggles de idioma y moneda, "Agregar", ＋/Nuevo, aviso demo) anulan la jerarquía.

**Independent Test**: en neón, abrir Metas: el único elemento lima sólido es la acción principal; los toggles y el destino activo usan tinte.

**Acceptance Scenarios**:

1. **Given** el tema neón, **When** se ve un destino activo o una opción seleccionada de los toggles de idioma y moneda, **Then** se muestra en tinte oscuro con texto lima, con contraste de texto ≥ 4.5:1.
2. **Given** los temas claro y oscuro, **When** se ven los toggles de idioma y moneda, **Then** la opción seleccionada usa el color de "activo" del tema (no el de acción).
3. **Given** el tema neón, **When** se ven el brillo de saldos y el destello de carga, **Then** se ven exactamente igual que antes de este spec.
4. **Given** cualquier pantalla de escritorio o móvil, **When** se cuentan las llamadas a la acción destacadas, **Then** hay como máximo una; "Agregar meta" y "Agregar cuenta" usan estilo secundario.

---

### User Story 3 - Shell sin recortes de 320 a 1440 px (Priority: P1)

Como dueño en una tablet o ventana mediana, quiero ver los montos completos y la navegación usable.

**Why this priority**: entre 768 y 1023 px el sidebar fijo de 240 px deja 528 px y el Dashboard recorta montos.

**Independent Test**: a 768 × 600 px, `main` no tiene desbordamiento horizontal y cada enlace del riel tiene nombre accesible.

**Acceptance Scenarios**:

1. **Given** un ancho de 768 a 1023 px, **When** se ve la navegación lateral, **Then** es un riel de iconos de 64 px; cada destino conserva nombre accesible y tooltip; los encabezados de grupo no se ven (hay un separador fino) pero siguen disponibles a lectores de pantalla.
2. **Given** un ancho ≥ 1024 px, **When** se ve la navegación lateral, **Then** es la barra completa con texto y encabezados, como hoy.
3. **Given** cualquier ancho de 320 a 1440 px, **When** se ve una pantalla, **Then** no hay desbordamiento horizontal ni montos recortados.
4. **Given** el riel de iconos, **When** el destino activo cambia, **Then** el indicador animado sigue al destino.

---

### User Story 4 - Contexto en el header móvil y aviso demo compacto (Priority: P2)

Como dueño en móvil quiero saber en qué sección estoy aunque haya hecho scroll, y que el aviso demo no ocupe media pantalla.

**Why this priority**: el header móvil no dice nada, el título de página se va con el scroll y el aviso demo ocupa 80–100 px.

**Independent Test**: en demo a 390 px, el aviso ocupa una línea; al desplazar, aparece el nombre de la sección en el header.

**Acceptance Scenarios**:

1. **Given** el demo en móvil (< 640 px), **When** se ve el aviso, **Then** muestra el texto corto ("Demo de solo lectura · datos ficticios" / "Read-only demo · sample data"): una línea a 390 px, como máximo dos a 320 px.
2. **Given** el demo en ≥ 640 px, **When** se ve el aviso, **Then** muestra el texto largo actual; el texto largo sigue presente en el documento.
3. **Given** móvil y un navegador con animación ligada al scroll y sin preferencia de movimiento reducido, **When** el dueño desplaza la página, **Then** el nombre de la sección activa aparece junto al logo con un fundido (solo opacidad); en subpáginas de Configuración dice "Configuración".
4. **Given** un navegador sin esa capacidad o con movimiento reducido, **When** se ve el header, **Then** el título permanece oculto, como hoy, y no queda ninguna animación corriendo.
5. **Given** el título del header, **When** lo lee un lector de pantalla, **Then** se ignora (el título real es el de la página).

---

### User Story 5 - "Cerrar sesión" al pie del sidebar (Priority: P3)

Como dueño en escritorio quiero que "＋ Nuevo" sea el último elemento de la barra superior.

**Why this priority**: hoy "Cerrar sesión" va a su derecha y le quita el protagonismo.

**Independent Test**: en 1440 px la barra superior termina en "＋ Nuevo"; "Cerrar sesión" está bajo Configuración en el sidebar.

**Acceptance Scenarios**:

1. **Given** el escritorio (≥ 768 px), **When** se ve la barra superior, **Then** "＋ Nuevo" es su último elemento y no hay botón de cerrar sesión.
2. **Given** el sidebar completo, **When** se ve el pie, **Then** "Cerrar sesión" aparece bajo Configuración con el mismo estilo de fila; en el riel de iconos muestra solo el icono con nombre accesible.
3. **Given** móvil, **When** se abre "Apariencia", **Then** "Cerrar sesión" sigue ahí.

---

### Edge Cases

- **320 px**: los mosaicos de "Más" no se cortan; el aviso demo cabe en dos líneas; el título del header se trunca con elipsis.
- **Ruta secundaria o subpágina de Configuración**: el mosaico correcto queda activo; el título del header usa el destino que la contiene.
- **Teclado y foco**: todos los mosaicos, enlaces del riel y "Cerrar sesión" tienen foco visible.
- **Rotación y área segura inferior**: la barra sigue respetando el inset y el espacio inferior de la página no cambia en escritorio.
- **Hoja "Más" recién abierta**: no hay indicador deslizante (se abre de cero).
- **Demo**: todo funciona sin backend; guardar sigue mostrando el aviso de solo lectura.

## Requirements *(mandatory)*

### Functional Requirements

**Panel "Más" (enmienda de spec 008 FR-006)**

- **FR-001**: El panel "Más" MUST mostrar los 6 destinos secundarios en cuadrícula de 3 columnas con mosaicos icono-arriba/texto-abajo y Configuración como fila de ancho completo bajo un separador; MUST medir como máximo 50 % del alto de la pantalla.
- **FR-002**: Los mosaicos de "Más" y de la hoja ＋ MUST compartir un mismo estilo definido en un solo lugar.
- **FR-003**: Los encabezados de grupo MUST estar disponibles solo para lectores de pantalla (cuatro encabezados). El destino actual MUST marcarse como página actual y con el color de "seleccionado". El indicador deslizante deja de aplicar en este panel (enmienda de spec 008 §Assumptions).

**Barra inferior (enmienda de spec 008 FR-003)**

- **FR-004**: El ＋ MUST quedar por completo dentro del rectángulo de la barra: sin saliente, sin margen negativo, sin anillo ni halo. Conserva su color de acción, rotación al abrir y atributos de accesibilidad.
- **FR-005**: El espacio inferior móvil de la página MUST reducirse en lo que ya no sobresale (de 5 rem a 4.5 rem más el área segura).

**Color y jerarquía**

- **FR-006**: En neón, "activo/seleccionado" MUST usar un tinte oscuro (`#2d320c`) con texto lima, con contraste ≥ 4.5:1; el lima sólido MUST reservarse para acciones.
- **FR-007**: Los toggles de idioma y moneda MUST usar el color de "activo" del tema (no el de acción) en los tres temas.
- **FR-008**: El brillo de saldos y el destello de carga en neón MUST verse idénticos a antes.
- **FR-009**: "Agregar meta" y "Agregar cuenta" MUST usar estilo secundario; ninguna acción de página MUST quedar como botón relleno que compita con la acción global (enmienda de spec 008 FR-012).

**Tablet**

- **FR-010**: De 768 a 1023 px la navegación lateral MUST ser un riel de iconos de 64 px con nombre accesible y tooltip por destino, encabezados de grupo solo para lectores de pantalla y separador fino entre grupos; desde 1024 px, la barra completa.
- **FR-011**: No MUST haber desbordamiento horizontal ni montos recortados de 320 a 1440 px.

**Header y aviso**

- **FR-012**: En móvil, el header MUST poder mostrar el nombre de la sección activa tras el logo, solo con cambio de opacidad ligado al scroll, solo cuando el navegador lo soporta y no hay movimiento reducido; si no, permanece oculto. Es decorativo (oculto a lectores de pantalla).
- **FR-013**: El aviso demo MUST mostrar un texto corto (< 640 px) en EN y ES, y el largo desde 640 px; el largo MUST seguir en el documento.

**Sidebar**

- **FR-014**: "Cerrar sesión" MUST salir de la barra superior de escritorio y mostrarse al pie del sidebar bajo Configuración (solo icono en el riel). En móvil permanece en "Apariencia".

**Limpieza y transversales**

- **FR-015**: Las claves de texto sin uso (`nav.openMenu`, `nav.closeMenu`, `nav.preferences`) MUST eliminarse de ES y EN; ES y EN MUST mantener paridad.
- **FR-016**: Todo texto visible nuevo MUST existir en ES y EN; el movimiento MUST limitarse a opacidad/transform ≤ 300 ms y desactivarse con movimiento reducido (spec 003).
- **FR-017**: Los identificadores de prueba existentes (`more-sheet`, `mobile-nav-*`, `create-*`, `demo-banner`) MUST conservarse.
- **FR-018**: Los controles táctiles MUST medir ≥ 44 × 44 px y tener foco visible.

### Key Entities

No hay datos nuevos ni cambios de esquema. Elementos de interfaz: mosaico de navegación, riel de iconos, título de sección del header, texto corto del aviso demo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El panel "Más" mide ≤ 50 % del alto de la pantalla y muestra los 7 destinos sin desplazarse en 390 × 844 px.
- **SC-002**: Ninguna parte del ＋ queda fuera de la barra inferior en 320–767 px.
- **SC-003**: Con tema neón, cada pantalla tiene como máximo 1 elemento lima sólido de acción; destinos activos y opciones seleccionadas usan tinte.
- **SC-004**: Cero desbordamiento horizontal y cero montos recortados de 320 a 1440 px (incluido 768 × 600).
- **SC-005**: El aviso demo ocupa una línea a 390 px y como máximo dos a 320 px.
- **SC-006**: La auditoría de accesibilidad sigue sin violaciones en los tres temas y en móvil; las pruebas de contraste de temas y de paridad de textos pasan.
- **SC-007**: La carga inicial del Dashboard no crece respecto a la versión anterior (sin dependencias nuevas).

## Assumptions

- Es trabajo solo de interfaz: no cambian datos, esquema ni cálculos; no se levanta backend local, y los e2e se verifican en modo demo.
- El título del header solo aparece en navegadores con animación ligada al scroll; en el resto, la experiencia es la actual (decisión de aceptar la degradación).
- Los destinos y sus rutas no cambian; solo su presentación.
- Las reglas de color de spec 003/008 se mantienen en claro y oscuro; solo neón cambia el color de "activo".
- Fuera de alcance: chips de filtro en lima, datos demo en inglés con UI en español, encabezado de `BucketCard` a 320 px, capturas del README, paleta de comandos, sidebar colapsable a mano.
- Enmienda spec 008: FR-003 (＋ elevado → dentro de la barra), FR-006 (encabezados visibles → solo lectores de pantalla), FR-012 (cumplimiento real en Metas y Cuentas) y la nota del indicador animado en "Más".
