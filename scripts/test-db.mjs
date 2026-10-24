import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres@127.0.0.1:55439/postgres";
// This runner creates and removes its own database. Never permit a remote
// connection, even when TEST_DATABASE_URL was inherited from another task.
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error("Database tests require a local PostgreSQL server.");
const database = `pmns_test_${randomUUID().replaceAll("-", "")}`;
const root = new pg.Client({
  connectionString: base,
  connectionTimeoutMillis: 5000,
});
await root.connect();
if (!/^pmns_test_[a-f0-9]{32}$/.test(database))
  throw new Error("Unsafe test database name");
await root.query(`create database "${database}"`);
const url = new URL(base);
url.pathname = `/${database}`;
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
let passed = 0;
async function check(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${label}`);
}
async function as(user, fn, role = "authenticated") {
  const c = new pg.Client({ connectionString: url.toString() });
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    const result = await fn(c);
    await c.query("commit");
    return result;
  } finally {
    await c.query("rollback").catch(() => {});
    await c.end();
  }
}
async function denied(fn, pattern) {
  await assert.rejects(fn, pattern);
}
async function scalar(c, sql, args = []) {
  return (await c.query(sql, args)).rows[0]?.value;
}
const students = Array.from({ length: 25 }, () => randomUUID()),
  board = randomUUID(),
  administrator = randomUUID(),
  event = randomUUID();
try {
  await admin.query(await readFile("tests/db/bootstrap.sql", "utf8"));
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await admin.query("begin");
    try {
      await admin.query(await readFile(`supabase/migrations/${f}`, "utf8"));
      await admin.query("commit");
    } catch (e) {
      await admin.query("rollback");
      throw new Error(`${f}: ${e.message}`, { cause: e });
    }
  }
  await check("migrations apply atomically", async () =>
    assert.equal(
      await scalar(
        admin,
        "select count(*)::int as value from pg_tables where schemaname='public' and not rowsecurity",
      ),
      0,
    ),
  );
  if (process.argv.includes("--registration-readiness")) {
    await check(
      "read-only readiness SQL matches the current migration and permissions",
      async () => {
        const results = await admin.query(
          await readFile("supabase/checks/registration-readiness.sql", "utf8"),
        );
        const rows = results.flatMap((result) => result.rows);
        assert.equal(rows.length, 3);
        for (const row of rows) {
          for (const [name, value] of Object.entries(row)) {
            if (name !== "signature") assert.equal(value, true, name);
          }
        }
      },
    );
  } else if (process.argv.includes("--event-delete")) {
    const { testEventDeletion } = await import("../tests/db/event-delete.mjs");
    await testEventDeletion({ admin, as, scalar, check, denied });
  } else if (process.argv.includes("--account-delete")) {
    const { testAccountDeletion } =
      await import("../tests/db/account-delete.mjs");
    await testAccountDeletion({ admin, as, scalar, check, denied });
  } else if (process.argv.includes("--google-auth")) {
    const { testGoogleRoles } = await import("../tests/db/google-auth.mjs");
    await testGoogleRoles({ admin, as, scalar, check, denied });
  } else if (process.argv.includes("--community")) {
    const { testMembership } = await import("../tests/db/memberships.mjs");
    const { testSuggestions } = await import("../tests/db/suggestions.mjs");
    const { testPolls } = await import("../tests/db/polls.mjs");
    await check(
      "community read-only readiness matches local definitions and grants",
      async () => {
        const results = await admin.query(
          await readFile("supabase/checks/community-readiness.sql", "utf8"),
        );
        const rows = results.flatMap((result) => result.rows);
        assert.equal(rows.length, 3);
        for (const row of rows)
          for (const [name, value] of Object.entries(row))
            if (name !== "signature") assert.equal(value, true, name);
      },
    );
    const context = { admin, as, scalar, check, denied };
    await testMembership(context);
    await testSuggestions(context);
    await testPolls(context);
  } else if (process.argv.includes("--registration")) {
    const { testRegistration } = await import("../tests/db/registration.mjs");
    await testRegistration({ admin, as, scalar, check, denied });
  } else {
    for (const u of [...students, board, administrator])
      await admin.query("insert into auth.users(id,email) values($1,$2)", [
        u,
        `${u}@example.test`,
      ]);
    await admin.query(
      "update public.user_roles set role=case when user_id=$1 then 'board' else 'admin' end where user_id in ($1,$2)",
      [board, administrator],
    );
    const createSql =
      "insert into public.events(id,title,description,starts_at,ends_at,deadline,category,capacity,status,created_by) values($1,'Testarrangement','Integrasjonstest',now()+interval '7 days',now()+interval '7 days 3 hours',now()+interval '6 days','Sosialt',4,'published',$2)";
    await check(
      "signup creates profile, student role and preferences",
      async () => {
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.profiles",
          ),
          27,
        );
        assert.equal(
          await as(students[0], (c) =>
            scalar(c, "select role as value from public.user_roles"),
          ),
          "student",
        );
      },
    );
    await check("student cannot self-promote or create events", async () => {
      await denied(
        () =>
          as(students[0], (c) =>
            c.query(
              "update public.user_roles set role='admin' where user_id=$1",
              [students[0]],
            ),
          ),
        /permission denied/,
      );
      await denied(
        () => as(students[0], (c) => c.query(createSql, [event, students[0]])),
        /row-level security/,
      );
      await denied(
        () =>
          as(students[0], (c) =>
            c.query("select public.set_role($1,'admin')", [students[0]]),
          ),
        /administrator/,
      );
    });
    await check("board creates and edits event", async () => {
      await as(board, (c) => c.query(createSql, [event, board]));
      await as(board, (c) =>
        c.query("update public.events set location='Blindern' where id=$1", [
          event,
        ]),
      );
      assert.equal(
        await scalar(
          admin,
          "select location as value from public.events where id=$1",
          [event],
        ),
        "Blindern",
      );
    });
    await check("drafts are hidden from public and students", async () => {
      await as(board, (c) =>
        c.query("update public.events set status='draft' where id=$1", [event]),
      );
      assert.equal(
        await as(
          null,
          (c) => scalar(c, "select count(*)::int as value from public.events"),
          "anon",
        ),
        0,
      );
      assert.equal(
        await as(students[0], (c) =>
          scalar(c, "select count(*)::int as value from public.events"),
        ),
        0,
      );
      await denied(
        () =>
          as(students[0], (c) =>
            c.query("select public.register_event($1)", [event]),
          ),
        /stengt/,
      );
      await as(board, (c) =>
        c.query("update public.events set status='published' where id=$1", [
          event,
        ]),
      );
    });
    await check("unauthenticated cannot register", async () =>
      denied(
        () =>
          as(
            null,
            (c) => c.query("select public.register_event($1)", [event]),
            "anon",
          ),
        /permission denied/,
      ),
    );
    await check(
      "20 concurrent registrations cannot exceed capacity 4",
      async () => {
        const results = await Promise.all(
          students
            .slice(0, 20)
            .map((u) =>
              as(u, (c) =>
                scalar(c, "select public.register_event($1) as value", [event]),
              ),
            ),
        );
        assert.equal(results.filter((v) => v === "confirmed").length, 4);
        assert.equal(results.filter((v) => v === "waitlisted").length, 16);
      },
    );
    await check("duplicate registration denied atomically", async () =>
      denied(
        () =>
          as(students[0], (c) =>
            c.query("select public.register_event($1)", [event]),
          ),
        /allerede påmeldt/,
      ),
    );
    await check("raw inserts cannot bypass registration capacity", async () =>
      denied(
        () =>
          as(students[20], (c) =>
            c.query(
              "insert into public.event_registrations(event_id,user_id,status) values($1,$2,'confirmed')",
              [event, students[20]],
            ),
          ),
        /permission denied/,
      ),
    );
    await check(
      "private registration rows and dietary cannot be read by peers or anon",
      async () => {
        assert.equal(
          await as(students[0], (c) =>
            scalar(
              c,
              "select count(*)::int as value from public.event_registrations",
            ),
          ),
          1,
        );
        await denied(
          () =>
            as(
              null,
              (c) => c.query("select * from public.event_registrations"),
              "anon",
            ),
          /permission denied/,
        );
      },
    );
    await check(
      "cancellation promotes earliest eligible waitlisted participant",
      async () => {
        const confirmed = (
          await admin.query(
            "select user_id from public.event_registrations where status='confirmed' order by created_at,id limit 1",
          )
        ).rows[0].user_id;
        const next = (
          await admin.query(
            "select user_id from public.event_registrations where status='waitlisted' order by created_at,id limit 1",
          )
        ).rows[0].user_id;
        await as(confirmed, (c) =>
          c.query("select public.cancel_registration($1)", [event]),
        );
        assert.equal(
          await scalar(
            admin,
            "select status as value from public.event_registrations where user_id=$1",
            [next],
          ),
          "confirmed",
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.event_registrations where status='confirmed'",
          ),
          4,
        );
      },
    );
    await check("student cannot cancel another account", async () =>
      denied(
        () =>
          as(students[21], (c) =>
            c.query("select public.cancel_registration($1,$2)", [
              event,
              students[0],
            ]),
          ),
        /Ingen tilgang/,
      ),
    );
    await check(
      "capacity decrease rejected, increase promotes queue",
      async () => {
        await denied(
          () =>
            as(board, (c) =>
              c.query("update public.events set capacity=1 where id=$1", [
                event,
              ]),
            ),
          /Kapasiteten/,
        );
        await as(board, (c) =>
          c.query("update public.events set capacity=6 where id=$1", [event]),
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.event_registrations where status='confirmed'",
          ),
          6,
        );
      },
    );
    const teamEvent = randomUUID();
    await as(board, (c) => c.query(createSql, [teamEvent, board]));
    await as(board, (c) =>
      c.query(
        "update public.events set registration_mode='team',max_team_size=2 where id=$1",
        [teamEvent],
      ),
    );
    await check(
      "team captain creates team; authenticated member joins; maximum enforced",
      async () => {
        await as(students[0], (c) =>
          c.query(
            "select public.register_event($1,'Nøtter',null,'Integraler',true)",
            [teamEvent],
          ),
        );
        const team = await scalar(
          admin,
          "select id as value from public.event_teams where event_id=$1",
          [teamEvent],
        );
        await as(students[1], (c) =>
          c.query("select public.register_event($1,'',$2)", [teamEvent, team]),
        );
        await denied(
          () =>
            as(students[2], (c) =>
              c.query("select public.register_event($1,'',$2)", [
                teamEvent,
                team,
              ]),
            ),
          /Laget er fullt/,
        );
      },
    );
    await check("individual participants accepted in team event", async () =>
      assert.equal(
        await as(students[2], (c) =>
          scalar(c, "select public.register_event($1) as value", [teamEvent]),
        ),
        "confirmed",
      ),
    );
    await check("team discovery exposes no account identities", async () => {
      const rows = await as(students[3], (c) =>
        c.query("select * from public.list_teams($1)", [teamEvent]),
      );
      assert.deepEqual(Object.keys(rows.rows[0]).sort(), [
        "id",
        "members",
        "name",
      ]);
    });
    const suggestion = await as(students[0], (c) =>
      scalar(
        c,
        "select public.submit_suggestion('Bowling','La oss dra på bowling sammen.','Sosialt',null,300,true) as value",
      ),
    );
    await check("anonymous suggestion feed hides author identity", async () => {
      const row = (
        await as(
          null,
          (c) => c.query("select * from public.suggestion_feed()"),
          "anon",
        )
      ).rows[0];
      assert.equal(row.author_name, "Anonym student");
      assert.equal("author_id" in row, false);
      assert.equal(
        await as(students[1], (c) =>
          scalar(c, "select count(*)::int as value from public.suggestions"),
        ),
        0,
      );
    });
    await check("suggestion votes unique; withdrawal works", async () => {
      await as(students[1], (c) =>
        c.query("select public.vote_suggestion($1,true)", [suggestion]),
      );
      await as(students[1], (c) =>
        c.query("select public.vote_suggestion($1,true)", [suggestion]),
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.suggestion_votes",
        ),
        1,
      );
      await as(students[1], (c) =>
        c.query("select public.vote_suggestion($1,false)", [suggestion]),
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.suggestion_votes",
        ),
        0,
      );
    });
    await check("suggestion input validation rejects short text", async () =>
      denied(
        () =>
          as(students[1], (c) =>
            c.query("select public.submit_suggestion('x','kort','Sosialt')"),
          ),
        /check constraint/,
      ),
    );
    await check("moderation restricted to board/admin", async () => {
      await denied(
        () =>
          as(students[1], (c) =>
            c.query("select public.moderate_suggestion($1,'planned',false)", [
              suggestion,
            ]),
          ),
        /Ingen tilgang/,
      );
      await as(board, (c) =>
        c.query("select public.moderate_suggestion($1,'reviewing',false)", [
          suggestion,
        ]),
      );
    });
    const poll = await as(board, (c) =>
      scalar(
        c,
        "select public.create_poll('Hva gjør vi torsdag?',now()-interval '1 hour',now()+interval '1 hour',array['Spill','Film'],true) as value",
      ),
    );
    const option = await scalar(
      admin,
      "select id as value from public.poll_options where poll_id=$1 limit 1",
      [poll],
    );
    await check("poll vote recorded once per account", async () => {
      await as(students[0], (c) =>
        c.query("select public.vote_poll($1,$2)", [poll, option]),
      );
      await denied(
        () =>
          as(students[0], (c) =>
            c.query("select public.vote_poll($1,$2)", [poll, option]),
          ),
        /duplicate key/,
      );
    });
    await check(
      "hidden poll results protected, board may inspect",
      async () => {
        assert.equal(
          (
            await as(
              null,
              (c) => c.query("select * from public.poll_results($1)", [poll]),
              "anon",
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await as(board, (c) =>
              c.query("select * from public.poll_results($1)", [poll]),
            )
          ).rowCount,
          2,
        );
        assert.equal(
          await as(students[1], (c) =>
            scalar(c, "select count(*)::int as value from public.poll_votes"),
          ),
          0,
        );
      },
    );
    await check("poll closing enforced server-side", async () => {
      await as(board, (c) =>
        c.query(
          "update public.polls set closes_at=now()-interval '1 minute' where id=$1",
          [poll],
        ),
      );
      await denied(
        () =>
          as(students[1], (c) =>
            c.query("select public.vote_poll($1,$2)", [poll, option]),
          ),
        /stengt/,
      );
      assert.equal(
        (
          await as(
            null,
            (c) => c.query("select * from public.poll_results($1)", [poll]),
            "anon",
          )
        ).rowCount,
        2,
      );
    });
    await check(
      "membership distinct from registration; self approval denied",
      async () => {
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.memberships",
          ),
          0,
        );
        await as(students[0], (c) =>
          c.query("select public.apply_membership()"),
        );
        assert.equal(
          await scalar(
            admin,
            "select status as value from public.memberships where user_id=$1",
            [students[0]],
          ),
          "pending",
        );
        await denied(
          () =>
            as(students[0], (c) =>
              c.query("select public.manage_member($1,'approved')", [
                students[0],
              ]),
            ),
          /Ingen tilgang/,
        );
        await as(board, (c) =>
          c.query("select public.manage_member($1,'approved')", [students[0]]),
        );
      },
    );
    await check("members-only events reject unapproved students", async () => {
      await as(board, (c) =>
        c.query("update public.events set audience='members' where id=$1", [
          teamEvent,
        ]),
      );
      await denied(
        () =>
          as(students[3], (c) =>
            c.query("select public.register_event($1)", [teamEvent]),
          ),
        /ikke tilgang/,
      );
    });
    await check("only admin manages roles; own role protected", async () => {
      await denied(
        () =>
          as(board, (c) =>
            c.query("select public.set_role($1,'board')", [students[24]]),
          ),
        /administrator/,
      );
      await as(administrator, (c) =>
        c.query("select public.set_role($1,'board')", [students[24]]),
      );
      assert.equal(
        await scalar(
          admin,
          "select role as value from public.user_roles where user_id=$1",
          [students[24]],
        ),
        "board",
      );
      await denied(
        () =>
          as(administrator, (c) =>
            c.query("select public.set_role($1,'student')", [administrator]),
          ),
        /administrator/,
      );
    });
    await check("profile updates cannot modify a peer", async () => {
      const result = await as(students[1], (c) =>
        c.query(
          "update public.profiles set display_name='Forsøk' where id=$1",
          [students[2]],
        ),
      );
      assert.equal(result.rowCount, 0);
      await as(students[1], (c) =>
        c.query(
          "update public.profiles set display_name='Min profil' where id=$1",
          [students[1]],
        ),
      );
      assert.equal(
        await scalar(
          admin,
          "select display_name as value from public.profiles where id=$1",
          [students[1]],
        ),
        "Min profil",
      );
    });
    await check(
      "dietary data requires explicit consent server-side",
      async () => {
        await denied(
          () =>
            as(students[21], (c) =>
              c.query("select public.register_event($1,'Nøtter')", [event]),
            ),
          /samtykke/,
        );
      },
    );
    const restrictedEvent = randomUUID();
    await as(board, (c) => c.query(createSql, [restrictedEvent, board]));
    await check(
      "group eligibility is enforced and staff can manage group links",
      async () => {
        await as(board, (c) =>
          c.query("update public.events set audience='groups' where id=$1", [
            restrictedEvent,
          ]),
        );
        await denied(
          () =>
            as(students[21], (c) =>
              c.query("select public.register_event($1)", [restrictedEvent]),
            ),
          /ikke tilgang/,
        );
        await as(board, (c) =>
          c.query("select public.manage_group('Testgruppe',$1,false,$2)", [
            students[21],
            restrictedEvent,
          ]),
        );
        assert.equal(
          await as(students[21], (c) =>
            scalar(c, "select public.register_event($1) as value", [
              restrictedEvent,
            ]),
          ),
          "confirmed",
        );
        await denied(
          () =>
            as(students[22], (c) =>
              c.query("select public.manage_group('Testgruppe',$1,false,$2)", [
                students[22],
                restrictedEvent,
              ]),
            ),
          /Ingen tilgang/,
        );
      },
    );
    const noQueue = randomUUID();
    await as(board, (c) => c.query(createSql, [noQueue, board]));
    await check(
      "disabled waitlist rejects over-capacity registrations",
      async () => {
        await as(board, (c) =>
          c.query(
            "update public.events set capacity=1,waitlist_enabled=false where id=$1",
            [noQueue],
          ),
        );
        await as(students[20], (c) =>
          c.query("select public.register_event($1)", [noQueue]),
        );
        await denied(
          () =>
            as(students[21], (c) =>
              c.query("select public.register_event($1)", [noQueue]),
            ),
          /fullt/,
        );
      },
    );
    await check(
      "deadline and cancellation status prevent registration",
      async () => {
        await as(board, (c) =>
          c.query(
            "update public.events set deadline=now()-interval '1 hour' where id=$1",
            [noQueue],
          ),
        );
        await denied(
          () =>
            as(students[21], (c) =>
              c.query("select public.register_event($1)", [noQueue]),
            ),
          /stengt/,
        );
        await as(board, (c) =>
          c.query(
            "update public.events set status='cancelled',deadline=now()+interval '1 day' where id=$1",
            [noQueue],
          ),
        );
        await denied(
          () =>
            as(students[21], (c) =>
              c.query("select public.register_event($1)", [noQueue]),
            ),
          /stengt/,
        );
      },
    );
    await check(
      "future polls reject votes and cross-poll options are rejected",
      async () => {
        const future = await as(board, (c) =>
          scalar(
            c,
            "select public.create_poll('Fremtidig avstemning',now()+interval '1 hour',now()+interval '2 hours',array['A','B']) as value",
          ),
        );
        await denied(
          () =>
            as(students[2], (c) =>
              c.query("select public.vote_poll($1,$2)", [future, option]),
            ),
          /stengt/,
        );
        await as(board, (c) =>
          c.query(
            "update public.polls set opens_at=now()-interval '1 hour' where id=$1",
            [future],
          ),
        );
        await denied(
          () =>
            as(students[2], (c) =>
              c.query("select public.vote_poll($1,$2)", [future, option]),
            ),
          /foreign key/,
        );
      },
    );
    await check(
      "storage ownership denies cross-account keys and direct event uploads",
      async () => {
        const own = `${students[1]}/${randomUUID()}.jpg`;
        await as(students[1], (c) =>
          c.query(
            "insert into storage.objects(bucket_id,name) values('avatars',$1)",
            [own],
          ),
        );
        await denied(
          () =>
            as(students[2], (c) =>
              c.query(
                "insert into storage.objects(bucket_id,name) values('avatars',$1)",
                [`${students[1]}/${randomUUID()}.png`],
              ),
            ),
          /row-level security/,
        );
        await denied(
          () =>
            as(board, (c) =>
              c.query(
                "insert into storage.objects(bucket_id,name) values('event-images',$1)",
                [`${board}/${randomUUID()}.png`],
              ),
            ),
          /row-level security/,
        );
      },
    );
    await check(
      "retention job clears dietary data after seven days",
      async () => {
        await admin.query(
          "update public.events set starts_at=now()-interval '10 days',ends_at=now()-interval '9 days',deadline=now()-interval '11 days' where id=$1",
          [teamEvent],
        );
        await as(
          null,
          (c) => c.query("select public.run_maintenance()"),
          "service_role",
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.event_registrations where event_id=$1 and dietary is not null",
            [teamEvent],
          ),
          0,
        );
      },
    );
    await check(
      "personal data export contains own email and no peer registrations",
      async () => {
        const data = await as(students[0], (c) =>
          scalar(c, "select public.export_my_data() as value"),
        );
        assert.ok(data.email.endsWith("@example.test"));
        assert.ok(
          data.event_registrations.every((r) => r.user_id === students[0]),
        );
      },
    );
    await check("event updates create real notifications", async () => {
      await as(board, (c) =>
        c.query("update public.events set location='Nytt rom' where id=$1", [
          event,
        ]),
      );
      assert.ok(
        await scalar(
          admin,
          "select count(*)::int as value from public.notifications where kind='update'",
        ),
      );
    });
    await check("email outbox restricted to service role", async () => {
      await denied(
        () => as(students[0], (c) => c.query("select public.claim_emails()")),
        /permission denied/,
      );
      const batch = await as(
        null,
        (c) => c.query("select * from public.claim_emails()"),
        "service_role",
      );
      assert.ok(batch.rowCount > 0);
    });
    await check(
      "account deletion cascades private records and anonymizes suggestion",
      async () => {
        await admin.query("delete from auth.users where id=$1", [students[0]]);
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.event_registrations where user_id=$1",
            [students[0]],
          ),
          0,
        );
        assert.equal(
          await scalar(
            admin,
            "select author_id as value from public.suggestions where id=$1",
            [suggestion],
          ),
          null,
        );
      },
    );
    await check("last administrator cannot delete their account", async () =>
      denied(
        () =>
          admin.query("delete from auth.users where id=$1", [administrator]),
        /administratorrollen/,
      ),
    );
  }
  console.log(
    `\n${passed} database checks passed against real PostgreSQL (Supabase auth/storage shims).`,
  );
} finally {
  await admin.end();
  await root.query(`drop database "${database}" with (force)`);
  await root.end();
}
