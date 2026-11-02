"use client";

/** Route error boundary (T053): never shows a raw error — no amounts or stack traces (Principle V). */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("common");
  return (
    <main
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-semibold">{t("unexpectedError")}</h1>
      <p className="text-muted-foreground">{t("unexpectedErrorHint")}</p>
      <Button variant="outline" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </main>
  );
}
