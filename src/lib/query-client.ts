/**
 * QueryClient factory (T048, research.md R12):
 *  - transient errors (COLD_START / OFFLINE) retry with exponential backoff, up to 4 times;
 *  - any other error fails fast (no retry loops on validation or auth errors);
 *  - mutations never retry (a duplicate write is worse than a visible error);
 *  - a DemoReadOnlyError from ANY mutation calls `onDemoReadOnly` (→ one toast, FR-047);
 *  - a fetch that runs longer than 3 s calls `onWakingChange(true)` ("waking up the database").
 */
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { isDemoReadOnlyError, isTransientError } from "@/data/errors";

export const MAX_TRANSIENT_RETRIES = 4;
export const COLD_START_THRESHOLD_MS = 3_000;

export const retryDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000);

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return isTransientError(error) && failureCount < MAX_TRANSIENT_RETRIES;
}

export interface QueryClientCallbacks {
  onDemoReadOnly?: () => void;
  onWakingChange?: (waking: boolean) => void;
}

export function createQueryClient(callbacks: QueryClientCallbacks = {}): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        // Domain data changes only through this client: no refetch storms on focus.
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isDemoReadOnlyError(error)) callbacks.onDemoReadOnly?.();
      },
    }),
  });
  if (callbacks.onWakingChange) watchSlowQueries(client, callbacks.onWakingChange);
  return client;
}

/**
 * Calls `onChange(true)` once any query has been fetching for longer than `thresholdMs`, and
 * `onChange(false)` when nothing is fetching anymore. Returns an unsubscribe function.
 */
export function watchSlowQueries(
  client: QueryClient,
  onChange: (waking: boolean) => void,
  thresholdMs = COLD_START_THRESHOLD_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waking = false;

  const update = () => {
    const fetching = client.isFetching() > 0;
    if (fetching && timer === undefined && !waking) {
      timer = setTimeout(() => {
        timer = undefined;
        if (client.isFetching() > 0) {
          waking = true;
          onChange(true);
        }
      }, thresholdMs);
    } else if (!fetching) {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (waking) {
        waking = false;
        onChange(false);
      }
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(update);
  return () => {
    unsubscribe();
    if (timer !== undefined) clearTimeout(timer);
  };
}
