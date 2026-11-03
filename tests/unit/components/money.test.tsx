/**
 * T129 · <Money> privacy (US9, FR-045): masked when privacy mode is on, and — while the stored
 * preferences aren't hydrated yet — whenever the data is real (no flash of amounts on reload).
 * The read-only demo (fictitious data) shows amounts unless privacy is on. Charts mask the same
 * way through `useChartMoney`.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bar, BarChart, XAxis } from "recharts";
import { MaskedYAxis, useChartMoney } from "@/components/charts/MaskedAxis";
import { MASK, Money } from "@/components/money/Money";
import { createMockProvider } from "@/data/mock/provider";
import type { DataProvider } from "@/data/provider";
import { cents } from "@/domain/money";
import { renderHookWithProviders, renderWithProviders } from "../../utils/renderWithProviders";

/** The demo's data, but declared writable = the user's real data. */
const realDataProvider = (): DataProvider => ({
  ...createMockProvider(),
  capabilities: { canWrite: true },
});

const AMOUNT = cents(1_234_567);

function renderMoney(options: Parameters<typeof renderWithProviders>[1]) {
  const { container } = renderWithProviders(<Money cents={AMOUNT} />, options);
  return container.querySelector(".money") as HTMLElement;
}

describe("<Money> privacy", () => {
  it("shows the amount with privacy off (demo or real data, once hydrated)", () => {
    expect(renderMoney({ preferences: { privacyMode: false } }).textContent).toBe("$12,345.67");
    const real = renderMoney({ provider: realDataProvider(), preferences: { privacyMode: false } });
    expect(real.dataset.masked).toBe("false");
    expect(real.textContent).toContain("12,345.67");
  });

  it("masks with privacy on: only •••• is visible and screen readers hear 'Hidden amount'", () => {
    const el = renderMoney({ preferences: { privacyMode: true } });
    expect(el.dataset.masked).toBe("true");
    expect(el.textContent).not.toMatch(/\d/);
    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toBe(MASK);
    expect(screen.getByText("Hidden amount")).toHaveClass("sr-only");
  });

  it("masks real data until the stored preferences are hydrated", () => {
    const el = renderMoney({
      provider: realDataProvider(),
      preferences: { privacyMode: false, hydrated: false },
    });
    expect(el.dataset.masked).toBe("true");
    expect(el.textContent).not.toMatch(/\d/);
  });

  it("does not mask the demo's fictitious data before hydration", () => {
    const el = renderMoney({ preferences: { privacyMode: false, hydrated: false } });
    expect(el.dataset.masked).toBe("false");
  });

  it("is announced in the active language", () => {
    renderMoney({ locale: "es", preferences: { privacyMode: true } });
    expect(screen.getByText("Monto oculto")).toBeInTheDocument();
  });
});

describe("useChartMoney (axes and tooltips)", () => {
  it("formats compact ticks and full tooltips, and masks both with privacy on", () => {
    const shown = renderHookWithProviders(() => useChartMoney(), {
      preferences: { privacyMode: false },
    }).result.current;
    expect(shown.tick(cents(1_250_000))).toBe("$12,500");
    expect(shown.tooltip(AMOUNT)).toBe("$12,345.67");

    const hidden = renderHookWithProviders(() => useChartMoney(), {
      preferences: { privacyMode: true },
    }).result.current;
    expect(hidden.tick(cents(1_250_000))).toBe(MASK);
    expect(hidden.tooltip(AMOUNT)).toBe(MASK);
  });
});

describe("<MaskedYAxis> inside a Recharts chart", () => {
  const chart = (
    <BarChart
      width={400}
      height={200}
      data={[
        { m: "Jan", v: 1_000_000 },
        { m: "Feb", v: 2_000_000 },
      ]}
    >
      <XAxis dataKey="m" />
      <MaskedYAxis />
      <Bar dataKey="v" isAnimationActive={false} />
    </BarChart>
  );
  const ticks = (container: HTMLElement) =>
    [...container.querySelectorAll(".recharts-yAxis-tick-labels .recharts-text")].map(
      (t) => t.textContent,
    );

  it("prints money ticks, and only •••• with privacy on", () => {
    const shown = renderWithProviders(chart, { preferences: { privacyMode: false } });
    expect(ticks(shown.container)).toContain("$20,000");
    shown.unmount();
    const hidden = renderWithProviders(chart, { preferences: { privacyMode: true } });
    const values = ticks(hidden.container);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === MASK)).toBe(true);
  });
});
