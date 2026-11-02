"use client";

/** Email + password sign-in (T052). Signups are disabled; the owner account comes from Supabase. */
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDataProvider } from "@/data/context";
import { isProviderError } from "@/data/errors";
import { queryKeys } from "@/data/query-keys";
import { loginSchema, type LoginValues } from "./schema";

const APP_HOME = "/dashboard";

export function LoginForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const session = await provider.auth.signIn(values.email, values.password);
      queryClient.setQueryData(queryKeys.session, session);
      router.replace(APP_HOME);
    } catch (e) {
      if (isProviderError(e, "UNAUTHENTICATED")) setFormError(t("invalidCredentials"));
      else if (isProviderError(e, "COLD_START")) setFormError(tc("wakingDatabase"));
      else if (isProviderError(e, "OFFLINE")) setFormError(tc("offline"));
      else setFormError(tc("unexpectedError"));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error?.message && (
                <FieldError>{t(fieldState.error.message as "invalidEmail")}</FieldError>
              )}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error?.message && (
                <FieldError>{t(fieldState.error.message as "passwordRequired")}</FieldError>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
