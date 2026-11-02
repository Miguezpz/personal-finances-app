/**
 * TanStack Query keys (T027). `snapshot` is the ONLY key for domain data (research.md R17):
 * every aggregate hook is a selector over it and every mutation updates it.
 */
export const queryKeys = {
  snapshot: ["snapshot"] as const,
  fx: ["fx"] as const,
  session: ["session"] as const,
} as const;
