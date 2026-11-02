"use client";

/** <option>s of every active subcategory, grouped by "Bucket · Category" (for <NativeSelect>). */
import { useTranslations } from "next-intl";
import { NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot } from "@/domain/types";
import { useTaxonomyName } from "./useTaxonomyName";

const selectTaxonomy = (s: FinanceSnapshot) => ({
  categories: s.categories.filter((c) => !c.archived),
  subcategories: s.subcategories.filter((x) => !x.archived),
});

export function useHasSubcategories(): boolean {
  return (useFinanceSnapshot(selectTaxonomy).data?.subcategories.length ?? 0) > 0;
}

export function SubcategoryOptions({ placeholder }: { placeholder: string }) {
  const tb = useTranslations("buckets");
  const nameOf = useTaxonomyName();
  const { data } = useFinanceSnapshot(selectTaxonomy);
  return (
    <>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {(data?.categories ?? []).map((c) => (
        <NativeSelectOptGroup key={c.id} label={`${tb(c.macro)} · ${nameOf(c)}`}>
          {data?.subcategories
            .filter((x) => x.categoryId === c.id)
            .map((x) => (
              <NativeSelectOption key={x.id} value={x.id}>
                {nameOf(x)}
              </NativeSelectOption>
            ))}
        </NativeSelectOptGroup>
      ))}
    </>
  );
}
