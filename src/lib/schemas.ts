import { z } from "zod";
import { categories } from "./types";
export const emailSchema = z.object({
  email: z.email("Skriv inn en gyldig e-postadresse."),
});
export const passwordLoginSchema = emailSchema.extend({
  // This is sign-in, not password creation. Supabase enforces password policy.
  // Never trim or transform the password.
  password: z.string().min(1, "Skriv inn passordet."),
});
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export const suggestionSchema = z.object({
  title: z.string().trim().min(3, "Minst 3 tegn.").max(160),
  description: z
    .string()
    .trim()
    .min(10, "Beskriv ideen med minst 10 tegn.")
    .max(3000),
  category: z.enum(categories),
  preferred_date: z.string(),
  budget: z
    .string()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 1000000),
      "Oppgi et helt beløp mellom 0 og 1 000 000.",
    ),
  anonymous: z.boolean(),
});
export type SuggestionInput = z.infer<typeof suggestionSchema>;
export const registrationSchema = z
  .object({
    dietary: z.string().max(500, "Maks 500 tegn."),
    dietaryConsent: z.boolean(),
    team: z.string(),
    teamName: z.string().max(80),
  })
  .refine((v) => v.team !== "new" || v.teamName.trim().length >= 2, {
    message: "Lagnavnet må ha minst 2 tegn.",
    path: ["teamName"],
  })
  .refine((v) => !v.dietary.trim() || v.dietaryConsent, {
    message: "Bekreft samtykke, eller la kosthensyn stå tomt.",
    path: ["dietaryConsent"],
  });
export type RegistrationInput = z.infer<typeof registrationSchema>;
export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Oppgi et visningsnavn.").max(80),
  study_programme: z.string().max(120),
  study_year: z
    .string()
    .refine(
      (v) => v === "" || /^[1-9]$|^10$/.test(v),
      "Velg et studieår mellom 1 og 10.",
    ),
});
export type ProfileInput = z.infer<typeof profileSchema>;
