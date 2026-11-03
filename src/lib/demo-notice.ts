/**
 * Bridge between the QueryClient (created outside React) and the translated toasts shown when a
 * write can't happen: the read-only demo (FR-047) or no connection. The UI registers the
 * notifiers; the MutationCache calls them.
 */
let demoNotifier: (() => void) | null = null;
let offlineNotifier: (() => void) | null = null;

export function setDemoReadOnlyNotifier(fn: (() => void) | null): void {
  demoNotifier = fn;
}

export function notifyDemoReadOnly(): void {
  demoNotifier?.();
}

export function setOfflineNotifier(fn: (() => void) | null): void {
  offlineNotifier = fn;
}

export function notifyOffline(): void {
  offlineNotifier?.();
}
