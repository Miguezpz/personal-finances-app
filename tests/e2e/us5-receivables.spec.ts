/**
 * T103 · US5 end to end (live-en, live-es): register a $12,000 MSI purchase at 6 months for a new
 * debtor → 6 installments of $2,000 that sum exactly and are always collected before the card's due
 * date (US5-1/2, SC-006); record a collection → the debtor owes $10,000 (US5-4/6); and the
 * Safe-to-Spend never moves, nor is any expense created (US5-5, SC-007).
 */
import { todayIn } from "../../src/domain/periods";
import { currentQuincena, expect, test } from "./fixtures";

const TZ = "America/Mexico_City";

test.describe("US5 · receivables (MSI for third parties)", { tag: "@live" }, () => {
  test("schedule, collection and isolation from the personal budget", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    const period = currentQuincena(todayIn(TZ, new Date()));
    const received = period.from;
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
    const { data: card } = await userClient
      .from("accounts")
      .insert({
        kind: "credit_card",
        name: "Test Card",
        cut_off_day: 10,
        payment_due_offset_days: 20,
      })
      .select("id")
      .single();
    const cardId = card?.id as string;

    // Safe-to-Spend before anything third-party happens.
    await page.goto("/dashboard");
    const needs = page.getByTestId("bucket-needs").locator(".money").first();
    const wants = page.getByTestId("bucket-wants").locator(".money").first();
    await expect(wants).toHaveText("$1,000.00");
    const before = { needs: await needs.innerText(), wants: await wants.innerText() };

    // --- Register the purchase ----------------------------------------------------------
    await page.goto("/receivables");
    await page.getByTestId("add-receivable").click();
    await page.locator("#receivable-debtor-name").fill("Ana");
    await page.locator("#receivable-description").fill("Phone");
    await page.locator("#receivable-total").fill("12,000");
    await page.locator("#receivable-term").fill("6");
    await page.locator("#receivable-card").selectOption(cardId);
    await expect(page.getByTestId("schedule-preview").locator("tbody tr")).toHaveCount(6);
    await page.getByTestId("save-receivable").click();

    const rows = page.getByTestId("installment-row");
    await expect(rows).toHaveCount(6);
    await expect(page.getByTestId("debtor-card")).toContainText("$12,000.00");

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("installments")
          .select("seq, amount_cents, due_on, card_due_on")
          .eq("user_id", owner.id)
          .order("seq");
        return data ?? [];
      })
      .toHaveLength(6);
    const { data: installments } = await admin
      .from("installments")
      .select("seq, amount_cents, due_on, card_due_on")
      .eq("user_id", owner.id)
      .order("seq");
    expect(installments?.reduce((s, i) => s + i.amount_cents, 0)).toBe(1_200_000);
    for (const i of installments ?? []) {
      expect(i.amount_cents).toBe(200_000);
      expect(i.due_on < i.card_due_on).toBe(true);
    }

    // --- Collect the first installment --------------------------------------------------
    await rows.first().getByTestId("record-collection").click();
    await page.getByTestId("save-collection").click();
    await expect(rows.first()).toHaveAttribute("data-status", "collected");
    await expect(page.getByTestId("debtor-card")).toContainText("$10,000.00");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("installments")
          .select("collected_cents, status")
          .eq("user_id", owner.id)
          .eq("seq", 1);
        return data?.[0];
      })
      .toEqual({ collected_cents: 200_000, status: "collected" });

    // --- The personal budget never moved -------------------------------------------------
    await page.goto("/dashboard");
    await expect(wants).toHaveText(before.wants);
    await expect(needs).toHaveText(before.needs);
    const { count } = await admin
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", owner.id);
    expect(count).toBe(0);
  });
});
