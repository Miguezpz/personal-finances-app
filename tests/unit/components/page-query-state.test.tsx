import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { PageQueryState } from "@/components/data/PageQueryState";
import en from "@/i18n/messages/en.json";

const renderState = (status: { isPending: boolean; isError: boolean; refetch: () => void }) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PageQueryState status={status} skeleton={<p>loading</p>}>
        <p>content</p>
      </PageQueryState>
    </NextIntlClientProvider>,
  );

describe("PageQueryState (spec 009, FR-014)", () => {
  it("shows the skeleton while loading", () => {
    renderState({ isPending: true, isError: false, refetch: () => {} });
    expect(screen.getByText("loading")).toBeTruthy();
  });

  it("shows a recoverable error with Retry", () => {
    const refetch = vi.fn();
    renderState({ isPending: false, isError: true, refetch });
    expect(screen.getByTestId("page-error")).toBeTruthy();
    fireEvent.click(screen.getByTestId("page-retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the content once loaded", () => {
    renderState({ isPending: false, isError: false, refetch: () => {} });
    expect(screen.getByText("content")).toBeTruthy();
  });
});
