import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export async function testAccountDeletion({
  admin,
  as,
  scalar,
  check,
  denied,
}) {
  const [a, b, last, second, event, suggestion, poll, option, group] =
    Array.from({ length: 9 }, () => randomUUID());
  await check(
    "account-delete readiness matches reviewed guards and grants",
    async () => {
      const results = await admin.query(
        await readFile(
          "supabase/checks/account-deletion-readiness.sql",
          "utf8",
        ),
      );
      const rows = results.flatMap((r) => r.rows);
      assert.equal(rows.length, 4);
      for (const row of rows)
        for (const [key, value] of Object.entries(row))
          if (key !== "signature") assert.equal(value, true, key);
    },
  );
  for (const id of [a, b, last, second])
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@offline.invalid`,
    ]);
  await admin.query(
    "update public.user_roles set role='admin' where user_id=$1",
    [last],
  );
  await check(
    "anonymous preparation is denied and last administrator is blocked twice",
    async () => {
      await denied(
        () =>
          as(
            null,
            (c) => c.query("select public.prepare_account_deletion()"),
            "anon",
          ),
        /permission denied/,
      );
      await denied(
        () =>
          as(last, (c) => c.query("select public.prepare_account_deletion()")),
        /administratorrollen/,
      );
      await denied(
        () => admin.query("delete from auth.users where id=$1", [last]),
        /administratorrollen/,
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from auth.users where id=$1",
          [last],
        ),
        1,
      );
    },
  );
  await check(
    "student can prepare only self and cannot delete through raw SQL or promote roles",
    async () => {
      assert.equal(
        await as(a, (c) =>
          scalar(c, "select public.prepare_account_deletion() as value"),
        ),
        true,
      );
      await denied(
        () =>
          as(a, (c) =>
            c.query("select public.prepare_account_deletion($1)", [b]),
          ),
        /does not exist/,
      );
      await denied(
        () =>
          as(a, (c) => c.query("delete from public.profiles where id=$1", [b])),
        /permission denied/,
      );
      await denied(
        () => as(a, (c) => c.query("select public.set_role($1,'admin')", [a])),
        /administrator/,
      );
    },
  );
  await admin.query(
    "insert into public.events(id,title,starts_at,ends_at,deadline,category,capacity,status,created_by) values($1,'Local deletion test',now()+interval '7 days',now()+interval '8 days',now()+interval '6 days','Sosialt',1,'published',$2)",
    [event, a],
  );
  await as(a, (c) => c.query("select public.register_event($1)", [event]));
  await as(b, (c) => c.query("select public.register_event($1)", [event]));
  await admin.query("insert into public.memberships(user_id) values($1)", [a]);
  const team = randomUUID();
  await admin.query(
    "insert into public.event_teams(id,event_id,name,captain_id) values($1,$2,'Local captain test',$3)",
    [team, event, a],
  );
  await admin.query(
    "insert into public.access_groups(id,name) values($1,'Local deletion group')",
    [group],
  );
  await admin.query(
    "insert into public.group_members(group_id,user_id) values($1,$2)",
    [group, a],
  );
  await admin.query(
    "insert into public.suggestions(id,author_id,title,description,category) values($1,$2,'Local deletion suggestion','Suggestion retained without its author.','Sosialt')",
    [suggestion, a],
  );
  await admin.query(
    "insert into public.suggestion_votes(suggestion_id,user_id) values($1,$2)",
    [suggestion, a],
  );
  await admin.query(
    "insert into public.polls(id,question,opens_at,closes_at) values($1,'Local deletion poll?',now(),now()+interval '1 day')",
    [poll],
  );
  await admin.query(
    "insert into public.poll_options(id,poll_id,label) values($1,$2,'Test choice')",
    [option, poll],
  );
  await admin.query(
    "insert into public.poll_votes(poll_id,option_id,user_id) values($1,$2,$3)",
    [poll, option, a],
  );
  await as(a, (c) =>
    c.query(
      "select public.submit_contact('Local deletion','Disposable contact message')",
    ),
  );
  await admin.query(
    "insert into public.audit_logs(actor_id,action,entity,entity_id) values($1,'local-delete-test','test',$2)",
    [a, a],
  );
  const notificationIds = (
    await admin.query("select id from public.notifications where user_id=$1", [
      a,
    ])
  ).rows.map((r) => r.id);
  assert.ok(notificationIds.length > 0);
  await check(
    "Auth deletion cascades personal rows, anonymizes references and promotes waitlist",
    async () => {
      await admin.query("delete from auth.users where id=$1", [a]);
      for (const [table, column] of [
        ["auth.users", "id"],
        ["public.profiles", "id"],
        ["public.user_roles", "user_id"],
        ["public.memberships", "user_id"],
        ["public.group_members", "user_id"],
        ["public.event_registrations", "user_id"],
        ["public.suggestion_votes", "user_id"],
        ["public.poll_votes", "user_id"],
        ["public.notification_preferences", "user_id"],
        ["public.notifications", "user_id"],
        ["public.contact_submissions", "user_id"],
        ["private.rate_limits", "user_id"],
      ])
        assert.equal(
          await scalar(
            admin,
            `select count(*)::int as value from ${table} where ${column}=$1`,
            [a],
          ),
          0,
          table,
        );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from private.email_outbox where id=any($1::uuid[])",
          [notificationIds],
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
      assert.equal(
        await scalar(
          admin,
          "select created_by as value from public.events where id=$1",
          [event],
        ),
        null,
      );
      assert.equal(
        await scalar(
          admin,
          "select captain_id as value from public.event_teams where id=$1",
          [team],
        ),
        null,
      );
      assert.equal(
        await scalar(
          admin,
          "select actor_id as value from public.audit_logs where entity_id=$1",
          [a],
        ),
        null,
      );
      assert.equal(
        await scalar(
          admin,
          "select status as value from public.event_registrations where event_id=$1 and user_id=$2",
          [event, b],
        ),
        "confirmed",
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from auth.users where id=$1",
          [b],
        ),
        1,
      );
    },
  );
  await check(
    "final deletion guard rechecks a role change after successful preparation",
    async () => {
      await admin.query(
        "update public.user_roles set role='admin' where user_id=$1",
        [second],
      );
      assert.equal(
        await as(last, (c) =>
          scalar(c, "select public.prepare_account_deletion() as value"),
        ),
        true,
      );
      await as(last, (c) =>
        c.query("select public.set_role($1,'student')", [second]),
      );
      await denied(
        () => admin.query("delete from auth.users where id=$1", [last]),
        /administratorrollen/,
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from auth.users where id=$1",
          [last],
        ),
        1,
      );
    },
  );
}
