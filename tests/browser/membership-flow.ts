import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login } from "./flows";
import type { Credentials } from "./flows";

// Shared UI actions for an isolated mocked backend and a future approved live
// fixture. This helper itself creates no accounts and uses no privileged key.
export async function membershipJourney(
  student: Page,
  staff: Page,
  accounts: { student: Credentials; staff: Credentials },
  studentName: string,
) {
  const membership = student
    .getByRole("heading", { name: "Medlemskap", exact: true })
    .locator("..");
  await test.step("Student applies and sees pending membership after reload", async () => {
    await login(student, accounts.student);
    await expect(membership).toContainText("Ikke medlem");
    const apply = membership.getByRole("button", {
      name: "Søk medlemskap",
      exact: true,
    });
    await apply.focus();
    await expect(apply).toBeFocused();
    await apply.press("Enter");
    await expect(membership).toContainText("Venter på godkjenning");
    await expect(apply).toHaveCount(0);
    await student.reload();
    await expect(membership).toContainText("Venter på godkjenning");
  });
  const memberStatus = staff.getByRole("combobox", {
    name: `Medlemsstatus for ${studentName}`,
    exact: true,
  });
  await test.step("Staff approves an application; the student sees membership without gaining controls", async () => {
    await login(staff, accounts.staff);
    await staff.goto("/#/admin");
    await staff
      .getByRole("button", { name: "Medlemmer og roller", exact: true })
      .click();
    await expect(memberStatus).toHaveValue("pending");
    await memberStatus.selectOption("approved");
    await expect(memberStatus).toHaveValue("approved");
    await student.reload();
    await expect(membership).toContainText("Godkjent medlem");
    await expect(membership.getByRole("combobox")).toHaveCount(0);
    await expect(
      membership.getByRole("button", { name: "Søk medlemskap", exact: true }),
    ).toHaveCount(0);
    await expect(
      student.getByRole("link", { name: "Åpne styreportalen", exact: true }),
    ).toHaveCount(0);
  });
  await test.step("Staff rejects and the student can submit a new application", async () => {
    await memberStatus.selectOption("rejected");
    await expect(memberStatus).toHaveValue("rejected");
    await student.reload();
    await expect(membership).toContainText("Søknad avslått");
    await membership
      .getByRole("button", { name: "Søk medlemskap", exact: true })
      .click();
    await expect(membership).toContainText("Venter på godkjenning");
    await staff.reload();
    await staff
      .getByRole("button", { name: "Medlemmer og roller", exact: true })
      .click();
    await expect(memberStatus).toHaveValue("pending");
  });
}
