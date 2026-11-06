"use client";

/**
 * <option>s of the accounts that can pay something, grouped by kind — cash first, then cards,
 * debit, savings and investment — and sorted by name inside each group (for <NativeSelect>).
 * The provider returns accounts in an arbitrary order (by id), which buried "Efectivo" in a list
 * of a dozen accounts.
 */
import { useTranslations } from "next-intl";
import { NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { Account, AccountKind } from "@/domain/types";
import { selectLocale, usePreferences } from "@/store/preferences";

const KIND_ORDER: readonly AccountKind[] = [
  "cash",
  "credit_card",
  "checking",
  "savings",
  "investment",
];

/** Non-empty groups in display order, each sorted by name (pure; exported for tests). */
export function groupPaymentAccounts<T extends Pick<Account, "kind" | "name">>(
  accounts: readonly T[],
  locale: string,
): { kind: AccountKind; accounts: T[] }[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    accounts: accounts
      .filter((a) => a.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" })),
  })).filter((g) => g.accounts.length > 0);
}

export function PaymentAccountOptions({
  accounts,
  placeholder,
}: {
  accounts: readonly Account[];
  placeholder: string;
}) {
  const t = useTranslations("settings");
  const locale = usePreferences(selectLocale);
  return (
    <>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {groupPaymentAccounts(accounts, locale).map((g) => (
        <NativeSelectOptGroup key={g.kind} label={t(`kindGroups.${g.kind}`)}>
          {g.accounts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ))}
    </>
  );
}
