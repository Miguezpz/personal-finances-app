/**
 * Category / subcategory name form (T123, FR-040). Messages are i18n keys of the `settings`
 * namespace. Uniqueness (per user for categories, per parent for subcategories) is checked by
 * the editor against the loaded catalog.
 */
import { z } from "zod";

export const taxonomyNameSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
  macro: z.enum(["needs", "wants"]),
});

export type TaxonomyNameInput = z.input<typeof taxonomyNameSchema>;
export type TaxonomyNameOutput = z.output<typeof taxonomyNameSchema>;
