"use client";

/**
 * Category editor (T123, FR-040, US8-2/US8-4): categories grouped by macro (Needs / Wants) with
 * their subcategories. Create, rename, archive / restore and delete. Deleting is blocked when it
 * would orphan history (a subcategory with movements, a category with subcategories) and the
 * dialog offers archiving instead; the provider enforces the same rule with CONFLICT.
 * Each item has an icon picker (spec 004): categories choose theirs, subcategories inherit their
 * category's unless they get their own.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotifiedGlobally, isProviderError } from "@/data/errors";
import { isCategoryIconKey, resolveTaxonomyIcon } from "@/domain/icons";
import type { Category, SpendBucket, Subcategory } from "@/domain/types";
import { SettingsHeader } from "../SettingsHeader";
import {
  type TaxonomyKind,
  useCreateCategory,
  useCreateSubcategory,
  useRemoveTaxonomy,
  useRenameTaxonomy,
  useSetTaxonomyArchived,
  useSetTaxonomyIcon,
  useTaxonomyCatalog,
} from "./hooks";
import { IconPicker } from "./IconPicker";
import { taxonomyNameSchema, type TaxonomyNameInput, type TaxonomyNameOutput } from "./schema";
import { useTaxonomyName } from "./useTaxonomyName";

type SettingsMessageKey = Parameters<ReturnType<typeof useTranslations<"settings">>>[0];
const MACROS = ["needs", "wants"] as const satisfies readonly SpendBucket[];

type NameDialogState =
  | { mode: "newCategory"; macro: SpendBucket }
  | { mode: "newSubcategory"; category: Category }
  | { mode: "rename"; kind: TaxonomyKind; item: Category | Subcategory };

interface DeleteTarget {
  kind: TaxonomyKind;
  item: Category | Subcategory;
  /** Why it can't be deleted (null = it can). */
  blocked: { reason: "hasMovements"; count: number } | { reason: "hasSubcategories" } | null;
}

export function TaxonomyEditor() {
  const t = useTranslations("settings");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const nameOf = useTaxonomyName();
  const { data } = useTaxonomyCatalog();
  const create = useCreateCategory();
  const createSub = useCreateSubcategory();
  const rename = useRenameTaxonomy();
  const setArchived = useSetTaxonomyArchived();
  const remove = useRemoveTaxonomy();
  const setIcon = useSetTaxonomyIcon();
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const onError = (e: Error) => {
    if (isNotifiedGlobally(e)) return;
    toast.error(isProviderError(e, "CONFLICT") ? t("deleteBlockedToast") : tc("unexpectedError"));
  };
  const saved = { onSuccess: () => toast.success(t("taxonomySaved")), onError };

  /** Names already taken where the new / renamed item would live (stored and shown names). */
  function takenNames(state: NameDialogState): string[] {
    if (!data) return [];
    const siblings: readonly (Category | Subcategory)[] =
      state.mode === "newCategory" || (state.mode === "rename" && state.kind === "category")
        ? data.categories
        : data.subcategories.filter(
            (x) =>
              x.categoryId ===
              (state.mode === "newSubcategory"
                ? state.category.id
                : (state.item as Subcategory).categoryId),
          );
    const self = state.mode === "rename" ? state.item.id : null;
    return siblings.filter((x) => x.id !== self).flatMap((x) => [x.name, nameOf(x)]);
  }

  function onSaveName(state: NameDialogState, values: TaxonomyNameOutput) {
    if (state.mode === "newCategory") {
      create.mutate(
        { name: values.name, nameKey: null, macro: values.macro, archived: false, icon: null },
        saved,
      );
    } else if (state.mode === "newSubcategory") {
      createSub.mutate(
        {
          categoryId: state.category.id,
          name: values.name,
          nameKey: null,
          archived: false,
          icon: null,
        },
        saved,
      );
    } else {
      rename.mutate({ kind: state.kind, id: state.item.id, name: values.name }, saved);
    }
    setNameDialog(null);
  }

  function askDelete(kind: TaxonomyKind, item: Category | Subcategory) {
    if (!data) return;
    const count = kind === "subcategory" ? (data.usage.get(item.id) ?? 0) : 0;
    const hasChildren =
      kind === "category" && data.subcategories.some((x) => x.categoryId === item.id);
    setToDelete({
      kind,
      item,
      blocked:
        count > 0
          ? { reason: "hasMovements", count }
          : hasChildren
            ? { reason: "hasSubcategories" }
            : null,
    });
  }

  function toggleArchived(kind: TaxonomyKind, item: Category | Subcategory) {
    setArchived.mutate(
      { kind, id: item.id, archived: !item.archived },
      {
        onSuccess: () => toast.success(item.archived ? t("restored") : t("archivedToast")),
        onError,
      },
    );
  }

  function confirmDelete() {
    if (!toDelete) return;
    const { kind, item, blocked } = toDelete;
    if (blocked) {
      if (!item.archived) toggleArchived(kind, item);
    } else {
      remove.mutate(
        { kind, id: item.id },
        { onSuccess: () => toast.success(t("deletedToast")), onError },
      );
    }
    setToDelete(null);
  }

  function changeIcon(kind: TaxonomyKind, item: Category | Subcategory, icon: string | null) {
    setIcon.mutate(
      { kind, id: item.id, icon },
      { onSuccess: () => toast.success(t("iconSaved")), onError },
    );
  }

  // Spec 009 (FR-017): the row's actions in one "⋯" menu.
  const itemActions = (kind: TaxonomyKind, item: Category | Subcategory, label: string) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 pointer-coarse:size-11"
          aria-label={tc("actionsFor", { name: label })}
          data-testid="taxonomy-menu"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => setNameDialog({ mode: "rename", kind, item })}
          data-testid="taxonomy-rename"
        >
          <Pencil aria-hidden="true" />
          {t("renameItem", { name: label })}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => toggleArchived(kind, item)}
          data-testid="taxonomy-archive"
        >
          {item.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
          {item.archived ? t("restoreItem", { name: label }) : t("archiveItem", { name: label })}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => askDelete(kind, item)}
          data-testid="taxonomy-delete"
        >
          <Trash2 aria-hidden="true" />
          {t("deleteItem", { name: label })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <section className="flex flex-col gap-6">
      <SettingsHeader
        href="/settings/categories"
        title={t("categoriesTitle")}
        description={t("categoriesDescription")}
        action={
          <Button
            variant="outline"
            onClick={() => setNameDialog({ mode: "newCategory", macro: "needs" })}
            data-testid="add-category"
          >
            <Plus aria-hidden="true" />
            {t("addCategory")}
          </Button>
        }
      />

      {!data ? (
        <Skeleton className="h-96" aria-busy="true" />
      ) : (
        MACROS.map((macro) => {
          const categories = data.categories
            .filter((c) => c.macro === macro)
            .sort(
              (a, b) =>
                Number(a.archived) - Number(b.archived) || nameOf(a).localeCompare(nameOf(b)),
            );
          return (
            <section key={macro} aria-labelledby={`macro-${macro}`} className="flex flex-col gap-3">
              <h2 id={`macro-${macro}`} className="text-lg font-semibold">
                {tb(macro)}
              </h2>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noCategories")}</p>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {categories.map((c) => {
                    const label = nameOf(c);
                    const subs = data.subcategories
                      .filter((x) => x.categoryId === c.id)
                      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
                    return (
                      <li key={c.id}>
                        <Card
                          data-testid="category-card"
                          data-id={c.id}
                          className={c.archived ? "opacity-70" : undefined}
                        >
                          <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base">
                              <IconPicker
                                itemName={label}
                                value={isCategoryIconKey(c.icon) ? c.icon : null}
                                shown={resolveTaxonomyIcon(null, c)}
                                onChange={(icon) => changeIcon("category", c, icon)}
                              />
                              <span className="truncate">{label}</span>
                              {c.archived && (
                                <Badge variant="secondary">{t("archivedBadge")}</Badge>
                              )}
                            </CardTitle>
                            {itemActions("category", c, label)}
                          </CardHeader>
                          <CardContent className="flex flex-col gap-2">
                            <ul className="flex flex-col divide-y">
                              {subs.map((x) => {
                                const subLabel = nameOf(x);
                                const count = data.usage.get(x.id) ?? 0;
                                return (
                                  <li
                                    key={x.id}
                                    data-testid="subcategory-row"
                                    className="flex items-center justify-between gap-2 py-1.5"
                                  >
                                    <IconPicker
                                      itemName={subLabel}
                                      value={isCategoryIconKey(x.icon) ? x.icon : null}
                                      shown={resolveTaxonomyIcon(x, c)}
                                      inherited={resolveTaxonomyIcon(null, c)}
                                      onChange={(icon) => changeIcon("subcategory", x, icon)}
                                    />
                                    <div className="mr-auto flex min-w-0 flex-col">
                                      <span
                                        className={
                                          x.archived
                                            ? "truncate text-sm text-muted-foreground line-through"
                                            : "truncate text-sm"
                                        }
                                      >
                                        {subLabel}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {t("movementCount", { count })}
                                      </span>
                                    </div>
                                    {itemActions("subcategory", x, subLabel)}
                                  </li>
                                );
                              })}
                            </ul>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit"
                              onClick={() => setNameDialog({ mode: "newSubcategory", category: c })}
                              data-testid="add-subcategory"
                            >
                              <Plus aria-hidden="true" />
                              {t("addSubcategory")}
                            </Button>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      {nameDialog && (
        <NameDialog
          key={nameDialog.mode === "rename" ? nameDialog.item.id : nameDialog.mode}
          state={nameDialog}
          takenNames={takenNames(nameDialog)}
          initialName={nameDialog.mode === "rename" ? nameOf(nameDialog.item) : ""}
          parentName={nameDialog.mode === "newSubcategory" ? nameOf(nameDialog.category) : null}
          onCancel={() => setNameDialog(null)}
          onSave={(values) => onSaveName(nameDialog, values)}
        />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toDelete?.blocked ? t("deleteBlockedTitle") : t("deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {!toDelete
                ? null
                : toDelete.blocked?.reason === "hasMovements"
                  ? t("deleteBlockedMovements", { count: toDelete.blocked.count })
                  : toDelete.blocked?.reason === "hasSubcategories"
                    ? t("deleteBlockedChildren")
                    : t("deleteHint", { name: nameOf(toDelete.item) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            {toDelete?.blocked ? (
              !toDelete.item.archived && (
                <Button onClick={confirmDelete} data-testid="archive-instead">
                  <Archive aria-hidden="true" />
                  {t("archiveInstead")}
                </Button>
              )
            ) : (
              <Button variant="destructive" onClick={confirmDelete} data-testid="confirm-delete">
                {t("delete")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface NameDialogProps {
  state: NameDialogState;
  takenNames: readonly string[];
  initialName: string;
  parentName: string | null;
  onCancel: () => void;
  onSave: (values: TaxonomyNameOutput) => void;
}

function NameDialog({
  state,
  takenNames,
  initialName,
  parentName,
  onCancel,
  onSave,
}: NameDialogProps) {
  const t = useTranslations("settings");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const form = useForm<TaxonomyNameInput, unknown, TaxonomyNameOutput>({
    resolver: zodResolver(taxonomyNameSchema),
    defaultValues: {
      name: initialName,
      macro: state.mode === "newCategory" ? state.macro : "needs",
    },
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as SettingsMessageKey) : null);

  function submit(values: TaxonomyNameOutput) {
    const lower = values.name.toLocaleLowerCase();
    if (takenNames.some((n) => n.toLocaleLowerCase() === lower)) {
      form.setError("name", { message: "nameTaken" });
      return;
    }
    onSave(values);
  }

  const title =
    state.mode === "newCategory"
      ? t("addCategory")
      : state.mode === "newSubcategory"
        ? t("addSubcategoryTo", { category: parentName ?? "" })
        : t("rename");

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state.mode === "rename" ? t("renameHint") : t("taxonomyFormHint")}
          </DialogDescription>
        </DialogHeader>
        <form id="taxonomy-form" onSubmit={form.handleSubmit(submit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="taxonomy-name">{t("name")}</FieldLabel>
              <Input id="taxonomy-name" maxLength={60} autoFocus {...form.register("name")} />
              {errors.name && <FieldError>{errorText(errors.name.message)}</FieldError>}
            </Field>
            {state.mode === "newCategory" && (
              <Field>
                <FieldLabel htmlFor="taxonomy-macro">{t("macro")}</FieldLabel>
                <NativeSelect id="taxonomy-macro" {...form.register("macro")}>
                  {MACROS.map((m) => (
                    <NativeSelectOption key={m} value={m}>
                      {tb(m)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="taxonomy-form" data-testid="save-taxonomy">
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
