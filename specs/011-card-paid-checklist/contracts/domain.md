# Contract: dominio puro (spec 011)

Funciones nuevas o cambiadas en `src/domain/`. Ninguna lee el reloj: `today` siempre se inyecta. `CardData` pasa a ser `Pick<FinanceSnapshot, "expenses" | "statementMarks" | "receivables" | "installments">`.

## `src/domain/credit.ts` (cambia)

```ts
export type StatementState = "paid" | "pending" | "overdue"; // revisado: sin "nothing"

/** Último corte pagado de la tarjeta (máximo de sus marcas), o null. */
export function paidThrough(cardId: Uuid, marks: readonly StatementMark[]): IsoDate | null;

export interface CardStatus {
  cardId: Uuid;
  totalDebt: Cents;                 // R3
  lastCutOff: IsoDate;
  nextPaymentDue: IsoDate;
  payToAvoidInterest: Cents;        // R3, 0 si el último corte está pagado
  overdue: boolean;
}
export function cardStatus(card: Account, data: CardData, today: IsoDate): CardStatus;

export interface CardStatementSummary {
  cardId: Uuid;
  last: { cutOff: IsoDate; due: IsoDate; outstanding: Cents; state: StatementState; markId: Uuid | null };
  next: { cutOff: IsoDate; due: IsoDate; amount: Cents };
  totalDebt: Cents;
  headline: "last" | "next";        // "next" cuando last es paid
}
export function cardStatementSummary(card: Account, data: CardData, today: IsoDate): CardStatementSummary;

/** Monto y estado de un estado de cuenta concreto (lo usan la sesión y la línea de tiempo). */
export function statementOf(card: Account, data: CardData, cutOff: IsoDate, today: IsoDate):
  { cutOff: IsoDate; due: IsoDate; payRange: { from: IsoDate; to: IsoDate };
    outstanding: Cents; state: StatementState; markId: Uuid | null };

export function creditTimeline(...): TimelineEvent[];  // card_due usa statementOf (FR-017)
```

**Invariantes (pruebas unitarias y fast-check)**:

1. Con marcas que cubren el corte `C`, `statementOf(C).state === "paid"` y `outstanding === 0`.
2. Marcar `C` nunca cambia el `outstanding` de un corte `C' > C` respecto a marcar nada y considerar pagados todos los cortes ≤ C. Es decir, no hay saldo a favor (SC-002).
3. `totalDebt` = Σ compras con fecha `> L` + Σ cuotas con `cardDueOn > due(L)`; nunca negativo.
4. El estado del corte más reciente con marca propia vuelve exactamente a su estado previo al quitar esa marca.
5. `payToAvoidInterest` no depende de ningún monto de pago (no existen).

## `src/domain/payment-sessions.ts` (nuevo)

```ts
export interface SessionCard { card: Account; statement: ReturnType<typeof statementOf> }
export interface PaymentSession {
  window: { start: IsoDate; end: IsoDate };   // 1–3 días (FR-027)
  cards: readonly SessionCard[];
  done: boolean;                              // todas paid
  phase: "upcoming" | "today" | "past";
}

/** Sesiones del ciclo vigente, ordenadas por inicio (FR-026, FR-027). */
export function paymentSessions(
  cards: readonly Account[], data: CardData,
  settings: Pick<UserSettings, "firstPayday" | "secondPayday">, today: IsoDate,
): PaymentSession[];

/** La sesión a mostrar en Crédito (FR-028/030): la primera no hecha con fin ≥ hoy, o la del ciclo siguiente. */
export function nextPaymentSession(...same args): { session: PaymentSession; previousDone: boolean } | null;

/** Ventana de 1–3 días dentro del cruce, junto al primer día de pago (FR-027). Exportada para pruebas. */
export function sessionWindow(
  cross: { from: IsoDate; to: IsoDate },
  settings: Pick<UserSettings, "firstPayday" | "secondPayday">,
): { start: IsoDate; end: IsoDate };
```

**Casos de prueba obligatorios**:

- Ejemplo de la spec: A (corte 10, límite 30) y B (corte 25, límite 14). El cruce va del 11 al 13 de noviembre, sin día de pago, así que la ventana es del 11 al 13.
- Cruce con el 15 dentro y 3 días de margen, así que la ventana es del 15 al 17. Cruce del 13 al 16 con el 15 dentro: no caben 3 días desde el 15, así que la ventana es del 14 al 16 (termina al fin del cruce e incluye el 15).
- Cruce de 1 o 2 días, así que la ventana es todo el cruce.
- Rangos que no se cruzan, así que salen 2 sesiones (FR-026). Con 3 tarjetas, la agrupación es la mínima.
- Tarjeta archivada o sin términos: no participa.
- Todas marcadas, así que `done`, y `nextPaymentSession` devuelve el ciclo siguiente.

## `src/domain/legacy-card-payments.ts` (nuevo, solo conversión y seed)

```ts
/** Corte que pagaba un pago anterior: el más reciente estrictamente anterior a su fecha (FR-018). */
export function markForLegacyPayment(cutOffDay: number, paidOn: IsoDate): IsoDate;
```

Misma regla que la conversión SQL de `0011` (probada en pgTAP con los mismos casos).

## `src/domain/ledger.ts`, `csv.ts`, `net-worth.ts` (cambian)

- `LedgerEntryType` pierde `"card_payment"`. `buildLedger` ya no recibe pagos.
- `toBackupZip`/CSV: `card_statement_marks.csv` reemplaza a `card_payments.csv`.
- `netWorth` usa `cardStatus(...).totalDebt` (R3); la firma no cambia.
