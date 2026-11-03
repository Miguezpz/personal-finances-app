/**
 * T135 · Demo writes (FR-047): a DemoReadOnlyError from ANY mutation notifies exactly once per
 * attempt (the toast itself is de-duplicated by id), is never retried, and other errors don't
 * notify. The mutation ends in a plain error state, so forms reset without a second toast.
 */
import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { DemoReadOnlyError, ProviderError } from "@/data/provider";
import { createQueryClient } from "@/lib/query-client";

function run(client: ReturnType<typeof createQueryClient>, fn: () => Promise<unknown>) {
  return new MutationObserver(client, { mutationFn: fn }).mutate().catch((e: unknown) => e);
}

describe("createQueryClient · demo read-only writes", () => {
  it("notifies once per rejected write and never retries it", async () => {
    const onDemoReadOnly = vi.fn();
    const client = createQueryClient({ onDemoReadOnly });
    const write = vi.fn(() => Promise.reject(new DemoReadOnlyError("expenses.create")));

    const error = await run(client, write);
    expect(error).toBeInstanceOf(DemoReadOnlyError);
    expect(write).toHaveBeenCalledTimes(1);
    expect(onDemoReadOnly).toHaveBeenCalledTimes(1);

    await run(client, () => Promise.reject(new DemoReadOnlyError("accounts.archive")));
    expect(onDemoReadOnly).toHaveBeenCalledTimes(2);
  });

  it("does not notify for other errors or successful writes", async () => {
    const onDemoReadOnly = vi.fn();
    const client = createQueryClient({ onDemoReadOnly });
    await run(client, () => Promise.reject(new ProviderError("CONFLICT", "in use")));
    await run(client, () => Promise.resolve("ok"));
    expect(onDemoReadOnly).not.toHaveBeenCalled();
  });

  it("an OFFLINE write notifies the offline notice once (not the demo one)", async () => {
    const onDemoReadOnly = vi.fn();
    const onOffline = vi.fn();
    const client = createQueryClient({ onDemoReadOnly, onOffline });
    await run(client, () => Promise.reject(new ProviderError("OFFLINE", "no connection")));
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onDemoReadOnly).not.toHaveBeenCalled();
  });
});
