/**
 * Category / subcategory name form (T123, FR-040). Messages are i18n keys of the `settings`
 * namespace. Uniqueness (per user for categories, per parent for subcategories) is checked by
 * the editor against the loaded catalog.
 */
import { z } from "zod";
import { type CategoryIconKey, isCategoryIconKey } from "@/domain/icons";

export const taxonomyNameSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
  macro: z.enum(["needs", "wants"]),
});

export type TaxonomyNameInput = z.input<typeof taxonomyNameSchema>;
export type TaxonomyNameOutput = z.output<typeof taxonomyNameSchema>;

/**
 * Icon chosen in the picker (spec 004, FR-012): a key of the curated set, or null to clear a
 * subcategory's own icon (it inherits its category's again).
 */
export const taxonomyIconSchema = z.union([
  z.null(),
  z
    .string()
    .refine(isCategoryIconKey, "invalidIcon")
    .transform((v) => v as CategoryIconKey),
]);
