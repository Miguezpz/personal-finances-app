# Personal Finances App - Especificación de Proyecto (Spec-Driven Development)

## 1. Naturaleza del Proyecto
Desarrollar una aplicación web de uso personal para el seguimiento centralizado de finanzas, diseñada para minimizar la fricción en el registro diario y automatizar la distribución de la riqueza mediante reglas configurables. El objetivo es que la herramienta funcione como un gestor patrimonial que automatice el flujo de caja, controle la deuda y proyecte el crecimiento financiero.

### 1.1 Objetivo Dual (Uso Personal y Portafolio Profesional)
Además de su utilidad personal, el proyecto está concebido como una pieza clave de portafolio público en GitHub y LinkedIn para demostrar habilidades avanzadas de arquitectura de software, uso de Inteligencia Artificial (Claude Code) en el ciclo de desarrollo, y la capacidad de resolver problemas de infraestructura con recursos gratuitos (Zero-Cost Architecture).

*   **Nombre del Repositorio en GitHub:** `personal-finances-app`
*   **Despliegue de Producción (Uso Privado):** `miguezpz-personal-finances.vercel.app`
*   **Despliegue de Demostración (Portafolio / Reclutadores):** `personal-finances-demo.vercel.app`

## 2. Stack Tecnológico y Entorno de Desarrollo (Zero-Cost Architecture)
El proyecto está diseñado para ser alojado y operado de manera 100% gratuita utilizando tecnologías modernas, reactivas y de código abierto.

*   **Lenguaje Core:** TypeScript. Obligatorio para garantizar tipado estricto y prevenir errores matemáticos en el manejo de capital.
*   **Frontend y Enrutamiento:** Next.js (App Router) alojado gratuitamente en Vercel.
*   **Manejo de Estado, Caché e Internacionalización:**
    *   *TanStack Query (React Query):* Para la comunicación con la base de datos y la obtención de datos de APIs externas (tipos de cambio).
    *   *Zustand:* Para el estado global ligero (ej. control del Modo Privacidad, idioma actual y divisa seleccionada).
    *   *Librería i18n (ej. next-intl):* Para el manejo de diccionarios de traducción (Inglés/Español).
*   **Ecosistema UI/UX:** Tailwind CSS como motor de estilos, shadcn/ui para componentes accesibles, Framer Motion para animaciones y Lucide React para iconografía.
*   **Backend y Autenticación:** Supabase (PostgreSQL) usando el Plan Gratuito, implementando *Row Level Security (RLS)*.
*   **Integración de APIs de Terceros:** Consumo de una API pública y gratuita (ej. ExchangeRate-API, Frankfurter o Banxico) para tipos de cambio en tiempo real.
*   **Asistencia de IA en Diseño (Claude Code Skills):** 
    *   `ui-ux-pro-max`: Motor de construcción principal para garantizar una interfaz profesional y estructurada.
    *   `impeccable`: Auditor visual y de calidad (QA) para refinar contrastes y alinear elementos.

### 2.1 Adaptaciones al Plan Gratuito (Supabase & Vercel)
Para garantizar la viabilidad sin costo de mantenimiento:
*   **Evaluación del lado del cliente:** Las notificaciones de fechas de pago, cuentas por cobrar, automatización de gastos fijos y cálculos de conversión de divisas se ejecutan en el navegador, descartando el uso de *Cron Jobs*.
*   **Datos puramente relacionales:** El registro de transacciones será exclusivamente en texto y números; no se habilitará la subida de imágenes para preservar el límite de 1 GB de almacenamiento de Supabase.
*   **Respaldo Manual Obligatorio:** La aplicación incluye un botón de "Exportar Datos" que descarga todo el historial en un archivo CSV o Excel.
*   **Tolerancia al "Cold Start":** Manejo de estados de carga resilientes ante el reposo de la base de datos tras periodos de inactividad.

### 2.2 Estrategia de Repositorio Público, Seguridad y Mocking
Para mantener el código abierto sin comprometer la privacidad financiera del desarrollador ni agotar los slots de proyectos gratuitos en Supabase:
*   **Aislamiento de Secretos:** Todas las credenciales vivirán estrictamente en variables de entorno (`.env`) ignoradas por el control de versiones.
*   **Estrategia de Mock Data en Frontend:** Un único código base servirá tanto para la app personal como para la demo pública. Mediante una variable de entorno (`NEXT_PUBLIC_DEMO_MODE=true`), la instancia pública ignorará las llamadas a Supabase y se alimentará de un *Mock Data Provider* con información ficticia pero verosímil.

## 3. Funcionalidades Core (Requerimientos del Sistema)

### 3.1 Internacionalización y Preferencias de Visualización (i18n)
*   **Idioma por Defecto:** La interfaz de la aplicación estará en Inglés (EN) de manera predeterminada para alinearse con estándares de software internacionales y portafolios técnicos.
*   **Toggle de Idioma:** Un interruptor global en el menú de navegación permitirá al usuario cambiar instantáneamente toda la interfaz a Español (ES).

### 3.2 Multi-divisa y Tipos de Cambio en Tiempo Real
*   **Moneda Base (Single Source of Truth):** Todas las transacciones, ingresos y bases de datos se registran y almacenan estrictamente en Pesos Mexicanos (MXN).
*   **Conversor Dinámico API:** Al cargar la aplicación, el cliente consultará una API pública oficial para obtener la paridad cambiaria actual del Peso Mexicano frente al Dólar Estadounidense (USD) y el Euro (EUR).
*   **Visualización Equivalente:** Un control en el Dashboard permitirá al usuario cambiar la divisa de visualización. Al seleccionar USD o EUR, la app calculará matemáticamente en el frontend el equivalente de su Patrimonio Neto (Net Worth), saldos y gráficas sin alterar los datos originales en MXN.

### 3.3 Panel de Configuración Global y Reglas de Distribución
*   **Gestión de Porcentajes:** Vista de configuración donde el usuario asigne qué porcentaje de sus ingresos fijos se destinará a Inversiones, Gastos Necesarios (Needs) y Gustos (Wants).
*   **Mapeo de Categorías:** Capacidad de crear subcategorías de gasto personalizadas y vincularlas a una Categoría Padre.
*   **Catálogo de Cuentas y Tarjetas:** Menú para dar de alta tarjetas, cuentas o plataformas de inversión con sus respectivas fechas de corte y tipos de instrumento.

### 3.4 Motor de Ingresos Inteligente (Splitter Automático)
*   **Distribución por Reglas:** Al registrar una entrada de capital recurrente, el sistema fragmenta automáticamente el monto en los rubros base según la configuración.
*   **Sub-reglas de Inversión:** El capital destinado a inversión se subdivide entre diferentes vehículos (ej. 90% a Bolsa, 10% a Sofipos).

### 3.5 Automatización de Gastos Fijos y Recurrentes
*   **Registro de Suscripciones y Servicios:** Capacidad de establecer pagos fijos (ej. Renta, Internet, Netflix, Gimnasio) indicando monto, fecha de cargo mensual y categoría asignada.
*   **Deducción Programada:** El sistema identifica estos cargos y los deduce automáticamente de las bolsas correspondientes (Needs o Wants) en la quincena pertinente, eliminando la necesidad de registrarlos manualmente cada mes.

### 3.6 Registro Transaccional de Gastos con Auto-clasificación
*   **Captura Ágil:** Formulario para asentar salidas de dinero eventuales capturando monto, fecha, subcategoría y método de pago.
*   **Herencia Relacional:** Al elegir la subcategoría específica, la aplicación hereda automáticamente la "Categoría Macro" (Needs/Wants).

### 3.7 Semáforo de Presupuesto Quincenal (Safe-to-Spend)
*   **Dashboard de Liquidez en Tiempo Real:** Un panel principal que muestra exactamente cuánto dinero queda disponible para gastar en la quincena actual, dividido en "Needs" y "Wants".
*   **Cálculo Dinámico:** La app toma el monto asignado originalmente por el Motor de Ingresos para la quincena en curso y le resta automáticamente tanto los gastos fijos pre-programados como las transacciones manuales registradas, mostrando un saldo real y actualizado hasta el próximo día de pago.

### 3.8 Gestión Estratégica del Crédito
*   **Cronograma Visual:** Línea de tiempo que cruza días de pago del salario con fechas límite de liquidación de tarjetas.
*   **Modo "Totalero" por Defecto:** La app calcula y destaca exclusivamente el "Pago para no generar intereses", desincentivando el pago mínimo.

### 3.9 Construcción de Patrimonio y Metas (Net Worth)
*   **Fondo de Emergencia:** Meta visual dedicada a construir meses de supervivencia basados en el historial de gastos vitales.
*   **Sistema de "Apartados" (Sinking Funds):** Sub-metas para gastos fuertes anuales (ej. predial, seguro) reteniendo mensualmente una fracción del presupuesto.
*   **Gráfica de Patrimonio Neto:** Visualización histórica que resta las deudas totales del capital y activos acumulados.

### 3.10 Módulo de Cuentas por Cobrar (Compras a Terceros / MSI)
*   **Registro de Préstamos:** Permite registrar compras a MSI hechas para terceros, seleccionando monto, plazo, deudor y tarjeta utilizada.
*   **Aislamiento de Estadísticas:** Estos cargos se etiquetan fuera de los gastos personales para no alterar las métricas de consumo.
*   **Dashboard de Cobros:** Genera un calendario de pagos para el deudor que se anticipa a la fecha de corte de la tarjeta utilizada, notificando en el cliente cuándo cobrar.

### 3.11 Modo Privacidad (Anti-Shoulder Surfing)
*   **Interruptor Global (Zustand State):** Control accesible en toda la app para alternar la visibilidad de los datos financieros.
*   **Enmascaramiento de Datos:** Difumina (efecto blur de Tailwind) o reemplaza todas las cantidades monetarias, saldos y ejes de gráficas para permitir el uso seguro en lugares públicos.

### 3.12 Historial y Auditoría
*   **Bitácora General:** Listado completo, filtrable y exportable (CSV) de todos los movimientos y flujos de caja.

### 3.13 Modo Showcase (Acceso para Reclutadores)
*   **Acceso Directo (Live Demo):** La pantalla de inicio incluirá un botón visible de "Explorar Demo / Reclutadores".
*   **Navegación Interactiva sin Mutación:** La sesión demo consumirá el *Mock Data Provider*, permitiendo interactuar con los dashboards y filtros. Al intentar registrar o eliminar registros, se emitirán notificaciones contextuales (*Toasts*) indicando que la demo opera en modo de solo lectura.