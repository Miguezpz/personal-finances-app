/**
 * 002-google-sign-in · T019: the landing turns `?authError=` into a translated alert, ignores
 * unknown values and cleans the URL so the message doesn't come back on reload.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthErrorAlert } from "@/features/auth/OAuthErrorAlert";
import { parseOAuthError } from "@/features/auth/oauth-error";
import { renderWithProviders } from "../../utils/renderWithProviders";

const nav = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.search,
  useRouter: () => ({ replace: nav.replace }),
}));

beforeEach(() => {
  nav.search = new URLSearchParams();
  nav.replace.mockClear();
});

describe("parseOAuthError", () => {
  it.each([
    ["not_authorized", "not_authorized"],
    ["failed", "failed"],
    [null, null],
    ["", null],
    ["signup_disabled", null],
    ["<script>", null],
  ] as const)("%s → %s", (value, expected) => {
    expect(parseOAuthError(value)).toBe(expected);
  });
});

describe("OAuthErrorAlert", () => {
  it.each([
    ["en", "not_authorized", "This Google account doesn't have access to this app."],
    ["es", "not_authorized", "Esta cuenta de Google no tiene acceso a esta app."],
    ["en", "failed", "Couldn't sign in with Google. Please try again."],
    ["es", "failed", "No se pudo iniciar sesión con Google. Inténtalo de nuevo."],
  ] as const)("[%s] %s shows its message and cleans the URL", async (locale, code, message) => {
    nav.search = new URLSearchParams({ authError: code });
    renderWithProviders(<OAuthErrorAlert />, { locale });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });

  it("keeps the message visible after the URL is cleaned", async () => {
    nav.search = new URLSearchParams({ authError: "failed" });
    const { rerender } = renderWithProviders(<OAuthErrorAlert />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());

    nav.search = new URLSearchParams();
    rerender(<OAuthErrorAlert />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each(["", "authError=signup_disabled", "authError=whatever", "other=1"])(
    "shows nothing and leaves the URL alone for %s",
    (query) => {
      nav.search = new URLSearchParams(query);
      renderWithProviders(<OAuthErrorAlert />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    },
  );
});
