# Personal Finances App Constitution

## Core Principles

### I. Arquitectura Zero-Cost (NON-NEGOTIABLE)
El proyecto MUST poder alojarse y operarse a costo cero recurrente, usando exclusivamente los
planes gratuitos de Vercel y Supabase y APIs públicas gratuitas.

- MUST NOT introducir servicios, dependencias o infraestructura de pago, ni Cron Jobs, colas o
  funciones programadas en servidor.
- Las notificaciones de fechas de pago, cuentas por cobrar, automatización de gastos fijos y
  conversiones de divisa MUST evaluarse del lado del cliente.
- Los datos MUST ser puramente relacionales (texto y números). MUST NOT habilitarse la subida de
  imágenes ni archivos, para respetar el límite de 1 GB de almacenamiento de Supabase.
- La app MUST incluir una función "Exportar Datos" (CSV o Excel) del historial completo como
  respaldo manual.
- La UI MUST manejar con resiliencia el "cold start" de la base de datos (estados de carga y
  reintentos) tras periodos de inactividad.

Rationale: el proyecto es de uso personal y de portafolio; la viabilidad sin costo de
mantenimiento es un requisito de diseño, no una optimización.

### II. Next.js App Router con TypeScript Estricto
Todo el código MUST escribirse en TypeScript con `strict: true` y desplegarse con Next.js
(App Router) en Vercel.

- MUST NOT usarse `any` implícito o explícito, ni `@ts-ignore` / `@ts-expect-error` sin
  justificación documentada en el código.
- Los montos monetarios y las operaciones financieras MUST tiparse explícitamente y
  centralizarse en módulos de utilidades puros y testeables; MUST NOT usarse aritmética
  de punto flotante ingenua para redondear o repartir capital (el reparto de porcentajes MUST
  conservar el total exacto).
- El estado MUST gestionarse con TanStack Query (datos de servidor y APIs externas) y Zustand
  (estado global ligero: modo privacidad, idioma, divisa).
- La UI MUST construirse con Tailwind CSS, shadcn/ui, Framer Motion y Lucide React.

Rationale: el tipado estricto previene errores matemáticos en el manejo de capital.

### III. Supabase PostgreSQL con Row Level Security
Supabase (PostgreSQL, plan gratuito) es el único backend y proveedor de autenticación.

- Toda tabla con datos de usuario MUST tener RLS habilitado y políticas que restrinjan acceso
  al propietario (`auth.uid()`); MUST NOT existir tablas expuestas sin RLS.
- Los cambios de esquema MUST realizarse mediante migraciones versionadas en el repositorio.
- MUST NOT usarse la `service_role` key en código cliente ni exponerse en variables
  `NEXT_PUBLIC_*`.
- Toda credencial MUST vivir en variables de entorno (`.env*`) ignoradas por el control de
  versiones; MUST NOT commitearse secretos.

Rationale: el repositorio es público; la seguridad MUST depender de RLS y no del secreto del
código.

### IV. Aislamiento del Demo mediante Mock Data Provider
Un único código base MUST servir tanto la app personal como la demo pública.

- Cuando `NEXT_PUBLIC_DEMO_MODE=true`, la aplicación MUST NOT realizar ninguna llamada a
  Supabase y MUST alimentarse de un Mock Data Provider con datos ficticios pero verosímiles.
- El acceso a datos MUST pasar por una capa de abstracción única (proveedor real vs. mock);
  los componentes de UI MUST NOT conocer qué proveedor está activo.
- En modo demo toda mutación (crear, editar, eliminar) MUST bloquearse y notificar al usuario
  mediante un Toast contextual de "solo lectura".
- Los datos mock MUST NOT contener información financiera real del propietario.

Rationale: protege la privacidad del desarrollador y evita consumir proyectos del plan gratuito
de Supabase con la demo pública.

### V. Privacidad y Cálculos del Lado del Cliente
La privacidad financiera MUST ser una propiedad de primera clase de la interfaz y la
arquitectura.

- El Modo Privacidad (estado global en Zustand) MUST enmascarar (blur o reemplazo) toda
  cantidad monetaria, saldo y eje de gráfica, en todas las vistas sin excepción.
- Los cálculos derivados (Safe-to-Spend, distribución por reglas, conversión de divisa,
  patrimonio neto, gastos fijos recurrentes) MUST ejecutarse en el cliente a partir de los
  datos almacenados.
- Los datos financieros MUST NOT enviarse a servicios de terceros; las únicas llamadas
  externas permitidas son consultas de tipos de cambio que no incluyan datos del usuario.
- MUST NOT incluirse analítica, telemetría o logging que contenga montos o datos personales.

Rationale: permite uso seguro en lugares públicos y mantiene el control de los datos
exclusivamente en manos del usuario.

### VI. Internacionalización y Soporte Multi-Divisa
La app MUST ser bilingüe y multi-divisa desde su diseño.

- El idioma por defecto MUST ser inglés (EN), con alternancia global a español (ES); todo
  texto visible MUST provenir de diccionarios de traducción (p. ej. next-intl) y MUST NOT
  estar hardcodeado en componentes.
- Todo monto MUST almacenarse y registrarse únicamente en MXN, que es la fuente única de
  verdad; MUST NOT persistirse montos convertidos.
- La conversión a USD y EUR MUST realizarse solo en el frontend, para visualización, con
  tipos de cambio obtenidos de una API pública gratuita vía TanStack Query, sin alterar los
  datos originales.
- Si la API de tipos de cambio no está disponible, la app MUST degradar con elegancia
  (mostrar MXN y un aviso) sin bloquear el uso.
- El formato de números, divisas y fechas MUST respetar el idioma y la divisa seleccionados.

Rationale: el portafolio es internacional, pero los datos reales son en MXN; separar
almacenamiento y presentación evita inconsistencias.

## Restricciones Técnicas y de Seguridad

- Despliegues: producción privada (`miguezpz-personal-finances.vercel.app`) y demo pública
  (`personal-finances-demo.vercel.app`), ambas desde el mismo repositorio `personal-finances-app`.
- Los cambios MUST NOT introducir dependencias de pago ni bloquear el despliegue en Vercel
  y Supabase Free.
- Las APIs de terceros MUST ser públicas y gratuitas (p. ej. ExchangeRate-API, Frankfurter,
  Banxico).
- La accesibilidad MUST contemplarse mediante componentes accesibles (shadcn/ui) y contraste
  adecuado, auditado con las skills de diseño `ui-ux-pro-max` e `impeccable`.

## Flujo de Desarrollo y Calidad

- El desarrollo MUST seguir Spec-Driven Development: especificación → plan → tareas →
  implementación, con los artefactos de Spec Kit.
- La lógica financiera (reparto, Safe-to-Spend, conversión, recurrentes) MUST tener pruebas
  automatizadas antes de considerarse completa.
- Todo cambio MUST pasar type-check y lint sin errores antes de integrarse.
- Toda funcionalidad nueva MUST verificarse en modo normal y en modo demo, y en ambos idiomas.
- Las desviaciones de estos principios MUST justificarse por escrito en el plan de la
  funcionalidad (sección de complejidad / constitution check).

## Governance

Esta constitución prevalece sobre cualquier otra práctica del proyecto. Los principios I–VI son
inmutables en su intención; solo pueden enmendarse mediante el procedimiento siguiente.

- **Enmiendas**: MUST documentarse en un cambio propio que incluya la justificación, el impacto
  en artefactos existentes (specs, planes, tareas) y un plan de migración si aplica.
- **Versionado** (semver): MAJOR para eliminación o redefinición incompatible de principios;
  MINOR para nuevos principios/secciones o ampliación material; PATCH para aclaraciones y
  correcciones de redacción.
- **Revisión de cumplimiento**: cada plan de funcionalidad MUST incluir una verificación
  contra estos principios, y cada PR/revisión MUST confirmar su cumplimiento. La complejidad
  añadida MUST justificarse.
- **Guía de desarrollo**: usar `project-resume.md` como referencia de requerimientos funcionales.

**Version**: 1.0.0 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-10-31
