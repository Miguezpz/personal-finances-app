import { DemoReadOnlyError } from "../provider";

/**
 * Every write in the demo goes through here (T038, FR-047). Async so callers get a rejected
 * promise, exactly like a failing network write; the global MutationCache turns it into a toast.
 */
export async function denyWrite(name: string): Promise<never> {
  throw new DemoReadOnlyError(name);
}
