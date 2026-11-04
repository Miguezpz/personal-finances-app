/**
 * 002-google-sign-in · T010 + T018: where /auth/callback sends the browser (contracts/auth-oauth.md § 2).
 * `resolveCallback` is pure: the code exchange and the session check are injected, so no network.
 */
import { describe, expect, it, vi } from "vitest";
import { resolveCallback, type CallbackDeps } from "@/data/supabase/oauth-callback";

const params = (query: string) => new URLSearchParams(query);

function deps(overrides: Partial<CallbackDeps> = {}): CallbackDeps {
  return {
    exchange: vi.fn(() => Promise.resolve(true)),
    hasSession: vi.fn(() => Promise.resolve(false)),
    ...overrides,
  };
}

describe("resolveCallback — success (US1)", () => {
  it("exchanges the code and lands on the dashboard", async () => {
    const d = deps();
    await expect(resolveCallback(params("code=abc"), d)).resolves.toBe("/dashboard");
    expect(d.exchange).toHaveBeenCalledWith("abc");
  });

  it("goes to the dashboard when there is no code but a valid session exists", async () => {
    const d = deps({ hasSession: () => Promise.resolve(true) });
    await expect(resolveCallback(params(""), d)).resolves.toBe("/dashboard");
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it.each([
    "code=abc&next=https://example.com",
    "code=abc&redirect_to=https://evil.test/steal",
    "code=abc&next=//evil.test",
  ])("ignores any requested destination (%s)", async (query) => {
    const target = await resolveCallback(params(query), deps());
    expect(target).toBe("/dashboard");
  });
});

describe("resolveCallback — failures (US2)", () => {
  it("maps signup_disabled to not_authorized", async () => {
    const d = deps();
    const target = await resolveCallback(
      params(
        "error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance",
      ),
      d,
    );
    expect(target).toBe("/?authError=not_authorized");
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled at Google", "error=access_denied&error_description=The+user+denied"],
    ["provider disabled", "error=invalid_request&error_code=provider_disabled"],
    ["bad OAuth state", "error=invalid_request&error_code=bad_oauth_state"],
  ])("maps any other provider error to failed (%s)", async (_label, query) => {
    await expect(resolveCallback(params(query), deps())).resolves.toBe("/?authError=failed");
  });

  it("an error wins over a code in the same URL", async () => {
    const d = deps();
    const target = await resolveCallback(params("code=abc&error=server_error"), d);
    expect(target).toBe("/?authError=failed");
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it("fails when the exchange is rejected (invalid, expired or reused code)", async () => {
    const d = deps({ exchange: () => Promise.resolve(false) });
    await expect(resolveCallback(params("code=expired"), d)).resolves.toBe("/?authError=failed");
  });

  it("fails when the exchange throws (network, cold start)", async () => {
    const d = deps({ exchange: () => Promise.reject(new Error("fetch failed")) });
    await expect(resolveCallback(params("code=abc"), d)).resolves.toBe("/?authError=failed");
  });

  it("fails without code, error or session", async () => {
    await expect(resolveCallback(params(""), deps())).resolves.toBe("/?authError=failed");
  });

  it("never forwards the provider's error_description", async () => {
    const target = await resolveCallback(
      params("error=server_error&error_description=Database+error+saving+new+user"),
      deps(),
    );
    expect(target).not.toMatch(/description|Database/i);
  });
});
