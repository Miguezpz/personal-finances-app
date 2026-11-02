import { Skeleton } from "@/components/ui/skeleton";

/**
 * Neutral full-page placeholder shown on the server render and the first client render, until
 * preferences are hydrated. It has no text, so it can't flash the wrong language or an amount.
 */
export function BootSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4" aria-busy="true">
      <Skeleton className="h-10 w-full max-w-5xl self-center" />
      <div className="grid w-full max-w-5xl gap-4 self-center sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
