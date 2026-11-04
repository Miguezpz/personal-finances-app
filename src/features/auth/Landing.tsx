"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { OAuthErrorAlert } from "./OAuthErrorAlert";
import { LoginForm } from "./LoginForm";

interface LandingProps {
  /** Public demo deployment (NEXT_PUBLIC_DEMO_URL); the button is hidden when not configured. */
  demoUrl: string | null;
}

export function Landing({ demoUrl }: LandingProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  return (
    <main className="relative flex flex-1 items-center justify-center bg-gradient-to-b from-surface-highlight to-background px-4 py-10">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <h1 className="text-2xl font-semibold tracking-tight">{tc("appName")}</h1>
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("signInTitle")}</CardTitle>
            <CardDescription>{t("privateApp")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Suspense fallback={null}>
              <OAuthErrorAlert />
            </Suspense>
            <GoogleSignInButton />
            {/* Password sign-in stays as the fallback (002-google-sign-in, FR-001). */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
              <Separator className="flex-1" />
              <span>{t("or")}</span>
              <Separator className="flex-1" />
            </div>
            <LoginForm />
          </CardContent>
        </Card>

        {demoUrl && (
          <div className="flex flex-col items-center gap-2 text-center">
            <Button asChild variant="cta" className="w-full">
              <a href={demoUrl}>
                {t("exploreDemo")}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">{t("exploreDemoHint")}</p>
          </div>
        )}
      </div>
    </main>
  );
}
