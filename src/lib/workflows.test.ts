import { describe, expect, it } from "vitest";
import {
  emailSchema,
  profileSchema,
  registrationSchema,
  suggestionSchema,
} from "./schemas";
import {
  csvCell,
  dateLabel,
  fromOsloInput,
  osloInput,
  timeLabel,
} from "./utils";
import { demoEvents } from "./demo";
describe("validering", () => {
  it("godtar e-post og avviser ugyldig innlogging", () => {
    expect(
      emailSchema.safeParse({ email: "student@example.test" }).success,
    ).toBe(true);
    expect(emailSchema.safeParse({ email: "ikke epost" }).success).toBe(false);
  });
  it("krever beskrivelse og begrenset budsjett for forslag", () => {
    const value = {
      title: "Bowling",
      description: "La oss spille bowling sammen.",
      category: "Sosialt",
      preferred_date: "",
      budget: "300",
      anonymous: true,
    };
    expect(suggestionSchema.safeParse(value).success).toBe(true);
    expect(suggestionSchema.safeParse({ ...value, budget: "-1" }).success).toBe(
      false,
    );
    expect(
      suggestionSchema.safeParse({ ...value, description: "x" }).success,
    ).toBe(false);
  });
  it("krever lagnavn bare når nytt lag opprettes", () => {
    expect(
      registrationSchema.safeParse({
        dietary: "",
        dietaryConsent: false,
        team: "new",
        teamName: "",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        dietary: "",
        dietaryConsent: false,
        team: "",
        teamName: "",
      }).success,
    ).toBe(true);
  });
  it("samler minimalt med profilopplysninger", () => {
    expect(
      profileSchema.safeParse({
        display_name: "Student",
        study_programme: "",
        study_year: "",
      }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({
        display_name: "Student",
        study_programme: "",
        study_year: "11",
      }).success,
    ).toBe(false);
  });
});
describe("Oslo-tid", () => {
  it("viser Quiz & Kaos 5. november kl. 18", () => {
    expect(dateLabel(demoEvents[0].starts_at)).toBe("5. november");
    expect(timeLabel(demoEvents[0].starts_at)).toBe("18:00");
    expect(demoEvents[0].status).toBe("draft");
  });
  it("konverterer vinter og sommer uavhengig av nettlesertidssone", () => {
    expect(fromOsloInput("2026-11-05T18:00")).toBe("2026-11-05T17:00:00.000Z");
    expect(fromOsloInput("2026-07-05T18:00")).toBe("2026-07-05T16:00:00.000Z");
    expect(osloInput("2026-11-05T17:00:00Z")).toBe("2026-11-05T18:00");
  });
  it("avviser tidsrom som forsvinner eller gjentas ved DST", () => {
    expect(() => fromOsloInput("2026-03-29T02:30")).toThrow();
    expect(() => fromOsloInput("2026-10-25T02:30")).toThrow();
  });
});
describe("sikker CSV", () => {
  it("siterer skilletegn og beskytter mot regnearkformler", () => {
    expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
    expect(csvCell("Navn;med separator")).toBe('"Navn;med separator"');
  });
});
