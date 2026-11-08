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

export function PageQueryState({
  status,
  skeleton,
  children,
}: {
  status: QueryStatus;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  if (status.isError)
    return (
      <Alert variant="destructive" data-testid="page-error">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{tc("unexpectedError")}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {tc("loadError")}
          <Button variant="outline" size="sm" onClick={status.refetch} data-testid="page-retry">
            {tc("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (status.isPending) return <>{skeleton}</>;
  return <>{children}</>;
}
