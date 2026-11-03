/**
 * T105 · useFxRates (FR-033…036, SC-009): one request per app load, the last VALID rate is saved in
 * localStorage with its date, a failure falls back to that rate marked `stale`, and with nothing
 * saved it resolves to null — never an error that would break the page.
 */
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FX_STORAGE_KEY } from "@/features/fx/storage";
import { useFxRates } from "@/features/fx/useFxRates";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

const frankfurter = (usd: number, eur: number, date = "2026-11-02") =>
  new Response(JSON.stringify({ amount: 1, base: "MXN", date, rates: { USD: usd, EUR: eur } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("useFxRates", () => {
  it("fetches once per load and saves the last valid rate with its date", async () => {
    fetchMock.mockResolvedValue(frankfurter(0.05342, 0.047628));
    const a = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(a.result.current.fx).not.toBeNull());

    expect(a.result.current.fx).toMatchObject({
      base: "MXN",
      rates: { USD: 0.05342, EUR: 0.047628 },
      asOf: "2026-11-02",
      stale: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("base=MXN");

    // A second consumer in the same load shares the result: no new request.
    const { queryClient } = a;
    renderHookWithProviders(() => useFxRates(), { queryClient });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(localStorage.getItem(FX_STORAGE_KEY) ?? "null");
    expect(stored).toMatchObject({ rates: { USD: 0.05342, EUR: 0.047628 }, asOf: "2026-11-02" });
  });

  it("falls back to the secondary source when the primary fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: "success",
          time_last_update_unix: 1793577751,
          rates: { MXN: 1, USD: 0.0535, EUR: 0.0477 },
        }),
        { status: 200 },
      ),
    );
    const { result } = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(result.current.fx).not.toBeNull());
    expect(result.current.fx).toMatchObject({ rates: { USD: 0.0535, EUR: 0.0477 }, stale: false });
    expect(result.current.fx?.source).toContain("er-api");
  });

  it("on failure returns the previous valid rate marked stale", async () => {
    localStorage.setItem(
      FX_STORAGE_KEY,
      JSON.stringify({
        base: "MXN",
        rates: { USD: 0.05, EUR: 0.045 },
        asOf: "2026-10-30",
        fetchedAt: "2026-10-30T10:00:00.000Z",
        source: "frankfurter",
      }),
    );
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fx).toMatchObject({
      rates: { USD: 0.05, EUR: 0.045 },
      asOf: "2026-10-30",
      stale: true,
    });
  });

  it("an implausible new rate (> 20% jump) is rejected in favour of the previous one", async () => {
    localStorage.setItem(
      FX_STORAGE_KEY,
      JSON.stringify({
        base: "MXN",
        rates: { USD: 0.05, EUR: 0.045 },
        asOf: "2026-10-30",
        fetchedAt: "2026-10-30T10:00:00.000Z",
        source: "frankfurter",
      }),
    );
    fetchMock.mockResolvedValue(frankfurter(0.5, 0.045));
    const { result } = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fx).toMatchObject({ rates: { USD: 0.05 }, stale: true });
  });

  it("with no previous rate a failure resolves to null without throwing, and can retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fx).toBeNull();
    expect(result.current.isError).toBe(false);

    fetchMock.mockResolvedValue(frankfurter(0.05342, 0.047628));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.fx?.stale).toBe(false));
  });

  it("ignores corrupt stored data", async () => {
    localStorage.setItem(FX_STORAGE_KEY, "{not json");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHookWithProviders(() => useFxRates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fx).toBeNull();
  });
});
