import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const url = process.env.E2E_SUPABASE_URL ?? "";
const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
const enabled =
  !!url && !!key && /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url);
test.describe("real local Supabase student and board workflows", () => {
  test.skip(
    !enabled,
    "Requires a running local Supabase stack and server-only test service key; no mocked auth or API.",
  );
  test("account creation, registration, suggestion, poll vote, board creation and participant management", async ({
    page,
  }) => {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const suffix = randomUUID();
    const studentEmail = `student-${suffix}@example.test`,
      boardEmail = `board-${suffix}@example.test`;
    const ownedUsers: string[] = [];
    const ownedEvents: string[] = [];
    let pollId: string | undefined;
    async function login(page: Page, email: string) {
      await page.goto("/#/logg-inn");
      await page.getByRole("textbox", { name: "E-postadresse" }).fill(email);
      await page.getByRole("button", { name: "Send innloggingslenke" }).click();
      await expect(
        page.getByRole("heading", { name: "Sjekk innboksen din" }),
      ).toBeVisible();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (error) throw error;
      await page
        .getByRole("textbox", { name: "Engangskode (hvis mottatt)" })
        .fill(data.properties.email_otp);
      await page.getByRole("button", { name: "Bekreft kode" }).click();
      await expect(page.getByRole("heading", { name: /Hei,/ })).toBeVisible();
      if (!ownedUsers.includes(data.user.id)) ownedUsers.push(data.user.id);
      return data.user.id;
    }
    try {
      const boardResult = await admin.auth.admin.createUser({
        email: boardEmail,
        email_confirm: true,
      });
      if (boardResult.error) throw boardResult.error;
      const boardId = boardResult.data.user.id;
      ownedUsers.push(boardId);
      const role = await admin
        .from("user_roles")
        .update({ role: "board" })
        .eq("user_id", boardId);
      if (role.error) throw role.error;
      const now = Date.now();
      const fixture = await admin
        .from("events")
        .insert({
          title: `E2E møteplass ${suffix}`,
          description:
            "Et virkelig testarrangement i lokal utviklingsdatabase.",
          starts_at: new Date(now + 7 * 86400000).toISOString(),
          ends_at: new Date(now + 7 * 86400000 + 3600000).toISOString(),
          deadline: new Date(now + 6 * 86400000).toISOString(),
          category: "Sosialt",
          capacity: 10,
          status: "published",
          created_by: boardId,
        })
        .select("id")
        .single();
      if (fixture.error) throw fixture.error;
      ownedEvents.push(fixture.data.id);
      // Student account is first created by the actual OTP form, never an auth mock.
      await login(page, studentEmail);
      await page.goto(`/#/arrangementer/${fixture.data.id}`);
      await page
        .getByRole("button", { name: "Meld meg på / sett meg på venteliste" })
        .click();
      await expect(page.locator(".notice.success")).toContainText(
        "Du er påmeldt!",
      );
      await page.goto("/#/torsdagsbanken?nytt=1");
      await page
        .getByRole("textbox", { name: "Tittel", exact: true })
        .fill(`Bowling ${suffix}`);
      await page
        .getByRole("textbox", { name: "Beskriv ideen" })
        .fill("Vi spiller bowling sammen på torsdag.");
      await page.getByRole("button", { name: "Send inn forslaget" }).click();
      await expect(
        page.getByRole("heading", { name: `Bowling ${suffix}` }),
      ).toBeVisible();
      const poll = await admin
        .from("polls")
        .insert({
          question: `Hva skjer torsdag ${suffix}?`,
          opens_at: new Date(now - 3600000).toISOString(),
          closes_at: new Date(now + 86400000).toISOString(),
          published: true,
        })
        .select("id")
        .single();
      if (poll.error) throw poll.error;
      pollId = poll.data.id;
      const opt = await admin.from("poll_options").insert([
        { poll_id: pollId, label: "Brettspill" },
        { poll_id: pollId, label: "Film" },
      ]);
      if (opt.error) throw opt.error;
      await page.reload();
      await page
        .getByRole("radio", { name: "Brettspill", exact: true })
        .check();
      await page.getByRole("button", { name: "Registrer min stemme" }).click();
      await expect(
        page.getByText("Du har stemt.", { exact: true }),
      ).toBeVisible();
      await page.goto("/#/min-side");
      await page.getByRole("button", { name: "Logg ut", exact: true }).click();
      await login(page, boardEmail);
      await page.goto("/#/admin");
      await page
        .getByRole("button", { name: "Arrangementer", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Nytt arrangement", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("textbox", { name: "Tittel", exact: true })
        .fill(`Styrets test ${suffix}`);
      await dialog.getByLabel("Start (Europe/Oslo)").fill("2027-04-01T18:00");
      await dialog.getByLabel("Slutt (Europe/Oslo)").fill("2027-04-01T21:00");
      await dialog
        .getByLabel("Påmeldingsfrist (Europe/Oslo)")
        .fill("2027-03-31T18:00");
      await dialog.getByRole("button", { name: "Lagre arrangement" }).click();
      await expect(dialog).not.toBeVisible();
      const created = await admin
        .from("events")
        .select("id")
        .eq("title", `Styrets test ${suffix}`)
        .single();
      if (created.error) throw created.error;
      ownedEvents.push(created.data.id);
      await page
        .getByRole("button", { name: "Påmeldinger og lag", exact: true })
        .click();
      await page.getByLabel("Velg arrangement").selectOption(fixture.data.id);
      await page.getByRole("checkbox", { name: /Oppmøte for/ }).check();
      await expect(
        page.getByRole("checkbox", { name: /Oppmøte for/ }),
      ).toBeChecked();
      await page
        .getByRole("button", { name: "Avbestill", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Bekreft", exact: true })
        .click();
      await expect(
        page.getByRole("cell", { name: "Avbestilt", exact: true }),
      ).toBeVisible();
    } finally {
      if (pollId) await admin.from("polls").delete().eq("id", pollId);
      for (const id of ownedEvents)
        await admin.from("events").delete().eq("id", id);
      for (const id of ownedUsers) {
        await admin.from("suggestions").delete().eq("author_id", id);
        await admin.auth.admin.deleteUser(id);
      }
    }
  });
});
