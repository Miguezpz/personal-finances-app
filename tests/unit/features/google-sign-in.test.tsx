/**
 * 002-google-sign-in · T011: "Continue with Google" starts the OAuth flow with the app's own
 * callback URL, shows progress, and recovers from errors with a translated message.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import { ProviderError, type DataProvider } from "@/data/provider";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";
import { renderWithProviders } from "../../utils/renderWithProviders";

function providerWith(signInWithGoogle: DataProvider["auth"]["signInWithGoogle"]): DataProvider {
  const base = createMockProvider();
  return { ...base, auth: { ...base.auth, signInWithGoogle } };
}

/** A promise that never settles: the browser has navigated away to Google. */
const pending = () => new Promise<void>(() => {});

describe("GoogleSignInButton", () => {
  it("calls signInWithGoogle with <origin>/auth/callback and shows progress", async () => {
    const signIn = vi.fn(pending);
    renderWithProviders(<GoogleSignInButton />, { provider: providerWith(signIn) });

    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signIn).toHaveBeenCalledWith(`${window.location.origin}/auth/callback`);
    const busy = screen.getByRole("button", { name: "Redirecting to Google…" });
    expect(busy).toBeDisabled();
  });

  it("is labelled in Spanish when the locale is ES", () => {
    renderWithProviders(<GoogleSignInButton />, {
      provider: providerWith(vi.fn(pending)),
      locale: "es",
    });
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeEnabled();
  });

  it("works from the keyboard", async () => {
    const signIn = vi.fn(pending);
    renderWithProviders(<GoogleSignInButton />, { provider: providerWith(signIn) });

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(signIn).toHaveBeenCalledOnce();
  });

  it.each([
    ["OFFLINE", "You're offline"],
    ["COLD_START", "Waking up the database"],
    ["UNKNOWN", "Couldn't sign in with Google. Please try again."],
  ] as const)("on %s shows a message and re-enables the button", async (code, message) => {
    const signIn = vi.fn(() => Promise.reject(new ProviderError(code, "boom")));
    renderWithProviders(<GoogleSignInButton />, { provider: providerWith(signIn) });

    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});
