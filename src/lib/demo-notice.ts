/**
 * Bridge between the QueryClient (created outside React) and the translated toast shown when the
 * read-only demo rejects a write (FR-047). The UI registers the notifier; the MutationCache calls it.
 */
let notifier: (() => void) | null = null;

export function setDemoReadOnlyNotifier(fn: (() => void) | null): void {
  notifier = fn;
}

export function notifyDemoReadOnly(): void {
  notifier?.();
}
