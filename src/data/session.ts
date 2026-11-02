"use client";

/**
 * Auth session in the cache (queryKeys.session).
 *  - useSession(): read it (any number of components).
 *  - useAuthSync(): subscribe to auth changes ONCE (mounted by the app shell).
 * Domain data is only fetched while a session exists (see useFinanceSnapshot), so signing out
 * never fires unauthenticated requests.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDataProvider } from "./context";
import type { AuthSession } from "./provider";
import { queryKeys } from "./query-keys";

export function useSession() {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => provider.auth.getSession(),
    staleTime: Infinity,
  });
}

export function useAuthSync() {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  useEffect(
    () =>
      provider.auth.onChange((session) => {
        queryClient.setQueryData<AuthSession | null>(queryKeys.session, session);
        // Signed out (or another user): drop the previous user's data. The snapshot query is
        // disabled without a session, so this doesn't trigger a refetch.
        if (!session) queryClient.removeQueries({ queryKey: queryKeys.snapshot });
      }),
    [provider, queryClient],
  );
}
