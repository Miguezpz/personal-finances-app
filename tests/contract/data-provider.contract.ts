/**
 * T043 · Shared DataProvider contract, run against BOTH implementations
 * (mock.contract.test.ts, supabase.contract.test.ts) so the demo can't drift from production.
 *
 *  - reads return valid domain values (Zod) with every foreign key resolved;
 *  - loadSnapshot() is coherent with the individual repository reads;
 *  - capabilities.canWrite matches the implementation;
 *  - writable providers: exact-sum violations → ProviderError('VALIDATION'), idempotent writes
 *    stay idempotent, conflicts → 'CONFLICT';
 *  - read-only providers: EVERY write rejects with DemoReadOnlyError and the data is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildLedger } from "@/domain/ledger";
import { bps, cents } from "@/domain/money";
import type { FinanceSnapshot, IsoDate, Uuid } from "@/domain/types";
import {
  DemoReadOnlyError,
  ProviderError,
  type DataProvider,
  type ProviderContractFactory,
} from "@/data/provider";
import { financeSnapshotSchema, ledgerEntrySchema } from "./schemas";

export interface ContractOptions {
  /** Expected `capabilities.canWrite`. */
  canWrite: boolean;
}

const d = (s: string) => s as IsoDate;
const sortById = <T extends { id: string }>(xs: readonly T[]) =>
  [...xs].sort((a, b) => a.id.localeCompare(b.id));

async function expectProviderError(promise: Promise<unknown>, code: ProviderError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ProviderError(${code})`).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).code).toBe(code);
}

/** Creates one row of every aggregate through the provider (writable providers start empty). */
async function seedThroughProvider(p: DataProvider) {
  await p.settings.update({ collectionLeadDays: 3 });
  const debit = await p.accounts.create({
    kind: "checking",
    name: "Debit",
    institution: null,
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(100_000),
    archived: false,
  });
  const card = await p.accounts.create({
    kind: "credit_card",
    name: "Card",
    institution: "Bank",
    cutOffDay: 10,
    paymentDueOffsetDays: 20,
    openingBalance: cents(0),
    archived: false,
  });
  const stocks = await p.accounts.create({
    kind: "investment",
    name: "Stocks",
    institution: null,
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(0),
    archived: false,
  });
  const category = await p.taxonomy.createCategory({
    name: "Home",
    nameKey: null,
    macro: "needs",
    archived: false,
    icon: "house",
  });
  const sub = await p.taxonomy.createSubcategory({
    categoryId: category.id,
    name: "Rent",
    nameKey: null,
    archived: false,
    icon: null,
  });
  const rule = await p.rules.save({
    rule: {
      effectiveFrom: d("2026-11-01"),
      needs: bps(5000),
      wants: bps(3000),
      investment: bps(2000),
      investmentSubrules: [{ accountId: stocks.id, pct: bps(10_000) }],
    },
  });
  await p.incomes.register({
    income: {
      label: "Salary",
      amount: cents(2_000_000),
      receivedOn: d("2026-11-15"),
      fundedPeriodStart: d("2026-11-16"),
      isRecurring: true,
      distributed: true,
      ruleId: rule.id,
      depositAccountId: debit.id,
      incomeType: "salary",
    },
    allocations: [
      { bucket: "needs", accountId: null, amount: cents(1_000_000), periodStart: d("2026-11-16") },
      { bucket: "wants", accountId: null, amount: cents(600_000), periodStart: d("2026-11-16") },
      {
        bucket: "investment",
        accountId: stocks.id,
        amount: cents(400_000),
        periodStart: d("2026-11-16"),
      },
    ],
  });
  const recurring = await p.recurring.create({
    name: "Rent",
    amount: cents(800_000),
    chargeDay: 1,
    subcategoryId: sub.id,
    bucket: "needs",
    paymentAccountId: debit.id,
    startsOn: d("2026-11-01"),
    endedOn: null,
  });
  await p.expenses.create({
    amount: cents(50_000),
    spentOn: d("2026-11-17"),
    subcategoryId: sub.id,
    bucket: "needs",
    paymentAccountId: card.id,
    note: "Groceries",
    origin: "manual",
    recurringExpenseId: null,
    occurrenceDate: null,
  });
  await p.expenses.materializeRecurring([
    {
      amount: cents(800_000),
      spentOn: d("2026-11-01"),
      subcategoryId: sub.id,
      bucket: "needs",
      paymentAccountId: debit.id,
      note: null,
      origin: "recurring",
      recurringExpenseId: recurring.id,
      occurrenceDate: d("2026-11-01"),
    },
  ]);
  await p.cardPayments.create({
    cardAccountId: card.id,
    fromAccountId: debit.id,
    amount: cents(50_000),
    paidOn: d("2026-11-28"),
    note: null,
  });
  const debtor = await p.receivables.createDebtor({ name: "Ana" });
  const receivable = await p.receivables.create({
    receivable: {
      debtorId: debtor.id,
      cardAccountId: card.id,
      description: "Phone",
      total: cents(1_200_000),
      termMonths: 2,
      purchaseDate: d("2026-11-05"),
    },
    installments: [
      { seq: 1, dueOn: d("2026-11-27"), cardDueOn: d("2026-11-30"), amount: cents(600_000) },
      { seq: 2, dueOn: d("2026-12-27"), cardDueOn: d("2026-12-30"), amount: cents(600_000) },
    ],
  });
  const goal = await p.goals.create({
    kind: "sinking_fund",
    name: "Property tax",
    sourceBucket: "needs",
    targetMonths: null,
    annual: cents(1_200_000),
    monthly: cents(100_000),
    archived: false,
  });
  await p.goals.addContributions([
    {
      goalId: goal.id,
      periodStart: d("2026-11-01"),
      amount: cents(100_000),
      sourceBucket: "needs",
    },
  ]);
  await p.netWorth.upsertMonthly({
    snapshotOn: d("2026-11-01"),
    assets: cents(500_000),
    liabilities: cents(50_000),
    netWorth: cents(450_000),
  });
  return { debit, card, stocks, sub, rule, recurring, receivable, goal };
}

function expectForeignKeysResolved(s: FinanceSnapshot) {
  const ids = <T extends { id: Uuid }>(xs: readonly T[]) => new Set(xs.map((x) => x.id));
  const accounts = ids(s.accounts);
  const subcategories = ids(s.subcategories);
  const has = (set: Set<Uuid>, id: Uuid | null, what: string) => {
    if (id !== null) expect(set.has(id), `${what} ${id} resolves`).toBe(true);
  };
  const categories = ids(s.categories);
  const rules = ids(s.rules);
  const incomes = ids(s.incomes);
  const recurring = ids(s.recurring);
  const debtors = ids(s.debtors);
  const receivables = ids(s.receivables);
  const goals = ids(s.goals);

  s.subcategories.forEach((x) => has(categories, x.categoryId, "subcategory.categoryId"));
  s.rules.forEach((r) =>
    r.investmentSubrules.forEach((x) => has(accounts, x.accountId, "subrule.accountId")),
  );
  s.incomes.forEach((x) => {
    has(rules, x.ruleId, "income.ruleId");
    has(accounts, x.depositAccountId, "income.depositAccountId");
  });
  s.allocations.forEach((x) => {
    has(incomes, x.incomeId, "allocation.incomeId");
    has(accounts, x.accountId, "allocation.accountId");
  });
  s.recurring.forEach((x) => {
    has(subcategories, x.subcategoryId, "recurring.subcategoryId");
    has(accounts, x.paymentAccountId, "recurring.paymentAccountId");
  });
  s.expenses.forEach((x) => {
    has(subcategories, x.subcategoryId, "expense.subcategoryId");
    has(accounts, x.paymentAccountId, "expense.paymentAccountId");
    has(recurring, x.recurringExpenseId, "expense.recurringExpenseId");
  });
  s.cardPayments.forEach((x) => {
    has(accounts, x.cardAccountId, "cardPayment.cardAccountId");
    has(accounts, x.fromAccountId, "cardPayment.fromAccountId");
  });
  s.receivables.forEach((x) => {
    has(debtors, x.debtorId, "receivable.debtorId");
    has(accounts, x.cardAccountId, "receivable.cardAccountId");
  });
  s.installments.forEach((x) => has(receivables, x.receivableId, "installment.receivableId"));
  s.contributions.forEach((x) => has(goals, x.goalId, "contribution.goalId"));
}

export function runDataProviderContract(
  name: string,
  factory: ProviderContractFactory,
  options: ContractOptions,
) {
  describe(`DataProvider contract · ${name}`, () => {
    let provider: DataProvider;
    let dispose: () => Promise<void> = async () => {};

    beforeAll(async () => {
      const created = await factory();
      provider = created.provider;
      dispose = created.dispose;
      if (options.canWrite) await seedThroughProvider(provider);
    }, 60_000);

    afterAll(async () => {
      await dispose();
    });

    it(`reports capabilities.canWrite = ${options.canWrite}`, () => {
      expect(provider.capabilities.canWrite).toBe(options.canWrite);
    });

    it("loadSnapshot returns valid domain types with every foreign key resolved", async () => {
      const snapshot = await provider.loadSnapshot();
      const parsed = financeSnapshotSchema.safeParse(snapshot);
      expect(
        parsed.success,
        parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 5), null, 2),
      ).toBe(true);
      expect(snapshot.accounts.length).toBeGreaterThan(0);
      expect(snapshot.incomes.length).toBeGreaterThan(0);
      expect(snapshot.expenses.length).toBeGreaterThan(0);
      expectForeignKeysResolved(snapshot);
    });

    it("keeps exact sums: allocations = income, installments = total", async () => {
      const s = await provider.loadSnapshot();
      for (const income of s.incomes.filter((i) => i.distributed)) {
        const sum = s.allocations
          .filter((a) => a.incomeId === income.id)
          .reduce((t, a) => t + a.amount, 0);
        expect(sum, `allocations of ${income.id}`).toBe(income.amount);
      }
      for (const r of s.receivables) {
        const rows = s.installments.filter((i) => i.receivableId === r.id);
        expect(rows).toHaveLength(r.termMonths);
        expect(rows.reduce((t, i) => t + i.amount, 0)).toBe(r.total);
      }
    });

    it("loadSnapshot is coherent with the individual reads", async () => {
      const s = await provider.loadSnapshot();
      const [
        settings,
        accounts,
        rules,
        categories,
        subcategories,
        incomes,
        recurring,
        expenses,
        cardPayments,
        debtors,
        receivables,
        goals,
        netWorth,
      ] = await Promise.all([
        provider.settings.get(),
        provider.accounts.list({ includeArchived: true }),
        provider.rules.list(),
        provider.taxonomy.listCategories(),
        provider.taxonomy.listSubcategories(),
        provider.incomes.list(),
        provider.recurring.list(),
        provider.expenses.list(),
        provider.cardPayments.list(),
        provider.receivables.listDebtors(),
        provider.receivables.list(),
        provider.goals.list(),
        provider.netWorth.list(),
      ]);
      expect(settings).toEqual(s.settings);
      expect(sortById(accounts)).toEqual(sortById(s.accounts));
      expect(sortById(rules)).toEqual(sortById(s.rules));
      expect(sortById(categories)).toEqual(sortById(s.categories));
      expect(sortById(subcategories)).toEqual(sortById(s.subcategories));
      expect(sortById(incomes.incomes)).toEqual(sortById(s.incomes));
      expect(sortById(incomes.allocations)).toEqual(sortById(s.allocations));
      expect(sortById(recurring)).toEqual(sortById(s.recurring));
      expect(sortById(expenses)).toEqual(sortById(s.expenses));
      expect(sortById(cardPayments)).toEqual(sortById(s.cardPayments));
      expect(sortById(debtors)).toEqual(sortById(s.debtors));
      expect(sortById(receivables.receivables)).toEqual(sortById(s.receivables));
      expect(sortById(receivables.installments)).toEqual(sortById(s.installments));
      expect(sortById(goals.goals)).toEqual(sortById(s.goals));
      expect(sortById(goals.contributions)).toEqual(sortById(s.contributions));
      expect(sortById(netWorth)).toEqual(sortById(s.netWorthSnapshots));
    });

    it("range filters return only rows inside the range", async () => {
      const s = await provider.loadSnapshot();
      const some = s.expenses[0];
      if (!some) throw new Error("no expenses to filter");
      const range = { from: some.spentOn, to: some.spentOn };
      const filtered = await provider.expenses.list(range);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((e) => e.spentOn === some.spentOn)).toBe(true);
    });

    it("the ledger returns valid signed entries, third-party collections flagged", async () => {
      const entries = await provider.ledger.list();
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(ledgerEntrySchema.safeParse(e).success).toBe(true);
        if (e.type === "income" || e.type === "installment_collection")
          expect(e.amount).toBeGreaterThan(0);
        else expect(e.amount).toBeLessThan(0);
        expect(e.isThirdParty).toBe(e.type === "installment_collection");
      }
    });

    it("the ledger read matches buildLedger() over the snapshot (view and domain agree)", async () => {
      const [entries, s] = await Promise.all([provider.ledger.list(), provider.loadSnapshot()]);
      expect(sortById(entries)).toEqual(sortById(buildLedger(s)));
    });

    if (options.canWrite) {
      it("rejects allocations that don't sum to the income with VALIDATION", async () => {
        await expectProviderError(
          provider.incomes.register({
            income: {
              label: "Bad",
              amount: cents(100_000),
              receivedOn: d("2026-11-15"),
              fundedPeriodStart: d("2026-11-16"),
              isRecurring: true,
              distributed: true,
              ruleId: null,
              depositAccountId: null,
              incomeType: "other",
            },
            allocations: [
              {
                bucket: "needs",
                accountId: null,
                amount: cents(99_999),
                periodStart: d("2026-11-16"),
              },
            ],
          }),
          "VALIDATION",
        );
      });

      it("rejects installments that don't sum to the total with VALIDATION", async () => {
        const s = await provider.loadSnapshot();
        const card = s.accounts.find((a) => a.kind === "credit_card");
        const debtor = s.debtors[0];
        if (!card || !debtor) throw new Error("seed missing");
        await expectProviderError(
          provider.receivables.create({
            receivable: {
              debtorId: debtor.id,
              cardAccountId: card.id,
              description: "Bad",
              total: cents(1000),
              termMonths: 1,
              purchaseDate: d("2026-11-05"),
            },
            installments: [
              { seq: 1, dueOn: d("2026-11-27"), cardDueOn: d("2026-11-30"), amount: cents(999) },
            ],
          }),
          "VALIDATION",
        );
      });

      it("materializing the same recurring occurrence twice inserts nothing (idempotent)", async () => {
        const s = await provider.loadSnapshot();
        const applied = s.expenses.find((e) => e.origin === "recurring");
        if (!applied) throw new Error("seed missing");
        const again = Object.fromEntries(
          Object.entries(applied).filter(([k]) => k !== "id"),
        ) as Omit<typeof applied, "id">;
        expect(await provider.expenses.materializeRecurring([again])).toEqual([]);
        const after = await provider.expenses.list();
        expect(after.filter((e) => e.origin === "recurring")).toHaveLength(1);
      });

      it("the monthly net worth snapshot is idempotent", async () => {
        const first = (await provider.netWorth.list())[0];
        if (!first) throw new Error("seed missing");
        const again = await provider.netWorth.upsertMonthly({
          snapshotOn: first.snapshotOn,
          assets: cents(1),
          liabilities: cents(0),
          netWorth: cents(1),
        });
        expect(again).toEqual(first);
      });

      it("goal contributions are idempotent per (goal, period)", async () => {
        const { contributions } = await provider.goals.list();
        const first = contributions[0];
        if (!first) throw new Error("seed missing");
        const again = await provider.goals.addContributions([
          {
            goalId: first.goalId,
            periodStart: first.periodStart,
            amount: cents(1),
            sourceBucket: first.sourceBucket,
          },
        ]);
        expect(again).toEqual([]);
        expect((await provider.goals.list()).contributions).toHaveLength(contributions.length);
      });

      it("refuses to archive a card with pending installments (CONFLICT)", async () => {
        const card = (await provider.accounts.list()).find((a) => a.kind === "credit_card");
        if (!card) throw new Error("seed missing");
        await expectProviderError(provider.accounts.archive(card.id), "CONFLICT");
      });

      it("refuses to delete a subcategory with movements (CONFLICT)", async () => {
        const sub = (await provider.taxonomy.listSubcategories())[0];
        if (!sub) throw new Error("seed missing");
        await expectProviderError(provider.taxonomy.remove("subcategory", sub.id), "CONFLICT");
      });

      it("renaming a default category drops its i18n key (the typed name wins)", async () => {
        const created = await provider.taxonomy.createCategory({
          name: "Groceries",
          nameKey: "taxonomy.groceries",
          macro: "needs",
          archived: false,
          icon: "shopping-cart",
        });
        await provider.taxonomy.update("category", created.id, { name: "Super" });
        const renamed = (await provider.taxonomy.listCategories()).find((c) => c.id === created.id);
        // C4: the typed name drops the i18n key but keeps the icon.
        expect(renamed).toMatchObject({ name: "Super", nameKey: null, icon: "shopping-cart" });
        await provider.taxonomy.remove("category", created.id);
      });

      // ---------- Spec 004: icons and income types (contracts/data-provider.md) ----------
      it("C1 · stores a category icon", async () => {
        const created = await provider.taxonomy.createCategory({
          name: "Utilities 004",
          nameKey: null,
          macro: "needs",
          archived: false,
          icon: "plug",
        });
        expect(created.icon).toBe("plug");
        const listed = (await provider.taxonomy.listCategories()).find((c) => c.id === created.id);
        expect(listed?.icon).toBe("plug");
        await provider.taxonomy.remove("category", created.id);
      });

      it("C2 · sets and clears a subcategory's own icon without touching its name or key", async () => {
        const category = await provider.taxonomy.createCategory({
          name: "Food 004",
          nameKey: "taxonomy.categories.restaurants",
          macro: "wants",
          archived: false,
          icon: "utensils",
        });
        const sub = await provider.taxonomy.createSubcategory({
          categoryId: category.id,
          name: "Coffee",
          nameKey: null,
          archived: false,
          icon: null,
        });
        await provider.taxonomy.update("subcategory", sub.id, { icon: "coffee" });
        const find = async () =>
          (await provider.taxonomy.listSubcategories()).find((x) => x.id === sub.id);
        expect(await find()).toMatchObject({ name: "Coffee", nameKey: null, icon: "coffee" });
        await provider.taxonomy.update("subcategory", sub.id, { icon: null });
        expect(await find()).toMatchObject({ name: "Coffee", icon: null });
        await provider.taxonomy.update("category", category.id, { icon: "coffee" });
        const cat = (await provider.taxonomy.listCategories()).find((c) => c.id === category.id);
        expect(cat).toMatchObject({ icon: "coffee", nameKey: "taxonomy.categories.restaurants" });
        await provider.taxonomy.remove("subcategory", sub.id);
        await provider.taxonomy.remove("category", category.id);
      });

      it("C3 · rejects an icon with an invalid format with VALIDATION", async () => {
        const category = (await provider.taxonomy.listCategories())[0];
        if (!category) throw new Error("seed missing");
        await expectProviderError(
          provider.taxonomy.update("category", category.id, { icon: "Not Valid!" }),
          "VALIDATION",
        );
      });

      it("C9 · bulk inserts create the missing rows once and skip existing names", async () => {
        const defs = [
          { name: "Bulk A", nameKey: null, macro: "needs" as const, archived: false, icon: "tag" },
          { name: "Bulk B", nameKey: null, macro: "wants" as const, archived: false, icon: null },
        ];
        const first = await provider.taxonomy.insertCategories(defs);
        expect(first.map((c) => c.name).sort()).toEqual(["Bulk A", "Bulk B"]);
        expect(await provider.taxonomy.insertCategories(defs)).toEqual([]);
        const a = first.find((c) => c.name === "Bulk A");
        if (!a) throw new Error("insert missing");
        const subs = [
          { categoryId: a.id, name: "One", nameKey: null, archived: false, icon: null },
          { categoryId: a.id, name: "Two", nameKey: null, archived: false, icon: "coffee" },
        ];
        expect(await provider.taxonomy.insertSubcategories(subs)).toHaveLength(2);
        expect(await provider.taxonomy.insertSubcategories(subs)).toEqual([]);
        const listed = (await provider.taxonomy.listSubcategories()).filter(
          (x) => x.categoryId === a.id,
        );
        expect(listed.map((x) => [x.name, x.icon]).sort()).toEqual([
          ["One", null],
          ["Two", "coffee"],
        ]);
        for (const x of listed) await provider.taxonomy.remove("subcategory", x.id);
        for (const c of first) await provider.taxonomy.remove("category", c.id);
      });

      it("C5/C6 · stores the income type and replaces it without changing the split", async () => {
        const income = {
          label: "Gift 004",
          amount: cents(50_000),
          receivedOn: d("2026-11-20"),
          fundedPeriodStart: d("2026-12-01"),
          isRecurring: false,
          distributed: false,
          ruleId: null,
          depositAccountId: null,
          incomeType: "salary" as const,
        };
        const created = await provider.incomes.register({ income, allocations: [] });
        expect(created.incomeType).toBe("salary");
        const replaced = await provider.incomes.replace(created.id, {
          income: { ...income, incomeType: "gift" },
          allocations: [],
        });
        expect(replaced).toMatchObject({ incomeType: "gift", amount: 50_000, distributed: false });
        const { incomes, allocations } = await provider.incomes.list();
        expect(incomes.find((i) => i.id === created.id)?.incomeType).toBe("gift");
        expect(allocations.filter((a) => a.incomeId === created.id)).toEqual([]);
        await provider.incomes.remove(created.id);
      });

      it("records a partial collection and derives its status", async () => {
        const { installments } = await provider.receivables.list();
        const first = installments.find((i) => i.seq === 1);
        if (!first) throw new Error("seed missing");
        const updated = await provider.receivables.recordCollection({
          installmentId: first.id,
          collected: cents(100_000),
          collectedOn: d("2026-11-26"),
        });
        expect(updated.status).toBe("partial");
        expect(updated.collected).toBe(100_000);
      });
    } else {
      it("C7 · the demo uses the 26 default categories and typed incomes", async () => {
        const s = await provider.loadSnapshot();
        expect(s.categories).toHaveLength(26);
        expect(s.subcategories).toHaveLength(68);
        expect(s.categories.every((c) => c.icon !== null)).toBe(true);
        expect(s.incomes.length).toBeGreaterThan(0);
      });

      it("rejects EVERY write with DemoReadOnlyError and leaves the data unchanged", async () => {
        const before = structuredClone(await provider.loadSnapshot());
        const anyId = "00000000-0000-4000-8000-000000000001" as Uuid;
        const p = provider;
        const writes: Array<[string, () => Promise<unknown>]> = [
          ["auth.signIn", () => p.auth.signIn("x@example.com", "secret")],
          [
            "auth.signInWithGoogle",
            () => p.auth.signInWithGoogle("http://localhost/auth/callback"),
          ],
          ["settings.update", () => p.settings.update({ collectionLeadDays: 5 })],
          ["accounts.create", () => p.accounts.create(before.accounts[0] as never)],
          ["accounts.update", () => p.accounts.update(anyId, { name: "x" })],
          ["accounts.archive", () => p.accounts.archive(anyId)],
          ["rules.save", () => p.rules.save({ rule: before.rules[0] as never })],
          [
            "taxonomy.createCategory",
            () => p.taxonomy.createCategory(before.categories[0] as never),
          ],
          [
            "taxonomy.createSubcategory",
            () => p.taxonomy.createSubcategory(before.subcategories[0] as never),
          ],
          ["taxonomy.update", () => p.taxonomy.update("category", anyId, { name: "x" })],
          ["taxonomy.insertCategories", () => p.taxonomy.insertCategories([])],
          ["taxonomy.insertSubcategories", () => p.taxonomy.insertSubcategories([])],
          // C8: changing an icon is a write like any other.
          ["taxonomy.update", () => p.taxonomy.update("category", anyId, { icon: "plug" })],
          ["taxonomy.remove", () => p.taxonomy.remove("subcategory", anyId)],
          [
            "incomes.register",
            () => p.incomes.register({ income: before.incomes[0] as never, allocations: [] }),
          ],
          [
            "incomes.replace",
            () => p.incomes.replace(anyId, { income: before.incomes[0] as never, allocations: [] }),
          ],
          ["incomes.remove", () => p.incomes.remove(anyId)],
          ["expenses.create", () => p.expenses.create(before.expenses[0] as never)],
          ["expenses.update", () => p.expenses.update(anyId, { note: "x" })],
          ["expenses.remove", () => p.expenses.remove(anyId)],
          [
            "expenses.materializeRecurring",
            () => p.expenses.materializeRecurring([before.expenses[0] as never]),
          ],
          ["recurring.create", () => p.recurring.create(before.recurring[0] as never)],
          ["recurring.update", () => p.recurring.update(anyId, { name: "x" })],
          ["recurring.end", () => p.recurring.end(anyId, d("2026-11-01"))],
          ["recurring.remove", () => p.recurring.remove(anyId)],
          ["cardPayments.create", () => p.cardPayments.create(before.cardPayments[0] as never)],
          ["cardPayments.remove", () => p.cardPayments.remove(anyId)],
          ["receivables.createDebtor", () => p.receivables.createDebtor({ name: "x" })],
          [
            "receivables.create",
            () =>
              p.receivables.create({
                receivable: before.receivables[0] as never,
                installments: [],
              }),
          ],
          [
            "receivables.recordCollection",
            () =>
              p.receivables.recordCollection({
                installmentId: anyId,
                collected: cents(1),
                collectedOn: null,
              }),
          ],
          ["receivables.remove", () => p.receivables.remove(anyId)],
          ["goals.create", () => p.goals.create(before.goals[0] as never)],
          ["goals.update", () => p.goals.update(anyId, { name: "x" })],
          ["goals.addContributions", () => p.goals.addContributions([])],
          [
            "netWorth.upsertMonthly",
            () => p.netWorth.upsertMonthly(before.netWorthSnapshots[0] as never),
          ],
        ];
        for (const [name, write] of writes) {
          const error = await write().then(
            () => null,
            (e: unknown) => e,
          );
          expect(error, `${name} must reject`).toBeInstanceOf(DemoReadOnlyError);
          expect((error as DemoReadOnlyError).attempted).toBe(name);
        }
        expect(await provider.loadSnapshot()).toEqual(before);
      });
    }
  });
}
