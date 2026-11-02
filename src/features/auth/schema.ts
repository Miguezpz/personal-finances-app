import { z } from "zod";

/** Messages are i18n keys of the `auth` namespace, translated by the form. */
export const loginSchema = z.object({
  email: z.email({ message: "invalidEmail" }),
  password: z.string().min(1, { message: "passwordRequired" }),
});

export type LoginValues = z.infer<typeof loginSchema>;
