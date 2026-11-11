"use client";

/**
 * Read-only demo notice (T134, FR-046/047): always visible while the data provider can't write
 * (the public demo with fictitious data), with a link to the source code for recruiters. Brand colors
 * (bg-primary / text-primary-foreground): lime with near-black text in neon, teal/emerald elsewhere.
 */
import { ExternalLink, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCanWrite } from "@/data/context";
import { REPO_URL } from "@/lib/site";

export function DemoBanner() {
  const t = useTranslations("demo");
  const canWrite = useCanWrite();
  if (canWrite) return null;
  return (
    <aside
      aria-label={t("label")}
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
      data-testid="demo-banner"
    >
      <span className="flex items-center gap-2">
        <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
        <span className="sm:hidden">{t("bannerShort")}</span>
        <span className="hidden sm:inline">{t("banner")}</span>
      </span>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-sm font-semibold underline decoration-current/60 underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:outline-none"
      >
        {t("sourceCode")}
        <ExternalLink aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{t("opensInNewTab")}</span>
      </a>
    </aside>
  );
}
