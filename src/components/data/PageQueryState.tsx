"use client";

/**
 * A page's three states (spec 009, FR-014): its skeleton while the data loads, a recoverable error
 * with "Retry" when the load fails (instead of an endless skeleton), and the content otherwise.
 */
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface QueryStatus {
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/** The error state on its own, for pages whose skeleton/content branches are already inline. */
export function PageLoadError({ onRetry }: { onRetry: () => void }) {
  const tc = useTranslations("common");
  return (
    <Alert variant="destructive" data-testid="page-error">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{tc("unexpectedError")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        {tc("loadError")}
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="page-retry">
          {tc("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function PageQueryState({
  status,
  skeleton,
  children,
}: {
  status: QueryStatus;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (status.isError) return <PageLoadError onRetry={status.refetch} />;
  if (status.isPending) return <>{skeleton}</>;
  return <>{children}</>;
}
