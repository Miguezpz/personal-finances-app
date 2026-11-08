/**
 * Monthly card payment session (spec 011, US5, FR-025–FR-031, research.md R5).
 *
 * A statement can be paid from the day after its cut-off to the day before it's due (its pay
 * range, FR-025). The owner pays every card in one sitting, so the app groups each card's current
 * statement into the fewest sessions whose pay ranges share at least one day (greedy interval
 * stabbing: optimal for this problem) and proposes, inside that shared range, a window of up to
 * 3 days next to a payday so the money is already there (FR-027). Computed on the client from the
 * card terms and the preferences; nothing is stored (FR-031). Pure: `today` is injected.
 */
import { cardTermsOf, lastCutOffOn, cutOffIn } from "./card-terms";
import { statementOf, type CardData, type StatementView } from "./credit";
import { addDays, addMonthsToMonthStart, daysBetween, parseIsoDate } from "./dates";
import { clampChargeDay } from "./periods";
import type { Account, IsoDate, UserSettings } from "./types";

export const SESSION_DAYS = 3;
/** How many monthly cycles ahead `nextPaymentSession` looks for an unfinished session. */
const CYCLES_AHEAD = 3;

type Paydays = Pick<UserSettings, "firstPayday" | "secondPayday">;

export interface SessionCard {
  card: Account;
  statement: StatementView;
}

export interface PaymentSession {
  /** 1–3 days inside the range every card of the session can be paid in (FR-027). */
  window: { start: IsoDate; end: IsoDate };
  /** The shared pay range the window was chosen from. */
  cross: { from: IsoDate; to: IsoDate };
  cards: readonly SessionCard[];
  /** Every card is paid or has nothing to pay (FR-030). */
  done: boolean;
  phase: "upcoming" | "today" | "past";
}

/** Paydays (1st/2nd of the preferences, 31 = last day) between `from` and `to`, ascending. */
function paydaysIn(from: IsoDate, to: IsoDate, settings: Paydays): IsoDate[] {
  const out: IsoDate[] = [];
  for (let m = addMonthsToMonthStart(from, 0); m <= to; m = addMonthsToMonthStart(m, 1)) {
    const { year, month } = parseIsoDate(m);
    for (const day of [settings.firstPayday, settings.secondPayday]) {
      const date = clampChargeDay(year, month, day);
      if (date >= from && date <= to) out.push(date);
    }
  }
  return [...new Set(out)].sort();
}

/**
 * Up to 3 days inside `cross` (all of it if shorter). Next to the first payday in it: starting on
 * that payday, or ending on the last day of the cross when 3 days don't fit after it. With no
 * payday in the cross, it starts on its first day (FR-027).
 */
export function sessionWindow(
  cross: { from: IsoDate; to: IsoDate },
  settings: Paydays,
): { start: IsoDate; end: IsoDate } {
  const size = Math.min(SESSION_DAYS, daysBetween(cross.from, cross.to) + 1);
  const payday = paydaysIn(cross.from, cross.to, settings)[0];
  let start = payday ?? cross.from;
  const latestStart = addDays(cross.to, -(size - 1));
  if (start > latestStart) start = latestStart;
  return { start, end: addDays(start, size - 1) };
}

/** The card's statement `cycle` months after the first one that can still be paid today. */
function statementInCycle(card: Account, data: CardData, today: IsoDate, cycle: number) {
  const terms = cardTermsOf(card);
  if (!terms) return null;
  // Due dates fall up to 60 days after the cut-off: start two months back and walk forward.
  let cutOff = cutOffIn(
    terms.cutOffDay,
    addMonthsToMonthStart(lastCutOffOn(terms.cutOffDay, today), -2),
  );
  let view = statementOf(card, data, cutOff, today);
  for (let i = 0; i < 6 && view.payRange.to < today; i++) {
    cutOff = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(cutOff, 1));
    view = statementOf(card, data, cutOff, today);
  }
  for (let i = 0; i < cycle; i++) {
    cutOff = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(cutOff, 1));
    view = statementOf(card, data, cutOff, today);
  }
  return view;
}

const isSettled = (c: SessionCard) =>
  c.statement.state === "paid" || c.statement.state === "nothing";

/**
 * The sessions of one monthly cycle (0 = the statements that can still be paid today), in window
 * order. Active credit cards with complete terms only.
 */
export function paymentSessions(
  cards: readonly Account[],
  data: CardData,
  settings: Paydays,
  today: IsoDate,
  cycle = 0,
): PaymentSession[] {
  const items: SessionCard[] = [];
  for (const card of cards) {
    if (card.kind !== "credit_card" || card.archived) continue;
    const statement = statementInCycle(card, data, today, cycle);
    if (statement) items.push({ card, statement });
  }
  items.sort((a, b) =>
    a.statement.payRange.to === b.statement.payRange.to
      ? a.card.name.localeCompare(b.card.name)
      : a.statement.payRange.to < b.statement.payRange.to
        ? -1
        : 1,
  );

  // Greedy stabbing: each group's point is the earliest end of its ranges.
  const groups: { point: IsoDate; members: SessionCard[] }[] = [];
  for (const item of items) {
    const group = groups[groups.length - 1];
    if (group && item.statement.payRange.from <= group.point) group.members.push(item);
    else groups.push({ point: item.statement.payRange.to, members: [item] });
  }

  return groups
    .map(({ members }) => {
      const cross = {
        from: members.reduce(
          (max, m) => (m.statement.payRange.from > max ? m.statement.payRange.from : max),
          members[0]?.statement.payRange.from as IsoDate,
        ),
        to: members.reduce(
          (min, m) => (m.statement.payRange.to < min ? m.statement.payRange.to : min),
          members[0]?.statement.payRange.to as IsoDate,
        ),
      };
      const window = sessionWindow(cross, settings);
      const phase: PaymentSession["phase"] =
        today < window.start ? "upcoming" : today > window.end ? "past" : "today";
      return { window, cross, cards: members, done: members.every(isSettled), phase };
    })
    .sort((a, b) => (a.window.start < b.window.start ? -1 : 1));
}

/**
 * What Credit shows (FR-028/030): the sessions of the current cycle whose window hasn't ended, and
 * the first unfinished session from now on (this cycle or the following ones).
 */
export function nextPaymentSession(
  cards: readonly Account[],
  data: CardData,
  settings: Paydays,
  today: IsoDate,
): { current: PaymentSession[]; next: PaymentSession | null } {
  const current = paymentSessions(cards, data, settings, today).filter(
    (s) => s.window.end >= today,
  );
  for (let cycle = 0; cycle < CYCLES_AHEAD; cycle++) {
    const next = paymentSessions(cards, data, settings, today, cycle).find(
      (s) => s.window.end >= today && !s.done,
    );
    if (next) return { current, next };
  }
  return { current, next: null };
}
