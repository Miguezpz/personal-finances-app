/**
 * T094 · US4 end to end (live-en, live-es): an expense in Wants lowers the Safe-to-Spend and changes
 * the semáforo; paid with a credit card it raises the card's debt (US4-4); paying the card lowers
 * the debt and does NOT touch the Safe-to-Spend (US4-5, FR-013b).
 */
import { addDays } from "../../src/domain/dates";
import { periodOf, todayIn } from "../../src/domain/periods";
import { expect, openCreate, test } from "./fixtures";

const TZ = "America/Mexico_City";

test.describe("US4 · expenses and card payments", { tag: "@live" }, () => {
  test("a card purchase moves the budget and the debt; paying the card only moves the debt", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    // Seed as the owner: $1,000 in Needs and in Wants for the current quincena, and a credit card.
    const period = periodOf(todayIn(TZ, new Date()));
    const received = addDays(period.start, -1);
    const { data: ruleId } = await userClient.rpc("save_distribution_rule", {
      p_rule: { effective_from: received, needs_bps: 5000, wants_bps: 5000, investment_bps: 0 },
      p_subrules: [],
    });
    await userClient.rpc("register_income", {
      p_income: {
        label: "Salary",
        amount_cents: 200_000,
        received_on: received,
        funded_period_start: period.start,
        rule_id: ruleId,
      },
      p_allocations: [
        { bucket: "needs", amount_cents: 100_000, period_start: period.start },
        { bucket: "wants", amount_cents: 100_000, period_start: period.start },
      ],
    });
    const { data: card, error } = await userClient
      .from("accounts")
      .insert({
        kind: "credit_card",
        name: "Test Card",
        cut_off_day: 10,
        payment_due_offset_days: 20,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const cardId = card?.id as string;

    let restaurants: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Restaurants"); // Restaurants & Cafes › Restaurants (spec 004 default)
        restaurants = data?.[0]?.id;
        return restaurants;
      })
      .toBeTruthy();

    // --- A $600 card purchase in Wants: 100% → 40% (green → yellow), debt +$600 -----------
    await page.goto("/dashboard");
    const wants = page.getByTestId("bucket-wants");
    await expect(wants).toHaveAttribute("data-light", "green");
    await openCreate(page, "expense");
    await page.locator("#expense-amount").fill("600");
    await page.locator("#expense-subcategory").selectOption(restaurants ?? "");
    await page.locator("#expense-account").selectOption(cardId);
    await page.getByTestId("save-expense").click();
    await expect(wants).toHaveAttribute("data-light", "yellow");
    await expect(wants.locator(".money").first()).toHaveText("$400.00");

    await page.goto("/expenses");
    const debt = page.locator(`[data-testid="card-debt"][data-card="${cardId}"]`);
    // $600 bought today: the statement that closes on the next cut-off (spec 008, US3).
    await expect(debt.getByTestId("statement-amount")).toContainText("$600.00");
    await expect(page.getByTestId("expense-row")).toHaveCount(1);

    // --- Paying the card lowers its debt ------------------------------------------------
    await debt.getByTestId("pay-card").click();
    await page.locator("#payment-amount").fill("600");
    await page.getByTestId("save-card-payment").click();
    await expect(debt.getByTestId("statement-amount")).toContainText("$0.00");
    await expect(page.getByTestId("payment-row")).toHaveCount(1);

    // --- …and leaves the Safe-to-Spend exactly where it was ------------------------------
    await page.goto("/dashboard");
    await expect(wants.locator(".money").first()).toHaveText("$400.00");
    await expect(wants).toHaveAttribute("data-light", "yellow");

    await expect
      .poll(async () => {
        const [{ data: expenses }, { data: payments }] = await Promise.all([
          admin
            .from("expenses")
            .select("amount_cents, bucket, payment_account_id")
            .eq("user_id", owner.id),
          admin
            .from("card_payments")
            .select("amount_cents, card_account_id")
            .eq("user_id", owner.id),
        ]);
        return { expenses, payments };
      })
      .toEqual({
        expenses: [{ amount_cents: 60_000, bucket: "wants", payment_account_id: cardId }],
        payments: [{ amount_cents: 60_000, card_account_id: cardId }],
      });
  });
});
