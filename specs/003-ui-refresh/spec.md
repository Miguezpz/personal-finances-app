# Feature Specification: Renovación visual "Fresh & Growth"

**Feature Branch**: `main` (feature `003-ui-refresh`, sin rama propia)

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "UI refresh "Fresh & Growth" (003-ui-refresh). Modernize the interface of the personal finances app following the approved plan. Scope: (1) emerald brand palette #052E2B ink, #0F766E teal, #34D399 emerald, #A7F3D0 mint, #ECFDF5 mist applied with a 60-30-10 strategy to backgrounds, typography, buttons and a new single-per-screen CTA style, all text pairs meeting WCAG 2.1 AA (emerald never used as text on light backgrounds); (2) light theme by default plus a dark theme with a user toggle that respects the OS preference and persists without flashing; (3) new visual identity: brand mark replacing the generic wallet icon, favicon/app icon/apple touch icon and an installable web manifest; (4) Safe-to-Spend traffic light green uses the brand color while amber and red stay as universal alert signals; net worth chart series recolored and validated for color-vision deficiencies; (5) subtle micro-interactions (sliding active nav indicator, staggered card entrance on first mount, brief highlight when a balance changes, progress bar growth, privacy blur transition, short dialog/sheet transitions, route content fade, skeleton shimmer) that never delay data, never reveal masked amounts and are fully disabled under prefers-reduced-motion; (6) responsive UX: on mobile a bottom navigation bar with 4 main destinations plus "More", a floating "Add expense" CTA in thumb reach, a compact header with preferences grouped in a menu, dialogs as bottom sheets, the ledger as stacked cards, touch targets of at least 44px; on desktop a fixed sidebar, wider content and a denser dashboard grid. Must keep existing quality gates green: axe WCAG 2.1 AA (now in both themes and on mobile), perceived-performance budgets, privacy mode, demo bundle isolation, EN/ES i18n."

## Clarifications

### Session 2026-11-04

- Q: Sin preferencia guardada, ¿la app arranca siempre en claro o según el sistema operativo? → A: Por defecto "Sistema" (oscuro si el SO está en oscuro; claro en cualquier otro caso, incluido cuando el SO no indica preferencia).
- Q: En móvil, ¿cómo convive el CTA flotante "Agregar gasto" con la regla de una sola llamada a la acción destacada por pantalla? → A: En móvil el CTA flotante es la única llamada a la acción destacada en todas las pantallas de la app; la acción propia de cada pantalla pasa a estilo de acción principal normal, y en Dashboard y Gastos se oculta el botón "Agregar gasto" de la página. En escritorio no hay CTA flotante y cada pantalla conserva su llamada a la acción destacada.
- Q: ¿Qué cuatro secciones van fijas en la barra inferior móvil? → A: Dashboard, Gastos, Ingresos y Metas; el resto (recurrentes, por cobrar, crédito, patrimonio, libro, configuración) queda en "Más".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una identidad visual propia que inspira confianza (Priority: P1)

Como dueño de la app (y como reclutador que visita la demo), quiero que la interfaz tenga una identidad visual coherente —paleta esmeralda, logotipo propio, jerarquía clara y una sola acción destacada por pantalla— para que la app transmita confianza, modernidad y crecimiento en lugar de verse como una plantilla genérica.

**Why this priority**: es el núcleo de la feature. Sin la paleta, la jerarquía de botones y el logotipo, el resto (tema oscuro, animaciones, móvil) no tiene sobre qué construirse. Por sí sola ya cambia la percepción del producto y del portafolio.

**Independent Test**: abrir cada pantalla en tema claro y comprobar que usa únicamente la paleta definida, que el logotipo propio aparece en el encabezado y la pantalla de inicio, que cada pantalla tiene como máximo una acción principal destacada, que la pestaña del navegador muestra el ícono de la marca y que la auditoría automática de accesibilidad no reporta problemas graves de contraste.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla en tema claro, **When** se observa, **Then** los fondos son mayoritariamente blancos o menta muy claro (#ECFDF5), el texto principal es verde casi negro (#052E2B), las acciones principales y enlaces usan teal (#0F766E) y el esmeralda (#34D399) solo aparece como relleno con texto oscuro encima o como elemento decorativo, nunca como texto.
2. **Given** una pantalla de escritorio con una acción principal de crecimiento (registrar ingreso, agregar gasto, aportar a una meta, explorar la demo), **When** se observa, **Then** esa acción —y solo esa— se presenta con el estilo destacado de llamada a la acción; en móvil, ese papel lo cumple únicamente el CTA flotante "Agregar gasto".
3. **Given** el encabezado de la app o la pantalla de inicio, **When** se observan, **Then** muestran el logotipo propio de la marca en lugar del ícono genérico de cartera.
4. **Given** la app abierta en una pestaña del navegador (tema claro u oscuro del navegador), **When** se mira la pestaña, **Then** se ve el ícono de la marca, legible a tamaño pequeño.
5. **Given** un dispositivo móvil, **When** el usuario agrega la app a su pantalla de inicio, **Then** aparece con el nombre y el ícono de la marca y con los colores de la marca en su pantalla de arranque.
6. **Given** el semáforo de Safe-to-Spend en estado "en buen camino", **When** se observa, **Then** usa el verde de la marca; los estados "precaución" y "excedido" conservan ámbar y rojo, y los tres siguen acompañados de ícono y texto.
7. **Given** cualquier monto en pantalla, **When** se observa, **Then** se muestra en el color de texto neutro y con cifras de ancho uniforme (alineadas en columnas); el verde se reserva para variaciones positivas y el rojo para negativas.

---

### User Story 2 - Registrar y consultar desde el celular con una mano (Priority: P1)

Como dueño que registra gastos en el momento desde el celular, quiero navegar con una barra inferior al alcance del pulgar, tener siempre a mano el botón "Agregar gasto" y que formularios y tablas se adapten a la pantalla pequeña, para registrar un gasto rápido sin pelear con la interfaz.

**Why this priority**: el registro diario de baja fricción es el objetivo principal del producto, y ocurre sobre todo en el celular. Hoy la navegación móvil depende de un menú lateral oculto y los controles son pequeños para el dedo.

**Independent Test**: en un viewport de 375 px, navegar entre Dashboard, Gastos, Ingresos y Metas con la barra inferior, abrir el resto de secciones desde "Más", registrar un gasto desde el botón flotante y consultar el libro de movimientos, sin desplazamiento horizontal en ninguna pantalla.

**Acceptance Scenarios**:

1. **Given** un viewport menor a 768 px, **When** se abre cualquier pantalla de la app, **Then** hay una barra de navegación inferior fija con Dashboard, Gastos, Ingresos, Metas y "Más", que respeta el área segura del dispositivo e indica la sección activa.
2. **Given** la barra inferior, **When** el usuario pulsa "Más", **Then** se abre un panel con el resto de secciones (recurrentes, por cobrar, crédito, patrimonio, libro, configuración).
3. **Given** cualquier pantalla de la app en móvil, **When** el usuario busca registrar un gasto, **Then** encuentra un botón flotante "Agregar gasto" en la zona inferior que abre el formulario de gasto, y es la única llamada a la acción destacada de la pantalla (en Dashboard y Gastos no aparece un segundo botón "Agregar gasto").
4. **Given** el formulario de gasto (o cualquier otro diálogo) en móvil, **When** se abre, **Then** aparece como un panel que sube desde la parte inferior, con campos de al menos 16 px de texto y teclado numérico para los montos.
5. **Given** el libro de movimientos en móvil, **When** se consulta, **Then** cada movimiento se muestra como una tarjeta apilada legible, sin desplazamiento horizontal.
6. **Given** el encabezado en móvil, **When** se observa, **Then** muestra el logotipo y el interruptor de privacidad; idioma, moneda y tema están agrupados en un menú de "Preferencias".
7. **Given** cualquier control interactivo en un dispositivo táctil, **When** se mide, **Then** su área táctil es de al menos 44 × 44 px.
8. **Given** el dashboard en móvil, **When** se abre, **Then** lo primero que se ve son los saldos disponibles de Necesidades y Gustos como cifras destacadas, antes de su desglose y de las alertas.

---

### User Story 3 - Tema oscuro que respeta mi preferencia (Priority: P2)

Como dueño que revisa sus finanzas de noche, quiero un tema oscuro con la misma identidad de marca, que siga la preferencia de mi sistema por defecto y que pueda fijar manualmente, sin que la pantalla parpadee en blanco al cargar.

**Why this priority**: mejora el confort y la percepción de calidad, pero la app ya es usable sin él.

**Independent Test**: con el sistema en modo oscuro abrir la app y comprobar que arranca en oscuro sin destello claro; cambiar manualmente a claro, recargar y comprobar que la elección persiste; ejecutar la auditoría de accesibilidad en tema oscuro sin problemas graves.

**Acceptance Scenarios**:

1. **Given** un usuario sin preferencia guardada y con el sistema en modo oscuro, **When** abre la app, **Then** se muestra en tema oscuro desde el primer cuadro, sin destello del tema claro.
2. **Given** el interruptor de tema, **When** el usuario elige "Claro", "Oscuro" o "Sistema", **Then** la interfaz cambia de inmediato y la elección se conserva al recargar y en visitas posteriores en ese navegador.
3. **Given** la opción "Sistema", **When** el sistema operativo cambia entre claro y oscuro con la app abierta, **Then** la app cambia de tema sin recargar.
4. **Given** el tema oscuro, **When** se observa cualquier pantalla, **Then** el fondo es verde muy profundo, las tarjetas usan #052E2B, el texto es claro y el esmeralda es el color de acento y de acción principal.
5. **Given** el tema oscuro, **When** se muestran avisos emergentes, gráficas o el semáforo, **Then** también usan su variante oscura y mantienen el contraste requerido.

---

### User Story 4 - Una interfaz que se siente viva sin estorbar (Priority: P3)

Como usuario, quiero transiciones y respuestas visuales sutiles (al navegar, al guardar, al activar la privacidad, al abrir diálogos) que hagan la app fluida y moderna, y como persona sensible al movimiento quiero que todo eso desaparezca si así lo indico en mi sistema.

**Why this priority**: aporta pulido y sensación de calidad, pero no cambia lo que el usuario puede hacer.

**Independent Test**: navegar entre secciones, guardar un gasto, alternar privacidad y abrir diálogos observando las transiciones; repetir con "reducir movimiento" activado en el sistema y comprobar que no hay ninguna animación en curso; comprobar que los presupuestos de rendimiento percibido siguen cumpliéndose.

**Acceptance Scenarios**:

1. **Given** la navegación lateral o inferior, **When** el usuario cambia de sección, **Then** el indicador de sección activa se desliza hacia el nuevo elemento y el contenido aparece con un fundido breve.
2. **Given** el dashboard cargado por primera vez en la sesión, **When** aparecen las tarjetas, **Then** entran de forma escalonada y breve; al volver a la pantalla o al actualizar datos no se repite la entrada.
3. **Given** que el usuario guarda un movimiento que cambia un saldo, **When** el saldo se actualiza, **Then** la tarjeta afectada muestra un realce breve de color; la cifra aparece ya con su valor final (sin conteo animado).
4. **Given** el modo privacidad, **When** el usuario lo activa o desactiva, **Then** los montos se difuminan o aparecen con una transición breve, y en ningún momento de la transición se muestra un monto real con la privacidad activa.
5. **Given** la barra de progreso de un bucket, **When** aparece, **Then** crece desde cero hasta su valor; al cambiar el estado del semáforo, el color cambia de forma suave.
6. **Given** botones y acciones, **When** el usuario pasa el cursor o pulsa, **Then** reciben una respuesta visual inmediata (cambio de color, leve hundimiento al pulsar).
7. **Given** contenido cargando, **When** se muestra el esqueleto de carga, **Then** tiene un brillo que se desplaza suavemente.
8. **Given** el sistema con "reducir movimiento" activado, **When** el usuario usa la app, **Then** no se ejecuta ningún desplazamiento, escalado, brillo ni entrada escalonada; los cambios de estado son instantáneos.

---

### Edge Cases

- **Preferencia de tema ilegible o corrupta**: la app usa "Sistema" sin error ni destello.
- **Navegador sin soporte de preferencia de color del sistema**: la app usa el tema claro.
- **Almacenamiento del navegador bloqueado (modo privado)**: el tema sigue al sistema y el interruptor funciona durante la sesión aunque no persista.
- **Privacidad activa mientras ocurre una animación** (entrada de tarjetas, realce de saldo, cambio de tema): los montos permanecen enmascarados durante toda la animación.
- **Datos que llegan mientras una animación de entrada está en curso**: los datos se muestran de inmediato; la animación nunca retrasa la visibilidad de un saldo.
- **Rotación del dispositivo o ventana que cruza el punto de corte móvil/escritorio con un diálogo abierto**: el diálogo sigue abierto y conserva lo escrito.
- **Pantallas muy estrechas (320 px)**: la barra inferior y el encabezado caben sin solaparse ni desbordarse horizontalmente.
- **Teclado virtual abierto en móvil**: la barra inferior y el botón flotante no tapan el campo que se está editando.
- **Navegación solo con teclado en escritorio**: el enlace para saltar al contenido sigue siendo el primer elemento enfocable y el foco es visible con el color de la marca en ambos temas.
- **Demo pública**: todos los cambios visuales aplican igual en la demo, sin introducir dependencias del backend.
- **Pestañas del navegador en tema oscuro**: el ícono de la marca sigue siendo distinguible.

## Requirements *(mandatory)*

### Functional Requirements

**Color e identidad**

- **FR-001**: La interfaz MUST usar como paleta de marca exclusivamente #052E2B (tinta), #0F766E (teal), #34D399 (esmeralda), #A7F3D0 (menta) y #ECFDF5 (bruma), más los tonos derivados necesarios para cumplir contraste (texto secundario, estado de hover, fondo oscuro profundo, texto secundario oscuro), y los colores de alerta ámbar y rojo.
- **FR-002**: La distribución de color MUST seguir la proporción aproximada 60-30-10: superficies blancas/claras como base, tinta para texto y estructura, y acentos de marca reservados para acciones, estados positivos y realces.
- **FR-003**: Todo texto MUST tener un contraste mínimo de 4.5:1 con su fondo (3:1 para texto grande) y todo indicador no textual necesario para entender la interfaz (bordes de campos, anillos de foco, barras de progreso, series de gráficas) MUST tener al menos 3:1, en ambos temas.
- **FR-004**: El esmeralda (#34D399) MUST NOT usarse como color de texto ni como único indicador sobre fondos claros.
- **FR-005**: Los botones MUST tener una jerarquía consistente: acción principal (teal con texto blanco en claro; esmeralda con texto oscuro en oscuro), llamada a la acción destacada (esmeralda con texto tinta), secundaria, contorno, fantasma y destructiva.
- **FR-006**: Cada pantalla MUST presentar como máximo una llamada a la acción destacada. En escritorio (≥ 768 px) se asigna a su acción de crecimiento principal (dashboard y gastos: agregar gasto; ingresos: registrar ingreso; metas: aportar/crear meta; por cobrar: agregar cuenta por cobrar; pantalla de inicio: explorar la demo). En móvil (< 768 px), dentro de la app, la única llamada a la acción destacada es el CTA flotante "Agregar gasto" (FR-020); la acción propia de cada pantalla se muestra con el estilo de acción principal normal, y en Dashboard y Gastos el botón "Agregar gasto" de la página se oculta para no duplicarlo.
- **FR-007**: Los montos MUST mostrarse en el color de texto neutro con cifras de ancho uniforme; el verde de marca se reserva para variaciones positivas y el rojo para negativas.
- **FR-008**: El indicador de foco del teclado MUST usar el color de marca (teal en claro, esmeralda en oscuro) y ser visible en todos los controles interactivos.
- **FR-009**: La app MUST tener un logotipo propio (monograma de crecimiento sobre fondo tinta con acento esmeralda) presente en el encabezado y en la pantalla de inicio, en sustitución del ícono genérico de cartera.
- **FR-010**: La app MUST declarar íconos de marca para la pestaña del navegador (con variante legible en pestañas oscuras y a 16 px), para navegadores antiguos y para la pantalla de inicio de dispositivos Apple, y MUST ofrecer un manifiesto que permita instalarla en móvil con nombre, ícono y colores de la marca.
- **FR-011**: El color de la barra del navegador móvil MUST coincidir con el tema activo.
- **FR-012**: El semáforo de Safe-to-Spend MUST usar el verde de marca para el estado "en buen camino" y conservar ámbar y rojo para "precaución" y "excedido", siempre acompañados de ícono y texto.
- **FR-013**: Las series de la gráfica de patrimonio MUST recolorearse con la marca (patrimonio neto en el color de marca, activos y pasivos en tonos claramente diferenciados), ser distinguibles para las formas comunes de daltonismo y conservar la leyenda con nombres.
- **FR-014**: Las gráficas y los saldos disponibles del dashboard MUST presentarse sobre un bloque de fondo de realce claro que guíe la vista.

**Tema**

- **FR-015**: La app MUST ofrecer tema claro y tema oscuro, con un control de tema con las opciones "Claro", "Oscuro" y "Sistema"; el valor por defecto (sin preferencia guardada, o con una preferencia ilegible) es "Sistema"; si el sistema no indica preferencia o no se puede determinar, se usa el tema claro.
- **FR-016**: La elección de tema MUST persistir entre visitas en el mismo navegador y aplicarse antes de que la página se pinte por primera vez (sin destello del tema contrario).
- **FR-017**: Con la opción "Sistema", la app MUST reaccionar en vivo a cambios de la preferencia del sistema operativo.
- **FR-018**: Todos los elementos (avisos emergentes, diálogos, gráficas, semáforo, banners de estado, aviso de demo) MUST tener una variante coherente en ambos temas.

**Diseño responsivo**

- **FR-019**: En anchos menores a 768 px la app MUST mostrar una barra de navegación inferior fija con Dashboard, Gastos, Ingresos, Metas y "Más" (que abre el resto de secciones), respetando el área segura del dispositivo.
- **FR-020**: En anchos menores a 768 px la app MUST mostrar, en todas las pantallas autenticadas, un botón flotante "Agregar gasto" en la zona inferior, que se oculta al desplazarse hacia abajo y reaparece al desplazarse hacia arriba, y que nunca tapa el campo en edición.
- **FR-021**: En móvil el encabezado MUST mostrar solo el logotipo, el interruptor de privacidad y un menú "Preferencias" que agrupe idioma, moneda, tema y cerrar sesión.
- **FR-022**: En móvil los diálogos de formulario MUST presentarse como paneles que suben desde abajo; en escritorio, como diálogos centrados. En ambos casos MUST seguir siendo diálogos accesibles.
- **FR-023**: En móvil el libro de movimientos MUST mostrarse como tarjetas apiladas; en escritorio, como tabla.
- **FR-024**: Ninguna pantalla MUST provocar desplazamiento horizontal de la página en anchos de 320 px o más.
- **FR-025**: En dispositivos táctiles todo control interactivo MUST tener un área táctil mínima de 44 × 44 px; los campos de texto MUST tener al menos 16 px de tamaño de letra y los campos de monto MUST abrir el teclado numérico.
- **FR-026**: En escritorio (≥ 1024 px) la app MUST mostrar una barra lateral fija, aprovechar un ancho de contenido mayor que el actual y presentar el dashboard en una cuadrícula en la que los dos buckets (con su saldo disponible, semáforo y barra de progreso) se vean lado a lado sin desplazamiento en una pantalla de 1440 × 900.
- **FR-027**: En móvil el dashboard MUST mostrar primero los saldos disponibles de cada bucket en tamaño destacado, antes de desgloses y alertas.

**Microinteracciones y movimiento**

- **FR-028**: El indicador de sección activa de la navegación MUST desplazarse de forma animada al cambiar de sección, y el contenido de la nueva sección MUST aparecer con un fundido breve.
- **FR-029**: Las tarjetas del dashboard MUST entrar de forma escalonada solo en su primer montaje de la sesión.
- **FR-030**: Al cambiar un saldo tras guardar un movimiento, la tarjeta afectada MUST mostrar un realce breve; las cifras MUST mostrarse siempre con su valor final, sin animaciones de conteo.
- **FR-031**: La barra de progreso de cada bucket MUST crecer desde cero al aparecer y el color del semáforo MUST cambiar suavemente.
- **FR-032**: El cambio del modo privacidad MUST tener una transición breve; ningún monto real MUST ser legible en ningún cuadro de la transición cuando la privacidad está activa. Los campos de monto editables, que solo están protegidos por el difuminado, se ocultan de forma instantánea.
- **FR-033**: Los botones MUST dar respuesta visual inmediata al pasar el cursor y al pulsar; los diálogos y paneles MUST abrir y cerrar con transiciones breves; los esqueletos de carga MUST tener un brillo en movimiento.
- **FR-034**: Ninguna animación MUST durar más de 300 ms (excepto el brillo continuo de los esqueletos), retrasar la aparición de datos ni bloquear la interacción.
- **FR-035**: Cuando el sistema indica preferencia de movimiento reducido, la app MUST desactivar todos los desplazamientos, escalados, brillos, entradas escalonadas y realces animados; los cambios de estado MUST ser instantáneos.

**Calidad y alcance**

- **FR-036**: Todos los textos nuevos (control de tema, "Más", "Preferencias", etiquetas accesibles) MUST estar disponibles en inglés y español.
- **FR-037**: La renovación MUST aplicarse por igual a la app personal y a la demo pública, sin que la demo incorpore dependencias del backend.
- **FR-038**: Las verificaciones de calidad existentes (accesibilidad, rendimiento percibido, privacidad, aislamiento de la demo, idiomas) MUST seguir pasando; la auditoría de accesibilidad MUST ejecutarse además en tema oscuro y en viewport móvil.
- **FR-039**: Los colores de marca MUST definirse en un único lugar y la verificación automática de contraste de FR-003 MUST ejecutarse como parte de las pruebas.

### Key Entities

- **Preferencia de tema**: elección del usuario entre "Claro", "Oscuro" y "Sistema"; se guarda junto con las demás preferencias de visualización existentes (idioma, privacidad, moneda) en el navegador, no en el servidor.
- **Paleta de marca**: conjunto de colores primitivos y su asignación a roles (fondo, texto, acción principal, llamada a la acción, foco, realce, éxito, alerta) por tema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los pares texto/fondo y de los indicadores no textuales de la paleta cumplen los ratios de contraste WCAG 2.1 AA en ambos temas, verificado automáticamente.
- **SC-002**: La auditoría automática de accesibilidad reporta cero problemas graves o críticos en todas las pantallas y diálogos principales, en tema claro, en tema oscuro y en viewport móvil.
- **SC-003**: En un celular (375 px), el dueño registra un gasto partiendo de cualquier pantalla en no más de 2 toques hasta tener el formulario abierto, y nunca necesita desplazarse horizontalmente.
- **SC-004**: El 100 % de las recargas con una preferencia de tema guardada o del sistema se pintan directamente en el tema correcto, sin destello del contrario.
- **SC-005**: Con "reducir movimiento" activado no queda ninguna animación en curso una vez cargada cada pantalla.
- **SC-006**: Los presupuestos de rendimiento percibido existentes se siguen cumpliendo (saldos visibles en < 5 s, saldo actualizado en < 1 s tras guardar, cambio de idioma en < 1 s) y el peso de código descargado en la primera visita no aumenta más de 20 kB respecto a la línea base.
- **SC-007**: Ninguna pantalla presenta más de una llamada a la acción destacada, ni en escritorio ni en móvil (contando el CTA flotante).
- **SC-008**: En una pantalla de escritorio de 1440 × 900, los dos buckets del dashboard con su saldo disponible, semáforo y barra de progreso son visibles lado a lado sin desplazarse.
- **SC-009**: Ningún texto nuevo aparece sin traducir en ninguno de los dos idiomas.
- **SC-010**: El ícono de la marca es reconocible en pestañas claras y oscuras y la app puede instalarse en la pantalla de inicio de un celular con su nombre e ícono.

## Assumptions

- La renovación es puramente visual y de interacción: no cambia reglas de negocio, cálculos, datos almacenados ni flujos de autenticación.
- La preferencia de tema se guarda en el navegador como las demás preferencias de visualización; no se sincroniza entre dispositivos.
- Los destinos de la barra inferior (Dashboard, Gastos, Ingresos, Metas) están confirmados (ver Clarifications) por ser los de uso más frecuente; el resto queda en "Más".
- Ámbar y rojo se conservan como colores de alerta fuera de la paleta de marca porque son señales universales; se usan solo para estados de precaución, exceso y error.
- La tipografía actual se conserva; solo cambian color, peso, escala y el uso de cifras de ancho uniforme en montos.
- La validación de contraste usa los ratios de WCAG 2.1 (fórmula de luminancia relativa).
- El atajo "Agregar gasto" en escritorio sigue siendo el botón existente del dashboard y de gastos; no se añaden atajos de teclado nuevos en esta feature.
- Las revisiones visuales con las skills de diseño que menciona la constitución se hacen si están disponibles en el entorno; no bloquean la entrega.
- Fuera de alcance: rediseño de flujos, nuevas pantallas, modo de alto contraste dedicado, personalización de colores por el usuario, notificaciones push y funcionamiento offline como PWA más allá de lo que ya existe.
