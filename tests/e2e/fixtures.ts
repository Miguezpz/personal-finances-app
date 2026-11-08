/**
 * Shared Playwright fixtures.
 *
 * `owner` (live projects only): a brand-new user in LOCAL Supabase per test, signed in through
 * the real login form, deleted afterwards (all rows cascade). Needs the local credentials in the
 * environment — CI exports them; locally run `pnpm test:e2e:local`. Refuses any non-local URL.
 * `admin` lets a test assert what was persisted, independent of the UI language.
 * `userClient` acts AS the owner (publishable key + password, RLS applies) to seed data the same
 * way the app would.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test as base, expect, type Page } from "@playwright/test";
import type { Database } from "../../src/data/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);

export interface Owner {
  id: string;
  email: string;
  password: string;
}

type Fixtures = {
  admin: SupabaseClient<Database>;
  owner: Owner;
  userClient: SupabaseClient<Database>;
  ownerPage: Page;
};

export const test = base.extend<Fixtures>({
  admin: async ({}, use, testInfo) => {
    testInfo.skip(
      !url || !secretKey,
      "Local Supabase credentials missing (use pnpm test:e2e:local)",
    );
    if (!isLocal) throw new Error(`Refusing to run e2e against a non-local Supabase (${url}).`);
    await use(
      createClient<Database>(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  },

  owner: async ({ admin }, use, testInfo) => {
    const email = `e2e-${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
    const password = `pw-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    await use({ id: data.user.id, email, password });
    await admin.auth.admin.deleteUser(data.user.id);
  },

  userClient: async ({ owner }, use) => {
    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    if (error) throw error;
    await use(client);
    await client.auth.signOut();
  },

  ownerPage: async ({ page, owner }, use) => {
    await page.goto("/");
    await page.locator("#login-email").fill(owner.email);
    await page.locator("#login-password").fill(owner.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL("**/dashboard");
    await use(page);
  },
});

export { expect };

/** The next 15th that is today or later (in the browser's time zone), as YYYY-MM-DD. */
export function nextFifteenth(now = new Date()): { received: string; fundedStart: string } {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const [year, month] = now.getDate() <= 15 ? [y, m] : m === 11 ? [y + 1, 0] : [y, m + 1];
  const mm = String(month + 1).padStart(2, "0");
  return { received: `${year}-${mm}-15`, fundedStart: `${year}-${mm}-16` };
}

/**
 * Opens one of the app-wide create dialogs (spec 008): the "＋ New" menu on desktop, the bottom
 * bar's "＋" sheet on a phone. Returns the dialog.
 */
export async function openCreate(
  page: import("@playwright/test").Page,
  kind: "expense" | "income",
) {
  const plus = page.getByTestId("mobile-nav-create");
  if (await plus.isVisible()) {
    await plus.click();
    await page.getByTestId(`create-${kind}`).click();
  } else {
    // The menu loads right after hydration; until then its trigger is a disabled placeholder.
    const trigger = page.getByTestId("new-menu");
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await page.getByTestId(`new-${kind}`).click();
  }
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
