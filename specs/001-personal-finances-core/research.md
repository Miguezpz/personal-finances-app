# Research: Personal Finances Core

**Feature**: 001-personal-finances-core | **Date**: 2026-10-31

Resuelve las incógnitas del Technical Context y fija las decisiones de diseño. Formato: Decisión / Rationale / Alternativas.

## R1. Representación del dinero y porcentajes

- **Decisión**: montos como **enteros en centavos de MXN** (`bigint` en PostgreSQL, `Cents` con marca de tipo en TS) y porcentajes como **puntos base** enteros (`0–10000`).
  Reparto con el método de **mayor residuo**: se calcula `floor(monto × bps / 10000)` por bolsa y el residuo (0 a n−1 centavos) va a la bolsa de mayor porcentaje (empate: Needs > Wants > Inversión).
- **Rationale**: elimina errores de punto flotante (Principio II) y cumple SC-001 (suma exacta). Un `number` de JS representa enteros exactos hasta 2^53 centavos ≈ $90 billones MXN.
- **Alternativas**: `decimal.js`/`numeric` (más pesado, innecesario con enteros); `float` (rechazado por la constitución).

## R2. Definición de quincena y zona horaria

- **Decisión**: periodos fijos: **P1 = días 1–15, P2 = día 16–fin de mes**; `PeriodKey = "YYYY-MM-1" | "YYYY-MM-2"`. "Hoy" se calcula en la zona
  horaria del usuario (`user_settings.timezone`, por defecto `America/Mexico_City`) y las fechas se guardan como `date` sin hora.
- **Rationale**: evita ambigüedades de cambio de día por UTC (un gasto a las 22:00 en México no debe caer al día siguiente).
- **Alternativas**: periodos basados en `timestamptz` (rechazado: introduce desfases); días de pago configurables como límites del periodo (rechazado en v1; solo se usan para mostrar "días al próximo pago", FR-019).

## R3. Quincena que financia un ingreso (aclaración 3)

- **Decisión**: por defecto, el ingreso financia la **primera quincena cuyo inicio es estrictamente posterior a `received_on`** (día 15 → P2 del mismo mes; último día → P1 del mes siguiente).
  El usuario puede sobrescribir la quincena al registrar. Se guarda `funded_period_start` en el ingreso (instantánea).
- **Rationale**: respeta la aclaración sin perder flexibilidad para ingresos tempranos o tardíos; guardar la instantánea evita que cambios futuros reescriban el historial.
- **Alternativas**: derivarlo siempre de la fecha (menos flexible); selección obligatoria (más fricción).

## R4. Arrastre de saldos y Safe-to-Spend (aclaraciones 1, 2, 4)

- **Decisión**: el saldo arrastrado **se deriva** (no se persiste): `closing(p) = carry(p) + asignado(p) − fijos aplicados(p) − manuales(p) − aportaciones(p)`, `carry(p+1) = closing(p)`, por bolsa Needs y Wants,
  desde la primera quincena con datos. En la quincena actual se resta además `fijos pendientes` (virtuales) para obtener el Safe-to-Spend. Las compras con tarjeta se descuentan en la fecha de compra; los pagos de tarjeta no tocan bolsas.
- **Rationale**: derivar hace que editar/eliminar un movimiento pasado recalcule la cadena sin migraciones ni inconsistencias (FR-016a). El costo es O(n) sobre ≈ 120 quincenas en 5 años, despreciable.
- **Alternativas**: persistir cierres de quincena (más rápido pero propenso a quedar desfasado); cron de cierre (viola Zero-Cost).
- **Semáforo**: base = `asignado + max(carryIn, 0)`. `ratio = disponible / base`. Verde ≥ `green_min_bps` (50%), amarillo ≥ `yellow_min_bps` (20%), rojo en otro caso o si `disponible < 0`.
  Si `base ≤ 0`: rojo si `disponible < 0`, "neutral" (gris) si `disponible = 0` (evita división entre cero).

## R5. Gastos fijos: materialización idempotente (FR-008/010)

- **Decisión**: al cargar datos, el cliente calcula `dueOccurrences(recurring, appliedKeys, today)` (cargos con `occurrence_date ≤ hoy` sin fila aplicada) y los inserta por lote como `expenses` con `origin='recurring'`.
  Unicidad `(recurring_expense_id, occurrence_date)` con `INSERT ... ON CONFLICT DO NOTHING`. Los de la quincena actual con fecha futura se muestran como **pendientes derivados**.
- **Rationale**: sin cron (Zero-Cost); seguro con varias pestañas o reintentos; el historial queda como instantánea (FR-011).
- **Alternativas**: pg_cron (disponible pero fuera del espíritu del Principio I y no aplicable al demo); Edge Functions programadas (rechazado).
- **Día inexistente**: `clampChargeDay(year, month, day)` usa el último día del mes. **Edición**: cambios de monto/día aplican a ocurrencias no materializadas; las materializadas no se tocan. Pausar/terminar fija `ended_on`.

## R6. Supabase: autenticación, RLS e integridad

- **Decisión**: Auth con **email + contraseña**, `enable_signup = false` (el único usuario se crea desde el panel). Todas las tablas: `user_id uuid default auth.uid()`, RLS con política única `FOR ALL TO authenticated USING/WITH CHECK (user_id = (select auth.uid()))`,
  `REVOKE ALL FROM anon`. Claves foráneas compuestas `(user_id, id)`. Invariantes con `CHECK` y triggers diferidos (suma de asignaciones = ingreso; suma de mensualidades = total; sub-reglas = 100%).
  RPC `SECURITY INVOKER` para escrituras multi-tabla.
- **Rationale**: el repositorio es público; el control de acceso debe depender de RLS y no de secretos (Principio III). `(select auth.uid())` permite que el planificador cachee la llamada.
- **Alternativas**: magic link/OAuth (más superficie y dependencias); `SECURITY DEFINER` (evita RLS, rechazado); service role en servidor (prohibido).

## R7. Mock Data Provider (Principio IV)

- **Decisión**: interfaz `DataProvider` con repositorios por agregado. Fábrica en `src/data/index.ts` con `import()` dinámico condicionado por `process.env.NEXT_PUBLIC_DEMO_MODE`, que Next inlinea en build, eliminando la rama no usada del bundle.
  `MockProvider`: almacén en memoria sembrado de forma **determinista y relativa a "hoy"** (siempre muestra el mes actual y 5 anteriores); lecturas reales sobre el almacén; **toda escritura lanza `DemoReadOnlyError`**.
  Un `MutationCache.onError` global muestra el toast de solo lectura; la UI no necesita ramas `if (demo)`.
- **Rationale**: los componentes no saben qué proveedor está activo; el demo prueba el mismo código que producción. Una suite de contrato asegura paridad de comportamiento en lecturas.
- **Capacidades (no tipo de proveedor)**: `DataProvider.capabilities.canWrite` (`false` en Mock). Los procesos automáticos en segundo plano (materializar fijos, aportaciones a metas, instantánea de patrimonio, onboarding) comprueban `canWrite` y no hacen nada ni muestran avisos cuando es `false` (FR-047a). Las acciones del usuario siguen intentando escribir y reciben `DemoReadOnlyError` → toast. `mode` queda solo como dato informativo (p. ej. `DemoBanner`). El FX no ramifica por demo: la demo consulta la misma API pública (sin datos del usuario, Principio V).
- **Alternativas**: MSW (intercepta red, pero el demo seguiría importando el cliente Supabase); bandera `isDemo` dispersa en la UI (frágil).
- **Garantías verificables**: regla ESLint `no-restricted-imports` para `@supabase/*` fuera de `src/data/supabase/`; E2E que falla ante cualquier petición a `*.supabase.co`; inspección del bundle demo (sin la cadena `supabase`).

## R8. Estado: Zustand y TanStack Query

- **Decisión**: **Zustand** guarda preferencias (`locale`, `displayCurrency`, `privacyMode`) con `persist` en `localStorage` (`pfa:prefs:v1`) y `skipHydration` + rehidratación manual para evitar desajustes SSR/cliente; **estado seguro por defecto**: hasta hidratar, la privacidad se trata como **activa** en producción (no parpadean importes).
  Efectos secundarios (atributo `data-privacy`, `lang`, cookie de idioma) en un componente `PreferencesEffects`, no dentro del store. **TanStack Query** guarda todo dato del servidor y las tasas de cambio.
- **Rationale**: separa estado de cliente (Zustand) y de servidor (Query) como pide la constitución; el enmascarado vía atributo CSS cubre incluso componentes de terceros.
- **Alternativas**: Context (re-renders amplios); guardar preferencias en BD (requiere red para algo de dispositivo y no aplica al demo).

## R9. Privacidad de la interfaz

- **Decisión**: único componente `<Money cents currency?>`; rinde `<span class="money" data-masked>`; con `html[data-privacy="on"]` se aplica `filter: blur` y el texto accesible se sustituye por "••••". Para gráficas, los `tickFormatter` y tooltips usan `useMoneyFormatter()` que devuelve "••••" cuando está activa.
  ESLint prohíbe `Intl.NumberFormat` con `style:"currency"` fuera de `src/i18n/format.ts`.
- **Rationale**: un solo punto de render hace verificable "ningún importe legible" (SC-011) con una prueba E2E que recorre todas las rutas.
- **Alternativas**: blur por clase manual en cada vista (propenso a omisiones).

## R10. i18n sin enrutamiento por prefijo

- **Decisión**: **next-intl sin rutas `/en` `/es`**: ambos diccionarios (≈ pocos KB) se cargan en el cliente y el locale proviene de Zustand; una cookie `NEXT_LOCALE` permite que el HTML inicial salga ya en el idioma elegido. EN por defecto.
  Prueba unitaria de paridad de claves EN/ES y regla ESLint contra textos literales en JSX. Formato con `Intl` según locale (`en-US`/`es-MX`).
- **Rationale**: el cambio debe ser instantáneo y sin perder el estado de formularios (FR-039); sin SEO público que justifique rutas por idioma.
- **Alternativas**: segmento `[locale]` (recarga de árbol y pérdida de estado); i18next (más configuración).

## R11. Tipos de cambio

- **Decisión**: **Frankfurter** (tasas de referencia del BCE; sin clave; MXN/USD/EUR soportados) como fuente primaria y `open.er-api.com` como alternativa; validar CORS y cuotas al implementar.
  `useFxRates()` consulta una vez por carga con `staleTime` largo y reintentos; guarda la última tasa válida en `localStorage` con su fecha. Rechaza tasas ≤ 0 o con variación > 20% vs la última conocida. `convert()` redondea half-up a centavos y es solo de presentación.
- **Decisión**: estas fuentes publican **tasas diarias**, no ticks en vivo; el spec (FR-033) se ajustó a "vigente" = la tasa más reciente publicada. La UI muestra siempre tasa y fecha/hora (FR-035). Si no se puede obtener, se aplica la degradación a MXN.
- **Alternativas**: Banxico SIE (requiere token); ExchangeRate-API (plan gratuito con cuota mensual y clave).

## R12. Cold start y resiliencia

- **Decisión**: `QueryClient` con reintentos exponenciales (hasta 4) para errores de red/503/timeouts; si una consulta supera 3 s se muestra "Despertando la base de datos…" (skeletons + mensaje); sin conexión, la app muestra los datos en caché y desactiva escrituras con aviso.
- **Rationale**: Supabase Free pausa proyectos inactivos; el primer acceso puede tardar. (Principio I, FR-050).

## R13. Cuentas por cobrar y crédito

- **Decisión**: tarjeta con `cut_off_day` y `payment_due_offset_days` (días después del corte). Para cada mensualidad `k` (1..N): `card_due_on` = fecha límite de pago del estado en que cae el cargo `k` (primer estado posterior a la compra + k−1 meses) y `due_on` (cobro al deudor) = `card_due_on − collection_lead_days` (por defecto 3, configurable).
  Mensualidades iguales; el residuo de centavos va a la última. Estado: `pending → partial → collected`. "Pago para no generar intereses" = cargos con fecha ≤ último corte − pagos posteriores a ese corte.
- **Rationale**: cumple FR-023/024 y la aclaración 5 (los cobros no tocan bolsas). El `statementBalance` puro es testeable con fechas fijas.
- **Pago "totalero" con MSI (corrección 2026-11-01)**: el MSI no genera intereses y la tarjeta cobra solo la mensualidad de cada estado de cuenta. Por eso `payToAvoidInterest` incluye únicamente las mensualidades con `card_due_on = próximo límite de pago`, mientras que `totalDebt` sí incluye el saldo completo del MSI.
- **Alertas de cobro**: ventana fija de 7 días (`COLLECTION_ALERT_WINDOW_DAYS`), sin configuración (más simple y suficiente).

## R14. Metas y patrimonio neto

- **Decisión**: `goals` (`emergency_fund` | `sinking_fund`) con `source_bucket` configurable (por defecto: apartado → `needs`, fondo de emergencia → `investment`); aportaciones idempotentes `(goal_id, period_start)` generadas con el mismo mecanismo que los fijos.
  Patrimonio neto = saldos de cuentas (saldo inicial + movimientos) + inversiones acumuladas + por cobrar − deuda de tarjetas; se **instantanea una vez al mes** (`net_worth_snapshots`, único por mes) al abrir la app para la gráfica histórica.
- **Resuelto (criterio simple, 2026-11-01)**: gastos vitales = promedio mensual de gastos aplicados en Needs de los últimos 3 meses completos; origen de fondos por defecto: apartados → Needs, fondo de emergencia → Inversión (editable por meta). Patrimonio neto = saldos iniciales (cuentas que no son tarjeta) + inversión acumulada + aportaciones desde Needs/Wants + por cobrar a terceros + saldo disponible de Needs/Wants − deuda total de tarjetas (fórmulas en `data-model.md`). Un saldo inicial por cuenta se captura al crearla (`opening_balance_cents`).

## R15. Exportación y pruebas

- **Decisión**: CSV generado en el navegador desde `DataProvider.exportAll()` (UTF-8 con BOM para Excel, escape RFC 4180, montos en MXN con dos decimales). Pruebas: Vitest + fast-check (propiedades: suma exacta, residuos, idempotencia de fijos), contrato del provider, pgTAP para RLS/invariantes, Playwright para flujos P1 y demo.
- **Rationale**: cubre FR-043 y la regla de la constitución de probar la lógica financiera antes de darla por completa.

## R17. Una sola fuente de verdad en caché: `useFinanceSnapshot`

- **Decisión**: todo dato de dominio vive en **una sola query** de TanStack Query, `useFinanceSnapshot()` (`DataProvider.loadSnapshot()`), con clave `queryKeys.snapshot`. Los hooks de lectura por agregado (`useIncomes`, `useExpenses`, `useRecurring`…) son **selectores** (`select`) sobre esa query, no consultas separadas.
  Las mutaciones usan un helper único `updateSnapshot(queryClient, updater)` (`src/data/snapshot-cache.ts`) para la actualización optimista (`onMutate`), revierten en `onError` y reconcilian con `invalidateQueries(snapshot)` en `onSettled`.
- **Rationale**: Safe-to-Spend, bitácora, patrimonio y exportación leen la misma foto coherente; evita que dos claves de caché diverjan y garantiza SC-004 (saldo actualizado al instante). Con ≈ 10 mil filas en 5 años una sola carga es suficiente (Zero-Cost: sin paginación ni servidor).
- **Alternativas**: queries por recurso con invalidaciones cruzadas (más peticiones, riesgo de estados inconsistentes); store global propio (duplica TanStack Query).

## R16. Herramientas y despliegue

- **Decisión**: pnpm; CI en GitHub Actions (gratis para repos públicos); Vercel Hobby con dos proyectos del mismo repo (`NEXT_PUBLIC_DEMO_MODE` distinto); Supabase CLI local (Docker) para migraciones y pruebas; tipos con `supabase gen types`.
  En la app personal, el botón "Explorar Demo" enlaza a `NEXT_PUBLIC_DEMO_URL`; en la demo, entra directo al dashboard.
- **Nota**: el middleware se llama `proxy.ts` desde Next 16; usar el nombre que corresponda a la versión fijada.
