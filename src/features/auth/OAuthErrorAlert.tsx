"use client";

/**
 * Shows why a Google sign-in failed (002-google-sign-in). Reads `?authError=` once, then cleans the
 * URL so the message doesn't come back on reload. Must render inside <Suspense> (useSearchParams on
 * a prerendered route — research R5).
 */
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { parseOAuthError } from "./oauth-error";

export function OAuthErrorAlert() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code] = useState(() => parseOAuthError(searchParams.get("authError")));

  useEffect(() => {
    if (code) router.replace("/");
  }, [code, router]);

  if (!code) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {code === "not_authorized" ? t("googleNotAuthorized") : t("googleFailed")}
    </p>
  );
}
