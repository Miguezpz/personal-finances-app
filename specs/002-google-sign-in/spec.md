# Feature Specification: Inicio de sesión con Google

**Feature Branch**: `002-google-sign-in`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Inicio de sesión con Google (feature 002-google-sign-in), solo para la app personal (nunca en la demo). El único dueño puede entrar con su cuenta personal de Google además del correo y contraseña actuales. Su usuario usa el mismo correo que su Gmail y está confirmado, así que la identidad de Google debe vincularse automáticamente a la cuenta existente (mismos datos). El registro sigue desactivado: cualquier otra cuenta de Google es rechazada sin crear usuario y ve un mensaje claro en EN/ES. Tras volver de Google se redirige siempre al dashboard (sin open redirect); los errores vuelven a la pantalla de inicio con un mensaje. En modo demo el botón no existe y la ruta de retorno no carga nada del backend. El secreto de Google vive solo en el proveedor de autenticación; nada nuevo en el cliente ni en el hosting. La configuración externa queda documentada. El login con contraseña se conserva como respaldo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar con mi cuenta de Google (Priority: P1)

Como dueño de la app personal, quiero pulsar "Continuar con Google" en la pantalla de inicio, elegir mi cuenta personal de Google y llegar a mi dashboard con todos mis datos, sin teclear correo ni contraseña.

**Why this priority**: es el objetivo de la feature: entrar más rápido y sin recordar otra contraseña. Por sí sola ya entrega todo el valor.

**Independent Test**: en el despliegue personal, cerrar sesión, pulsar "Continuar con Google", elegir la cuenta del dueño y comprobar que se llega al dashboard con los mismos datos (mismas cuentas, movimientos y saldos) que al entrar con contraseña.

**Acceptance Scenarios**:

1. **Given** el dueño sin sesión en la pantalla de inicio, **When** pulsa "Continuar con Google" y elige su cuenta personal, **Then** vuelve a la app con la sesión iniciada y aterriza en el dashboard.
2. **Given** que es la primera vez que el dueño entra con Google, **When** completa el flujo, **Then** su identidad de Google queda asociada a su cuenta existente: ve exactamente los mismos datos que con correo y contraseña y no se crea una cuenta nueva.
3. **Given** que el dueño ya entró antes con Google, **When** repite el flujo, **Then** entra a la misma cuenta, sin duplicados.
4. **Given** una sesión iniciada con Google, **When** el dueño cierra sesión, **Then** vuelve a la pantalla de inicio y las páginas protegidas dejan de ser accesibles, igual que con una sesión de contraseña.
5. **Given** una sesión iniciada con Google, **When** el dueño recarga la página o vuelve más tarde dentro de la vigencia de la sesión, **Then** sigue con la sesión iniciada.

---

### User Story 2 - Rechazo claro de cualquier otra cuenta de Google (Priority: P1)

Como dueño de una app privada, quiero que nadie más pueda entrar ni crear una cuenta usando su propia cuenta de Google, y que quien lo intente vea un mensaje claro en lugar de un error técnico.

**Why this priority**: es una condición de seguridad. Sin ella, agregar Google abriría la puerta a registros que hoy están bloqueados.

**Independent Test**: intentar el flujo con una cuenta de Google distinta a la del dueño y comprobar que se vuelve a la pantalla de inicio con un mensaje de "cuenta no autorizada" y que el número de usuarios de la app sigue siendo uno.

**Acceptance Scenarios**:

1. **Given** una persona con una cuenta de Google distinta a la del dueño, **When** completa el flujo, **Then** vuelve a la pantalla de inicio sin sesión y ve el mensaje "Esta cuenta de Google no tiene acceso a esta app" (o su equivalente en inglés).
2. **Given** ese intento rechazado, **When** se revisan los usuarios de la app, **Then** sigue existiendo un único usuario y no se creó ninguna cuenta nueva.
3. **Given** que el dueño cancela en la pantalla de Google o el proveedor devuelve un error, **When** vuelve a la app, **Then** ve un mensaje genérico de "no se pudo iniciar sesión con Google, inténtalo de nuevo" y puede reintentar o usar su contraseña.

---

### User Story 3 - La demo no cambia (Priority: P2)

Como reclutador que visita la demo pública, la pantalla y el comportamiento de la demo siguen siendo los mismos: no aparece ninguna opción de Google y nada de la demo depende del servicio de autenticación.

**Why this priority**: protege el aislamiento de la demo, uno de los principios del proyecto, pero no aporta valor nuevo al dueño.

**Independent Test**: abrir la demo y su ruta de retorno de Google, y comprobar que no hay botón de Google, que la ruta de retorno redirige a la demo sin errores y que la verificación de aislamiento del bundle de la demo sigue sin encontrar rastros del backend.

**Acceptance Scenarios**:

1. **Given** el despliegue de demo, **When** se abre cualquier pantalla, **Then** no aparece ninguna opción "Continuar con Google".
2. **Given** el despliegue de demo, **When** alguien visita directamente la ruta de retorno de Google, **Then** se le redirige a la demo sin errores y sin contactar al backend.
3. **Given** el build de demo, **When** se ejecuta la verificación de aislamiento, **Then** no encuentra URLs, claves ni código del backend.

---

### Edge Cases

- El dueño cambia de idioma: el botón y todos los mensajes de error de Google se muestran en el idioma activo (EN/ES).
- Alguien visita la ruta de retorno sin el código de autorización, con un código inválido, caducado o ya usado: vuelve a la pantalla de inicio con el mensaje genérico y sin sesión.
- La ruta de retorno recibe un parámetro de destino externo (por ejemplo, `?next=https://sitio-malicioso`): se ignora y, si el inicio de sesión tiene éxito, siempre se aterriza en el dashboard de la propia app.
- El dueño ya tiene sesión y visita la ruta de retorno: se le lleva al dashboard sin errores.
- La base de datos está "dormida" (cold start) al volver de Google: se aplica el mismo manejo resiliente que en el resto de la app; si el intercambio falla, se ve el mensaje genérico y se puede reintentar.
- Sin conexión: el botón informa que no hay conexión en lugar de abrir una pantalla rota.
- Google oculta o cambia la cuenta elegida: el flujo siempre muestra el selector de cuenta, para que el dueño pueda elegir su cuenta personal si tiene varias abiertas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla de inicio del despliegue personal MUST ofrecer la opción "Continuar con Google" junto al formulario de correo y contraseña existente, que se conserva sin cambios como método de respaldo.
- **FR-002**: Al elegir "Continuar con Google", el sistema MUST llevar al usuario al selector de cuentas de Google y, al volver, MUST completar el inicio de sesión usando un flujo de autorización resistente a la interceptación del código (prueba de posesión del cliente).
- **FR-003**: La identidad de Google cuyo correo verificado coincide con el de la cuenta existente del dueño MUST asociarse a esa misma cuenta, de modo que el dueño ve exactamente los mismos datos con cualquiera de los dos métodos.
- **FR-004**: El sistema MUST NOT crear cuentas nuevas a través de Google; un intento con una cuenta de Google no asociada al dueño MUST rechazarse sin dejar ningún usuario creado.
- **FR-005**: Tras un inicio de sesión con Google exitoso, el sistema MUST llevar al usuario siempre al dashboard de la propia app, e MUST ignorar cualquier destino indicado en la URL de retorno.
- **FR-006**: Ante cualquier fallo del flujo (cuenta no autorizada, cancelación, código ausente, inválido o caducado, error del proveedor o de la base de datos), el sistema MUST volver a la pantalla de inicio sin sesión y mostrar un mensaje comprensible que distinga al menos "cuenta no autorizada" de "error genérico, inténtalo de nuevo"; MUST NOT mostrar detalles técnicos.
- **FR-007**: El botón y todos los mensajes de esta feature MUST estar disponibles en inglés y español y respetar el idioma activo.
- **FR-008**: Una sesión iniciada con Google MUST comportarse igual que una de contraseña: persiste entre recargas, protege las mismas páginas y se cierra con el mismo botón de cerrar sesión.
- **FR-009**: En el despliegue de demo, la opción de Google MUST NOT mostrarse y la ruta de retorno MUST redirigir a la demo sin contactar al backend ni incluir su código en el bundle.
- **FR-010**: El secreto del cliente de Google MUST residir únicamente en la configuración del proveedor de autenticación; MUST NOT aparecer en el repositorio, en las variables del hosting ni en el código que se envía al navegador.
- **FR-011**: La configuración externa necesaria (registro de la app en Google con el dueño como único usuario de prueba, activación del proveedor y URLs de retorno permitidas para producción y desarrollo local) MUST quedar documentada paso a paso en la guía de despliegue.
- **FR-012**: El botón de Google MUST ser accesible: operable con teclado, con nombre accesible, y los mensajes de error MUST anunciarse a lectores de pantalla.

### Key Entities

- **Identidad de Google del dueño**: método de acceso adicional asociado a la cuenta existente del dueño; comparte el mismo identificador de usuario y, por tanto, los mismos datos. No crea registros financieros nuevos.
- **Error de inicio de sesión con Google**: resultado de un flujo fallido que la pantalla de inicio traduce a un mensaje; tipos mínimos: "cuenta no autorizada" y "error genérico".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño pasa de la pantalla de inicio a ver sus saldos en el dashboard con Google en menos de 15 segundos y con no más de 3 clics, sin teclear nada.
- **SC-002**: El 100 % de los intentos con cuentas de Google distintas a la del dueño terminan sin sesión, con el mensaje de "cuenta no autorizada" y con cero cuentas nuevas creadas.
- **SC-003**: Tras entrar con Google, el dueño ve el 100 % de los mismos datos (cuentas, movimientos, saldos) que tras entrar con contraseña.
- **SC-004**: El 100 % de los intentos de redirigir a un destino externo desde la ruta de retorno terminan dentro de la propia app.
- **SC-005**: La demo pública no muestra la opción de Google y su verificación de aislamiento sigue pasando sin hallazgos.
- **SC-006**: Ningún texto de esta feature aparece sin traducir en ninguno de los dos idiomas.

## Assumptions

- La app personal tiene un único usuario (el dueño), creado desde el panel del proveedor de autenticación, con correo confirmado igual a su cuenta personal de Google; esto se verificó el 2026-11-03.
- El registro de usuarios permanece desactivado en el proveedor de autenticación, y el proveedor asocia automáticamente una identidad externa a la cuenta existente cuyo correo verificado coincide, sin considerarlo un registro nuevo. Se valida con una prueba manual antes de implementar; si no se cumpliera, el plan alternativo es que el dueño asocie su cuenta de Google manualmente desde Configuración con la sesión de contraseña iniciada.
- La app de Google se mantiene en modo de prueba con el dueño como único usuario de prueba: es una barrera adicional y evita el proceso de verificación de Google; solo se piden los permisos básicos de identidad (correo y perfil).
- El dueño realiza la configuración en las consolas de Google y del proveedor de autenticación, porque requiere sus credenciales; la feature entrega la guía y el código.
- No se automatiza en las pruebas de extremo a extremo el paso por la pantalla real de Google (requiere credenciales reales); se cubren el botón, la ruta de retorno y los mensajes de error, y el flujo completo se verifica manualmente en producción.
- Fuera de alcance: otros proveedores (Apple, GitHub…), Google One Tap, desactivar el inicio de sesión con contraseña, y cualquier uso de datos de Google más allá de identificar al dueño.
