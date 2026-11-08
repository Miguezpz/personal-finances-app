# Plan de mejora UX/UI — móvil y desktop

## Contexto

Revisé la app en código (shell, 11 features, sistema de motion) y en vivo (demo en 1440 px y 400 px). La base es sólida: tokens, sheets responsivos, optimistic updates, objetivos táctiles de 44 px y reduced-motion. Los problemas están en tres frentes:

1. **Arquitectura de navegación**
   - 10 destinos sin agrupar. En móvil, 6 de ellos (incluida Configuración) quedan en un panel lateral izquierdo que se abre desde la barra inferior y nunca se marca como activo.
   - Registrar un ingreso o pagar una tarjeta solo se puede desde su página.
   - El FAB tapa montos y se esconde al hacer scroll.
2. **Flujos con fricción**
   - Ningún formulario recuerda la última cuenta o categoría usada.
   - El diálogo se cierra antes de guardar, así que si falla se pierde lo que escribiste.
   - Fuera del Dashboard no hay estado de error: el skeleton se queda para siempre.
   - Solo los gastos rápidos se pueden deshacer.
   - Crédito es de solo lectura (no tiene botón de pagar).
   - Expenses y Crédito muestran "Pagar para no generar intereses" de estados de cuenta distintos: Gold Card aparece con $0.00 (vence 30 oct) en un lado y $13,190.50 (vence 30 nov) en el otro.
3. **Motion incompleto**
   - Las altas y bajas de filas no se animan.
   - El paso de skeleton a contenido es un corte seco.
   - No hay transición de salida entre rutas ni retroalimentación al guardar.

Decisiones tomadas:

- **Navegación:** barra con ＋ central.
- **Animaciones:** respetar spec 003 (solo CSS y View Transitions nativas, ≤300 ms, nunca animar montos, sin framer-motion fuera del indicador de nav).
- **Entrega:** un spec por fase, siguiendo speckit, en `main` y con commit + push por paso.

Numeración: el 006 está reservado (calendario de pago, pendiente) y el 007 ya existe, así que estos serán **008, 009 y 010**. Conviene correr 008 antes que 006, porque 006 no toca UI.

---

## Spec 008 — Navegación y consistencia del shell (P1)

### Nueva arquitectura de información (`src/components/layout/nav-items.ts`)

Los ítems pasan a tener `group` y se ordenan así:

| Grupo     | Ítems                             |
| --------- | --------------------------------- |
| Principal | Inicio, Gastos, Ingresos, Crédito |
| Planear   | Gastos fijos, Metas               |
| Deudas    | Por cobrar                        |
| Análisis  | Bitácora, Patrimonio              |
| Pie       | Configuración                     |

- **Sidebar desktop** (`AppShell.tsx` `NavLinks`): secciones con encabezado pequeño, Configuración fija al fondo y `max-h-[calc(100dvh-…)] overflow-y-auto` en el `nav` sticky, para que no se corte en pantallas bajas.
- **Barra móvil** (`MobileNav.tsx`): `Inicio · Gastos · (＋) · Crédito · Más`.
  - El ＋ central va elevado, con variante `cta`.
  - Se elimina el FAB flotante y con él `useFabHidden`.
  - "Más" queda activo (`aria-current`) cuando la ruta pertenece a un ítem secundario.
- **Panel "Más"**: pasa de `Sheet side="left"` a `side="bottom"`, con las secciones agrupadas (Ingresos va arriba, en "Principal") y el título "Más" en lugar del nombre de la app. Se reutilizan `Sheet` (`ui/sheet.tsx`) y `NavIndicator`.

### Hoja de creación "＋" (componente nuevo `src/components/layout/CreateSheet.tsx`)

- Tiene 3 acciones grandes: **Gasto**, **Ingreso** y **Pagar tarjeta**.
- Debajo van los chips de gastos rápidos (se reutiliza `QuickExpenseBar` en su variante `dialog`).
- Cada acción abre el diálogo existente en modo lazy (`LazyAddExpenseDialog`, `RegisterIncomeDialog`, `CardPaymentDialog`).
- Se monta una sola instancia de cada diálogo en el shell y se quitan los duplicados (hoy `ExpensesPage.tsx:261` y `MobileNav.tsx:162` montan dos).
- El estado de qué diálogo está abierto vive en el store `useUi` (zustand), para que cualquier página pueda abrir uno (por ejemplo "Pagar" desde Crédito).

### Desktop: acción global

- En la top bar va un botón **"＋ Nuevo"** (cta, con dropdown Gasto/Ingreso/Pagar tarjeta). Es el único CTA destacado por pantalla (FR-006).
- Los CTA de cada página pasan a `outline`, o se quitan si duplican la acción global (por ejemplo "Add expense" en Dashboard y Expenses).
- Atajos de teclado: `N` gasto, `I` ingreso, `P` pagar tarjeta. Se ignoran mientras el foco esté en un input, y se muestran en el dropdown.

### Consistencia de headers

- `PageHeader` en todas las páginas, incluidas `SettingsIndex.tsx` y `RulesSettings.tsx` (que no tienen icono).
- Rules usa `SettingsHeader`, para tener el enlace "‹ Configuración" que hoy le falta.
- Se renombra el sheet de la top bar de "Preferencias" a **"Apariencia"** (idioma, moneda, tema, salir) y se cambia su icono a `Palette` o `UserRound`, para no confundirlo con `/settings/preferences`.

### Fixes del shell

- `AppShell.tsx:150`: header con `pt-[env(safe-area-inset-top)]` y padding left/right con el inset.
- `AppShell.tsx:209`: `pb-[calc(5rem+…)]` solo bajo `md` (`md:pb-6`).
- Reordenar el Dashboard en móvil: las alertas (sobregiro, cobros) van **arriba**, compactas y tocables. Hoy `Dashboard.tsx:131` las manda al final con `max-md:order-last`.

### Unificar el estado de tarjetas

- Componente nuevo `CardStatementCard` (en `src/features/credit/`) que muestra:
  - el **último estado** (pagado ✓ / pendiente / vencido);
  - el **próximo estado** (monto y fecha);
  - el botón **Pagar**.
- Lo usan Crédito y Expenses. La lógica de selección del estado que hoy está en `CreditPage.tsx:60-66` se mueve a un helper compartido junto a `useCardStatuses`.
- En Expenses la sección de tarjetas se reduce a un resumen compacto con enlace a Crédito.

---

## Spec 009 — Flujos y formularios con menos fricción (P1–P2)

1. **Recordar lo último usado.** Slice nuevo en el store de preferencias (persistido) con `lastPaymentAccountId`, `lastSubcategoryId` y `lastDepositAccountId`.
   - Defaults en `AddExpenseDialog.tsx:86`, `RegisterIncomeDialog.tsx:93`, `CardPaymentDialog.tsx:64` y `RecurringForm.tsx:104-108`.
   - Si la cuenta guardada está archivada, se ignora.
2. **No perder datos si falla el guardado.** En `useSnapshotMutation` (`src/data/snapshot-cache.ts`), los diálogos pasan los valores del form como contexto.
   - En `onError`, el toast de error trae la acción **"Reintentar"**, que reabre el diálogo con esos valores (vía `useUi`).
   - Prioridad: Receivables (`AddReceivableDialog.tsx:119`), Expense e Income.
3. **Deshacer en lugar de confirmar** para borrar gastos, ingresos, pagos de tarjeta y gastos fijos.
   - El borrado optimista y el toast de 6 s siguen el patrón de `quick-expense-hooks.ts:30,66-83`.
   - El delete real se difiere hasta que vence el toast, y se ejecuta en `pagehide`.
   - El diálogo de confirmación se queda solo para taxonomía y cuentas con historial.
4. **Estados de error en todas las páginas.** Componente compartido `PageQueryState` (skeleton / error con Reintentar / contenido), siguiendo el patrón de `Dashboard.tsx:102-112`. Se aplica en Expenses, Ledger, Income, Credit, Receivables, Recurring, Goals y NetWorth (todas usan hoy `!data → skeleton`).
5. **Formulario de gasto**
   - Chips de fecha `Hoy · Ayer · Otra` en lugar de mostrar el date input de entrada, y `max={today}`.
   - Lista corta de 4–6 subcategorías recientes como chips sobre el select.
   - En desktop, "Guardar y agregar otro" (Shift+Enter).
6. **Montos** (`src/domain/parse.ts:9`): aceptar coma decimal ("250,5") cuando hay una sola coma seguida de 1–2 dígitos y ningún punto. Se amplían los tests de propiedades con fast-check.
7. **Listas en móvil**
   - Gastos: tocar la fila abre la edición; las acciones (borrar) viven dentro del sheet; se quitan los iconos lápiz/papelera en móvil (se quedan visibles al hover en desktop).
   - Las filas se agrupan por día ("Hoy", "Ayer", "Mié 5 nov").
   - Plantillas de gasto rápido y taxonomía: los 3–4 iconos por fila pasan a un menú `⋯` (`DropdownMenu`).
   - Receivables: las cuotas se muestran como cards bajo `md` en lugar de la tabla con scroll horizontal (`ReceivablesPage.tsx:144`).
8. **Gastos y Bitácora**
   - El selector de quincena se mueve al `PageHeader` de Expenses.
   - Chips de filtro en Expenses (Necesidades/Gustos, método de pago).
   - Filtros de Ledger en la URL (`useSearchParams`), con presets ("Esta quincena", "Mes pasado") y búsqueda por texto en notas y descripción.
   - Las filas de Ledger son tocables y abren la edición del movimiento.
9. **Dashboard accionable**: las BucketCard enlazan a Gastos filtrado por bucket, y se añade una alerta de "Tarjeta vence en N días" con el botón Pagar.
10. **Detalles**
    - Autofocus en el monto de Income y Recurring.
    - En Recurring, el día de cargo por defecto es el día de hoy.
    - `inputMode="numeric"` en los enteros de `PreferencesForm.tsx:96`.
    - En Goals, el monto mensual sugerido va como valor real y no como placeholder.
    - La gestión de plantillas de gasto rápido se mueve a Configuración → "Gastos rápidos", con acceso desde un enlace "Administrar" en la hoja ＋.

---

## Spec 010 — Animaciones y pulido (P2–P3), dentro de las reglas de spec 003

Todo con CSS, `tw-animate-css` y el `<ViewTransition>` de React 19.3: funciona sin config en el App Router y no agrega bundle (guía en `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Todas las animaciones duran ≤300 ms, solo usan opacity, transform y background-color, y respetan el kill-switch de `globals.css:195-210`.

| Interacción                         | Técnica                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cambio de ruta (con salida)         | `<ViewTransition>` en `src/app/(app)/template.tsx` en lugar de `animate-content-in`; crossfade y desplazamiento de 4 px                                |
| Skeleton → contenido                | `<ViewTransition>` alrededor de `PageQueryState` (revela un Suspense o crossfade)                                                                      |
| Alta de fila (gasto, ingreso, etc.) | `@starting-style` y la clase `animate-row-in` nueva (fade + 4 px, `duration-base`)                                                                     |
| Baja de fila / deshacer             | `<ViewTransition>` con `startTransition` alrededor del update optimista                                                                                |
| Abrir y cerrar la hoja ＋ / "Más"   | slide-up existente del Sheet, más un handle visual y **drag-to-dismiss** con pointer events nativos (sin librería) en `ui/dialog.tsx` y `ui/sheet.tsx` |
| Guardar con éxito                   | pulso de `bg-surface-highlight` en la fila o card afectada (reutiliza `animate-balance-highlight`)                                                     |
| Montos que cambian                  | se extiende el flash de fondo de `BucketCard` a metas y patrimonio (el texto nunca se anima)                                                           |
| Barra de metas                      | crece desde 0 con `scaleX`, igual que `BucketCard.tsx:88-93`                                                                                           |
| Gráfica de patrimonio               | se mantiene sin animación (decisión de spec 003)                                                                                                       |
| Errores de validación               | fade-in con altura animada usando `interpolate-size: allow-keywords`                                                                                   |
| Botón ＋ central                    | rotación de 45° del icono mientras la hoja está abierta                                                                                                |

También entran los ajustes de accesibilidad que encontré:

- `pointer-coarse` en items de dropdown, radio y switch.
- `focus-visible` en dropdown-menu.
- Se actualiza `tests/e2e/motion.spec.ts` para cubrir las animaciones nuevas.

---

## Archivos críticos

- **Shell:** `src/components/layout/{AppShell,MobileNav,nav-items,PageHeader,PreferencesSheet}.tsx`, `CreateSheet.tsx` (nuevo), `src/store/ui.ts` (o donde viva `useUi`).
- **Flujos:** `src/data/snapshot-cache.ts`, `src/domain/parse.ts`, `src/features/expenses/{AddExpenseDialog,ExpensesPage,CardDebtSummary,QuickExpenseBar}.tsx`, `src/features/income/RegisterIncomeDialog.tsx`, `src/features/credit/CreditPage.tsx`, `src/features/ledger/{LedgerPage,LedgerFilters,LedgerTable}.tsx`, `src/features/receivables/*`.
- **Motion:** `src/app/(app)/template.tsx`, `src/app/globals.css`, `src/components/ui/{dialog,sheet,dropdown-menu}.tsx`.
- **i18n:** `src/i18n/messages/{en,es}.json`, con claves nuevas para los grupos de nav, la hoja ＋, deshacer y reintentar.

## Verificación (por spec)

- `pnpm typecheck && pnpm lint && pnpm test` (unit, incluido parse con fast-check y theme-contrast).
- `E2E_MODES=demo pnpm test:e2e`. Es solo UI, así que no se levanta Supabase local (memoria). Se actualizan los e2e de nav (barra, "Más", ＋), deshacer, reintentar, filtros por URL, `a11y.spec.ts` y `motion.spec.ts`.
- `pnpm build` y `pnpm check:demo-bundle`, para confirmar que el first-load no crece más de +20 kB (SC-006).
- Revisión visual en la demo desplegada (Vercel desde `main`) a 390 px y 1440 px, en tema claro, oscuro y neon, con `prefers-reduced-motion` activado y desactivado.

## Flujo de trabajo

Cada spec pasa por `/speckit-specify` → `clarify` → `plan` → `tasks` → `implement`, con commit + push a `main` en cada paso.

---

## Estado de implementación (2026-11-07)

Los tres specs se ejecutaron en modo autónomo con el flujo speckit completo (specify → clarify → plan → tasks → analyze → implement), con commit + push a `main` por paso. Las decisiones abiertas se respondieron con la opción recomendada y quedaron en la sección **Clarifications/Assumptions** de cada `spec.md`.

| Spec                                                           | Tareas | Gate final                                                 | First Load `/dashboard` |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------- | ----------------------- |
| [008 · Navegación y shell](../specs/008-navigation-shell/)     | 35/35  | unit 661 ✓ · e2e demo 128 ✓ · build ✓ · demo-bundle ✓      | 328.4 → 331.7 kB (+3.3) |
| [009 · Flujos y formularios](../specs/009-low-friction-flows/) | 41/41  | unit 697 ✓ · e2e demo 144 + 18 ✓ · build ✓ · demo-bundle ✓ | 331.7 → 334.5 kB (+2.8) |
| [010 · Animaciones y pulido](../specs/010-motion-polish/)      | 22/22  | unit 705 ✓ · e2e demo 156 ✓ · build ✓ · demo-bundle ✓      | 334.5 → 335.9 kB (+1.4) |

En total, el First Load de `/dashboard` creció **+7.5 kB gzip** (cada spec tenía un presupuesto de +20 kB).

### Lo hecho

**008 · Navegación y shell**

- Destinos agrupados (Principal, Planear, Deudas, Análisis y Configuración al pie). La barra lateral tiene secciones y scroll propio.
- Barra móvil `Inicio · Gastos · ＋ · Crédito · Más`, sin FAB. "Más" queda activo en las rutas secundarias y su panel sube desde abajo.
- Hoja ＋ (Gasto, Ingreso, Pagar tarjeta y gastos rápidos) y, en escritorio, "＋ Nuevo" con atajos N/I/P. Hay una sola instancia de cada diálogo (`DialogHost` + `useUi.openCreate`), que se cierra al navegar.
- Estado de tarjeta unificado: `cardStatementSummary` + `CardStatementCard`, igual en Crédito y Gastos, con Pagar. Corrige la discrepancia de Gold Card.
- `PageHeader` en todas las páginas (Configuración y Reglas con "‹ Configuración"). El panel de la barra superior pasa a llamarse "Apariencia". El header respeta la safe-area, el padding inferior aplica solo en móvil y las alertas del Dashboard móvil van arriba como franja.

**009 · Flujos y formularios**

- Los formularios recuerdan la última cuenta y subcategoría (en el dispositivo, solo ids, ignora cuentas archivadas).
- Formulario de gasto: chips Hoy/Ayer/Otra, subcategorías recientes, "Guardar y agregar otro" (Shift+Enter) y Borrar dentro de la edición.
- Montos con coma decimal ("250,5"), probados con fast-check.
- "Reintentar" con lo escrito tras un guardado fallido (gasto, ingreso y cuenta por cobrar).
- Borrar con Deshacer de 6 s en lugar de confirmar (gastos, pagos de tarjeta, ingresos y gastos fijos). El borrado se confirma al vencer el aviso o en `pagehide`; el demo lo rechaza antes de ocultar la fila.
- Estado de error con Reintentar en las 8 páginas de datos.
- Gastos: quincena en el header, chips de bucket y método de pago, filtros en la URL, filas agrupadas por día y tocables en móvil.
- Bitácora: filtros en la URL, presets, búsqueda sin acentos y filas que abren la edición.
- Menús ⋯ en plantillas y taxonomía. Cuotas como tarjetas en móvil.
- Dashboard: enlace "Ver gastos" por bucket y alerta de tarjeta por vencer con Pagar.
- Gastos rápidos se administran en Configuración → Gastos rápidos, con enlace "Administrar" en la hoja ＋.
- Detalles: autofocus del monto, día de cargo = hoy, `inputMode` numérico y monto sugerido de metas como valor real.

**010 · Animaciones y pulido**

- Transición de ruta: en `template.tsx`, la página que entra hace un fade de 180 ms (opacidad y 4 px). El header, la barra inferior y la hoja "Más" no se mueven. Al principio era un `<ViewTransition>` de React 19.3, pero se reemplazó el 2026-11-08 (ver desviaciones).
- Revelado suave de lo que reemplaza al esqueleto.
- Las filas nuevas entran animadas; las borradas se desvanecen antes de ocultarse; la fila editada destella.
- Las tarjetas de metas y Patrimonio destellan cuando cambia su monto; la barra de metas crece con `scaleX` (antes animaba el ancho).
- Asa con arrastre para cerrar en las hojas inferiores (pointer events nativos).
- Los errores de validación aparecen con un desvanecimiento.
- 44 px táctiles en elementos de menú, radios y switches, y foco visible en los menús.
- Todo dura ≤ 300 ms, anima solo opacidad, transform o fondo, y se apaga con movimiento reducido.

### Desviaciones respecto a este roadmap (documentadas en cada spec)

- **Revelado del esqueleto y salida de filas sin `<ViewTransition>`**: React solo activa las transiciones de vista con transiciones, Suspense o valores diferidos. Las actualizaciones de TanStack Query y de Zustand son síncronas, así que se usaron un `MutationObserver` con la API de animaciones del navegador (revelado) y CSS (filas).
- **Errores de validación**: entran con desvanecimiento y desplazamiento, sin animar la altura con `interpolate-size`, porque el spec 003 solo permite opacidad, transform y color de fondo.
- **Icono del panel "Apariencia"**: conserva el icono original de ajustes (`SlidersHorizontal`) por preferencia del usuario (2026-11-08); solo cambió el nombre.
- **Pagos de tarjeta en Bitácora**: no abren edición, porque no existe un diálogo para editar pagos.
- **Transición de ruta sin `<ViewTransition>`** (2026-11-08): en iOS (WebKit), las capturas de la transición se pintaban encima de todo el documento, así que la barra inferior y el header desaparecían en cada toque, aunque tuvieran su propio `view-transition-name` y `z-index`. Ahora solo anima la página que entra, con CSS. El FR-001 y el R1 del spec 010 se corrigieron.

### Omitido por decisión del usuario

- Ejecutar los e2e `live-en`/`live-es` (no se levantó Docker ni Supabase local). Los e2e `@live` nuevos (recordar lo último usado, deshacer) quedaron escritos, pero no se ejecutaron.
- Revisión visual en el deploy de Vercel (390 px y 1440 px, temas claro, oscuro y neón, con movimiento reducido).
- No se tocó el proyecto Supabase en la nube y no hubo migraciones.

### Ajustes posteriores (2026-11-08)

Cambios hechos fuera de speckit, con commit + push a `main`:

- **Shell**: el header, la barra inferior y la hoja "Más" ya no se tapan durante la navegación. El botón ＋ queda encima del indicador deslizante de la barra.
- **Cerrar una hoja arrastrándola**: antes rebotaba. La animación de salida de tw-animate solo define el final (40 px abajo) y arranca desde donde quedó el dedo, así que una hoja arrastrada más de 40 px subía de regreso al cerrarse. Ahora la salida continúa hacia abajo hasta salir de la pantalla, sin desvanecerse, con una duración de 120–260 ms según la velocidad del dedo. La velocidad al soltar se mide sobre los últimos 100 ms en lugar de un solo evento, así que un arrastre corto ya no se cierra por accidente. Lo cubren la e2e "never bounces back up" (falla con el código anterior) y pruebas unitarias de `releaseVelocity` y `exitDurationMs`.
- **Datos del demo** (`src/data/mock/`):
  - Las cuentas usan bancos conocidos para que se vean sus logos: BBVA Debit, Nu Credit, Amex Gold, GBM+, Finsus y Cash. Los saldos siguen siendo ficticios.
  - Cada gasto tiene un título corto tipo comercio (Walmart, Pemex, Starbucks…) en lugar de repetir la subcategoría.
  - Los fijos se llaman Rent, Izzi, Netflix, Telcel y Smart Fit, y los deudores Ana y Carlos.
  - El gasto se recalibró a 1.5 gastos/día, con renta de $7,500 y montos máximos más bajos. En una simulación de cada dos días de 2026, Necesidades y Gustos nunca quedan en negativo: casi siempre en verde y a veces en amarillo.
- **Disponible para gastar nunca negativo**: si una bolsa se excede, el número grande muestra $0.00 y debajo "Te pasaste por $X" (EN "Over by"). El cálculo y el arrastre del déficit no cambian. Lo cubre `tests/unit/features/bucket-card.test.tsx`.
- **Aviso del demo**: usa `bg-primary`/`text-primary-foreground` en lugar de ámbar (lima con texto casi negro en neón).
- **Textos**:
  - EN: "quincena" → "pay period" (17 cadenas), "recognise" → "recognize", MSI explicado una vez y "safe-to-spend balance" dentro de las oraciones.
  - ES: "Deseos" → "Gustos" (el nombre de la bolsa), "Safe-to-Spend" → "disponible para gastar", "Dashboard"/"ledger" → "Inicio"/"bitácora", "el demo" en todos lados, "Último/Próximo corte" y "vence hoy mismo".

Gate: unit 715 ✓ · typecheck ✓ · lint ✓ · format ✓ · e2e demo `motion.spec.ts` 22 ✓ (5 corridas). No se corrió el resto de los e2e. Las capturas de `docs/screenshots/` son anteriores a estos cambios.

### Spec 011 · Pago de tarjeta como checklist y sesión de pago (2026-11-08)

[specs/011-card-paid-checklist](../specs/011-card-paid-checklist/), con el flujo speckit completo.

- **Por qué**: la familia del dueño usa sus tarjetas y le paga a él. Él solo registra sus compras y paga el total al banco. Registrar el monto real como pago dejaba saldo a favor y ocultaba los cortes siguientes.
- **"Ya la pagué"**: una marca por corte, sin monto, con Deshacer de 6 s y "Desmarcar". Está en Crédito, Gastos y el Dashboard. Marcar el último corte liquida los anteriores y el siguiente empieza limpio. El disponible para gastar no cambia.
- **Se quitaron**: el diálogo de pago con monto, "Pagar tarjeta" de la hoja ＋, el atajo P y los pagos en Gastos y Bitácora.
- **Sesión de pago del mes**: agrupa el corte vigente de cada tarjeta en el menor número de sesiones cuyos rangos de pago (del día siguiente al corte al día anterior al límite) se cruzan. Propone una ventana de 1–3 días junto al día de pago. Se ve en Crédito, y en el Dashboard desde 7 días antes ("Hoy toca pagar tus tarjetas" dentro de la ventana).
- **Datos**: migración `0011` (tabla `card_statement_marks`, RLS, conversión de `card_payments`). Se aplicó en la nube después de revisar la conversión en solo lectura (0 pagos).
- **Gate**: unit 748 ✓ · e2e demo 166 ✓ · pgTAP 182 ✓ · contrato 45 ✓ · e2e live 69/72 (los 3 fallos ya existían antes del spec, en us13 y perf-budgets) · build ✓ · demo-bundle ✓. First Load `/dashboard` 336.2 → 340.5 kB (+4.3).
- **Migración `0012`**: quita UPDATE, TRUNCATE, REFERENCES y TRIGGER de `authenticated` en `card_statement_marks`. Se aplicó en la nube con la aprobación del dueño el 2026-11-08; quedan SELECT, INSERT y DELETE.

### Bloqueos pendientes

- Ninguno. Todas las verificaciones locales (typecheck, lint, unit, e2e demo, build, demo-bundle) terminaron en verde. Para correr los flujos que escriben datos queda pendiente `pnpm test:e2e:local` con Supabase local.
