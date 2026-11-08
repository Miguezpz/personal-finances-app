"use client";

/**
 * Calculation preferences (T124, FR-041): traffic-light thresholds, paydays, collection lead days,
 * emergency fund months and time zone. Saved to `user_settings`; every derived figure (semáforo,
 * collection alerts, "today") follows at once through the snapshot.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotifiedGlobally } from "@/data/errors";
import { formatBpsAsPercentInput } from "@/domain/parse";
import type { UserSettings } from "@/domain/types";
import { SettingsHeader } from "../SettingsHeader";
import { useSettings, useUpdateSettings } from "./hooks";
import {
  preferencesFormSchema,
  type PreferencesFormInput,
  type PreferencesFormOutput,
} from "./schema";

type SettingsMessageKey = Parameters<ReturnType<typeof useTranslations<"settings">>>[0];

export function PreferencesSettings() {
  const t = useTranslations("settings");
  const { data: settings } = useSettings();
  return (
    <section className="flex flex-col gap-6">
      <SettingsHeader
        href="/settings/preferences"
        title={t("preferencesTitle")}
        description={t("preferencesDescription")}
      />
      {settings ? (
        // Re-mount after a save so the form shows the stored values.
        <PreferencesForm key={JSON.stringify(settings)} settings={settings} />
      ) : (
        <Skeleton className="h-96" aria-busy="true" />
      )}
    </section>
  );
}

function PreferencesForm({ settings }: { settings: UserSettings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const update = useUpdateSettings();
  const timezones = useMemo(() => {
    const all =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes(settings.timezone) ? all : [settings.timezone, ...all];
  }, [settings.timezone]);

  const form = useForm<PreferencesFormInput, unknown, PreferencesFormOutput>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      greenMinBps: formatBpsAsPercentInput(settings.greenMinBps),
      yellowMinBps: formatBpsAsPercentInput(settings.yellowMinBps),
      collectionLeadDays: String(settings.collectionLeadDays),
      emergencyFundMonths: String(settings.emergencyFundMonths),
      firstPayday: String(settings.firstPayday),
      secondPayday: String(settings.secondPayday),
      timezone: settings.timezone,
    },
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as SettingsMessageKey) : null);

  function onSubmit(values: PreferencesFormOutput) {
    update.mutate(values, {
      onSuccess: () => toast.success(t("preferencesSaved")),
      onError: (e) => {
        // In the demo the global toast explains it; show the stored values again.
        if (isNotifiedGlobally(e)) form.reset();
        else toast.error(t("saveFailed"));
      },
    });
  }

  const numberField = (
    name: keyof PreferencesFormInput,
    id: string,
    label: string,
    hint: string,
    suffix?: string,
    integer = false,
  ) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          // Spec 009 (FR-027): whole numbers open the numeric keypad.
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          className="w-24 tabular-nums"
          {...form.register(name)}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {errors[name] ? (
        <FieldError>{errorText(errors[name]?.message)}</FieldError>
      ) : (
        <FieldDescription>{hint}</FieldDescription>
      )}
    </Field>
  );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
      data-testid="preferences-form"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("trafficLight")}</CardTitle>
            <CardDescription>{t("trafficLightHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              {numberField("greenMinBps", "pref-green", t("greenMin"), t("greenMinHint"), "%")}
              {numberField("yellowMinBps", "pref-yellow", t("yellowMin"), t("yellowMinHint"), "%")}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("paydays")}</CardTitle>
            <CardDescription>{t("paydaysHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              {numberField(
                "firstPayday",
                "pref-payday-1",
                t("firstPayday"),
                t("firstPaydayHint"),
                undefined,
                true,
              )}
              {numberField(
                "secondPayday",
                "pref-payday-2",
                t("secondPayday"),
                t("secondPaydayHint"),
                undefined,
                true,
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("planning")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              {numberField(
                "collectionLeadDays",
                "pref-lead",
                t("leadDays"),
                t("leadDaysHint"),
                t("daysUnit"),
                true,
              )}
              {numberField(
                "emergencyFundMonths",
                "pref-fund",
                t("fundMonths"),
                t("fundMonthsHint"),
                t("monthsUnit"),
                true,
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("timezone")}</CardTitle>
            <CardDescription>{t("timezoneHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Field data-invalid={Boolean(errors.timezone)}>
              <FieldLabel htmlFor="pref-timezone" className="sr-only">
                {t("timezone")}
              </FieldLabel>
              <NativeSelect id="pref-timezone" {...form.register("timezone")}>
                {timezones.map((tz) => (
                  <NativeSelectOption key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.timezone && <FieldError>{errorText(errors.timezone.message)}</FieldError>}
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" data-testid="save-preferences">
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
