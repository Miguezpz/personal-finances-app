"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";

interface LandingProps {
  /** Public demo deployment (NEXT_PUBLIC_DEMO_URL); the button is hidden when not configured. */
  demoUrl: string | null;
}

export function Landing({ demoUrl }: LandingProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{tc("appName")}</h1>
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("signInTitle")}</CardTitle>
            <CardDescription>{t("privateApp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {demoUrl && (
          <div className="flex flex-col items-center gap-2 text-center">
            <Button asChild variant="outline" className="w-full">
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
