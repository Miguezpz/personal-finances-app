/**
 * Typed data-layer errors (T026). Re-exported from the contract so callers import from one place.
 */
import { DemoReadOnlyError, ProviderError, type ProviderErrorCode } from "./provider";

export { DemoReadOnlyError, ProviderError, type ProviderErrorCode };

export function isProviderError(error: unknown, code?: ProviderErrorCode): error is ProviderError {
  return error instanceof ProviderError && (code === undefined || error.code === code);
}

export function isDemoReadOnlyError(error: unknown): error is DemoReadOnlyError {
  return error instanceof DemoReadOnlyError;
}

/** Errors worth retrying with backoff: the free-tier database waking up, or a flaky network. */
export function isTransientError(error: unknown): boolean {
  return isProviderError(error, "COLD_START") || isProviderError(error, "OFFLINE");
}

/**
 * Errors the app reports once, globally (read-only demo toast, offline toast): forms and buttons
 * stay quiet about them instead of adding a second "couldn't save" message.
 */
export function isNotifiedGlobally(error: unknown): boolean {
  return isDemoReadOnlyError(error) || isProviderError(error, "OFFLINE");
}
