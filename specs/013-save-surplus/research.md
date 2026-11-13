# Research: Ahorrado de la quincena

## R1 — La transferencia ocurre en la cadena de arrastre

- **Decision**:
  - Al recorrer las quincenas en `computeCarryChain`, cada quincena guarda su **cierre** igual que hoy, así que `chain` no cambia de significado.
  - Al **entrar** a la siguiente quincena, con el ajuste encendido, por bucket: `ahorrado += max(saldo, 0)` y `saldo = min(saldo, 0)`.
  - `carryIn(target) = closing(target) − delta(target)`, como hoy, y por eso ya refleja la transferencia.
  - La transferencia que se hace al entrar a la quincena objetivo es "Quincena pasada". La suma de todas las transferencias hasta la objetivo es "Total ahorrado".
- **Rationale**:
  - Es un cambio local de unas pocas líneas en el único lugar donde se calcula el arrastre.
  - `computeSafeToSpend`, la base (`allocated + max(carryIn, 0)`) y el semáforo no cambian.
  - La quincena en curso nunca se transfiere, como pide el escenario US1-6.
- **Alternatives considered**: guardar los sobrantes en una tabla. Se descartó porque la spec pide que todo sea derivado (FR-008) y una tabla así se desincronizaría al editar el pasado.

## R2 — Forma del resultado

- **Decision**:
  - Una función interna `carryChain(input, upTo)` devuelve `{ chain, saved: { lastPeriod, total } }`.
  - `computeCarryChain` sigue exportada con la misma firma y devuelve `.chain`.
  - `SafeToSpend.saved` vale `null` con el ajuste apagado (FR-006).
- **Rationale**: no rompe a los usuarios ni a las pruebas actuales de `computeCarryChain`, como `third-party-isolation`.

## R3 — Patrimonio

- **Decision**: `computeNetWorth` suma `sts.saved?.total ?? 0` a los activos.
- **Rationale**:
  - Hoy el patrimonio cuenta el disponible firmado de Necesidades y Gustos, que ya incluye el arrastre.
  - Con el ajuste, ese arrastre positivo sale del disponible y entra a Ahorrado. Sumarlo deja el patrimonio igual (SC-004).
  - Se prueba con la igualdad entre ajuste encendido y apagado.

## R4 — Preferencias

- **Decision**:
  - `preferencesFormSchema` gana `saveSurplus: z.boolean()`.
  - En `PreferencesForm`, un `Controller` con el `Switch` de shadcn, igual que en `AddExpenseDialog`.
  - Se guarda con el resto del formulario a través de `useUpdateSettings`, que ya es optimista (`{ ...s.settings, ...patch }`). Por eso el Dashboard cambia sin recargar (SC-003).
  - En el demo, `settings.update` es rechazado por `denyWrite`, aparece el aviso global y el formulario se reinicia (FR-013).
- **Alternatives considered**: guardar el interruptor al instante, sin el botón Guardar. Se descartó para mantener el mismo patrón que el resto de Preferencias.

## R5 — Demo

- **Decision**: `seed.ts` usa `settings = { ...DEFAULT_USER_SETTINGS, saveSurplus: true }`.
- **Rationale**: así la tarjeta se ve en el portafolio y en las e2e de demo. Las e2e de demo existentes revisan la presencia de los buckets y su semáforo, no montos exactos.

## R6 — Base de datos

- **Decision**: `alter table public.user_settings add column save_surplus boolean not null default false;`.
  - Las filas existentes quedan en `false`.
  - No hace falta tocar RLS ni grants, porque son por tabla.
  - Se aplica a la nube con el MCP de Supabase y confirmación del dueño, antes del push.
  - Después se ajusta la versión en `supabase_migrations` al prefijo `0013` (memoria `migration-before-push`).
