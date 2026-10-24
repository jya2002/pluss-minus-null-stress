import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Runs only inside scripts/test-db.mjs's disposable loopback database.
export async function testEventDeletion({ admin, as, scalar, check, denied }) {
  const [student, board, administrator, group] = Array.from(
    { length: 4 },
    randomUUID,
  );
  const title = "Utkast: blåbær & «quiz»";
  for (const id of [student, board, administrator])
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@offline.invalid`,
    ]);
  await admin.query(
    "update public.user_roles set role='board' where user_id=$1",
    [board],
  );
  await admin.query(
    "update public.user_roles set role='admin' where user_id=$1",
    [administrator],
  );
  await admin.query(
    "insert into public.access_groups(id,name) values($1,'Local deletion group')",
    [group],
  );
  async function draft(status = "draft", image = null) {
    const id = randomUUID();
    await as(administrator, (c) =>
      c.query(
        "insert into public.events(id,title,starts_at,ends_at,deadline,category,capacity,status,created_by,image_path) values($1,$2,now()+interval '7 days',now()+interval '8 days',now()+interval '6 days','Sosialt',2,$3,$4,$5)",
        [id, title, status, administrator, image],
      ),
    );
    return id;
  }
  const remove = (id, confirmation = title, user = administrator) =>
    as(user, (c) =>
      scalar(c, "select public.delete_draft_event($1,$2) as value", [
        id,
        confirmation,
      ]),
    );
  const exists = (id) =>
    scalar(
      admin,
      "select exists(select 1 from public.events where id=$1) as value",
      [id],
    );
  const deletions = (id) =>
    scalar(
      admin,
      "select count(*)::int as value from public.audit_logs where entity='events' and entity_id=$1 and action='DELETE'",
      [id],
    );

  await check(
    "all current event FK dependencies are covered by the deletion guard",
    async () => {
      const tables = (
        await admin.query(
          "select distinct conrelid::regclass::text as name from pg_constraint where confrelid='public.events'::regclass and contype='f' order by name",
        )
      ).rows.map((r) => r.name.replace(/^public\./, ""));
      assert.deepEqual(tables, [
        "event_access_groups",
        "event_registrations",
        "event_teams",
        "notifications",
      ]);
      assert.equal(
        await scalar(
          admin,
          "select has_table_privilege('authenticated','public.events','DELETE') as value",
        ),
        false,
      );
      assert.equal(
        await scalar(
          admin,
          "select has_function_privilege('anon','public.delete_draft_event(uuid,text)','EXECUTE') as value",
        ),
        false,
      );
    },
  );
  await check(
    "anonymous users, students and board members cannot delete; even admins have no raw DELETE grant",
    async () => {
      const id = await draft();
      await denied(
        () =>
          as(
            null,
            (c) =>
              c.query("select public.delete_draft_event($1,$2)", [id, title]),
            "anon",
          ),
        { code: "42501" },
      );
      for (const user of [student, board])
        await denied(() => remove(id, title, user), { code: "42501" });
      await denied(
        () =>
          as(administrator, (c) =>
            c.query("delete from public.events where id=$1", [id]),
          ),
        { code: "42501" },
      );
      assert.equal(await exists(id), true);
      assert.equal(await deletions(id), 0);
    },
  );
  await check(
    "administrator deletes only the empty draft, logs actor/id/time, and preserves shared Storage metadata",
    async () => {
      const image = `${board}/${randomUUID()}.png`;
      await admin.query(
        "insert into storage.objects(bucket_id,name) values('event-images',$1)",
        [image],
      );
      const id = await draft("draft", image),
        sibling = await draft("draft", image);
      assert.equal(await remove(id), id);
      assert.equal(await exists(id), false);
      assert.equal(await exists(sibling), true);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from storage.objects where bucket_id='event-images' and name=$1",
          [image],
        ),
        1,
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.audit_logs where actor_id=$1 and entity='events' and entity_id=$2 and action='DELETE' and created_at is not null",
          [administrator, id],
        ),
        1,
      );
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.audit_logs where entity='events' and entity_id=$1 and action='INSERT'",
          [id],
        ),
        1,
      );
    },
  );
  await check(
    "exact title is required server-side, including case and whitespace; missing events are rejected",
    async () => {
      const id = await draft();
      for (const input of [
        null,
        "",
        title.toUpperCase(),
        ` ${title}`,
        `${title} `,
      ])
        await denied(() => remove(id, input), { code: "22023" });
      await denied(() => remove(randomUUID()), { code: "P0002" });
      assert.equal(await exists(id), true);
      assert.equal(await deletions(id), 0);
    },
  );
  for (const status of ["published", "cancelled"])
    await check(`${status} events cannot be permanently deleted`, async () => {
      const id = await draft(status);
      await denied(() => remove(id), { code: "22023" });
      assert.equal(await exists(id), true);
      assert.equal(await deletions(id), 0);
    });
  for (const status of ["confirmed", "waitlisted", "cancelled"])
    await check(`draft with ${status} registration is preserved`, async () => {
      const id = await draft();
      await admin.query(
        "insert into public.event_registrations(event_id,user_id,status) values($1,$2,$3)",
        [id, student, status],
      );
      await denied(() => remove(id), { code: "23503" });
      assert.equal(await exists(id), true);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.event_registrations where event_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(await deletions(id), 0);
    });
  await check("even an empty team blocks deletion", async () => {
    const id = await draft();
    await admin.query(
      "insert into public.event_teams(event_id,name) values($1,'Empty test team')",
      [id],
    );
    await denied(() => remove(id), { code: "23503" });
    assert.equal(
      await scalar(
        admin,
        "select count(*)::int as value from public.event_teams where event_id=$1",
        [id],
      ),
      1,
    );
  });
  await check(
    "notifications and private outbox are preserved when deletion is blocked",
    async () => {
      const id = await draft();
      await admin.query(
        "select private.notify($1,$2,'update','Local test','Preserve this notification')",
        [student, id],
      );
      await denied(() => remove(id), { code: "23503" });
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.notifications n join private.email_outbox o on o.id=n.id where n.event_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(await exists(id), true);
    },
  );
  await check(
    "group links block deletion without changing the group or link",
    async () => {
      const id = await draft();
      await admin.query(
        "insert into public.event_access_groups(event_id,group_id) values($1,$2)",
        [id, group],
      );
      await denied(() => remove(id), { code: "23503" });
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.event_access_groups where event_id=$1 and group_id=$2",
          [id, group],
        ),
        1,
      );
    },
  );
  await check(
    "event deletion and audit insert roll back together",
    async () => {
      const id = await draft();
      await denied(
        () =>
          as(administrator, async (c) => {
            await c.query("select public.delete_draft_event($1,$2)", [
              id,
              title,
            ]);
            throw new Error("Intentional local transaction abort");
          }),
        /Intentional local/,
      );
      assert.equal(await exists(id), true);
      assert.equal(await deletions(id), 0);
    },
  );

  await check(
    "a database trigger that suppresses DELETE cannot produce false success or a deletion audit",
    async () => {
      const id = await draft();
      await admin.query(
        "create function private.local_suppress_event_delete() returns trigger language plpgsql as $$ begin return null; end $$",
      );
      await admin.query(
        "create trigger local_suppress_event_delete before delete on public.events for each row execute function private.local_suppress_event_delete()",
      );
      try {
        await denied(() => remove(id), { code: "40001" });
        assert.equal(await exists(id), true);
        assert.equal(await deletions(id), 0);
      } finally {
        await admin.query(
          "drop trigger local_suppress_event_delete on public.events",
        );
        await admin.query(
          "drop function private.local_suppress_event_delete()",
        );
      }
    },
  );

  // Deterministic barriers + pg_blocking_pids assert that real row/FK locks
  // actually block the competing transaction; no timing-only race assertions.
  const gate = () => {
    let open;
    const promise = new Promise((resolve) => {
      open = resolve;
    });
    return { promise, open };
  };
  async function blocked(pid) {
    const until = Date.now() + 5000;
    do {
      if (
        await scalar(
          admin,
          "select cardinality(pg_blocking_pids($1))>0 as value",
          [pid],
        )
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < until);
    assert.fail("Expected database lock was not observed");
  }
  const outcome = (promise) =>
    promise.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );

  await check(
    "concurrent FK insert before deletion lock commits safely and makes deletion fail",
    async () => {
      const id = await draft(),
        ready = gate(),
        release = gate(),
        deleting = gate();
      const writer = outcome(
        as(
          null,
          async (c) => {
            await c.query(
              "insert into public.notifications(user_id,event_id,kind,subject,body) values($1,$2,'update','Local concurrent test','Must survive')",
              [student, id],
            );
            ready.open();
            await release.promise;
          },
          "service_role",
        ),
      );
      await ready.promise;
      let pid;
      const deletion = outcome(
        as(administrator, async (c) => {
          pid = await scalar(c, "select pg_backend_pid() as value");
          deleting.open();
          return scalar(c, "select public.delete_draft_event($1,$2) as value", [
            id,
            title,
          ]);
        }),
      );
      await deleting.promise;
      try {
        await blocked(pid);
      } finally {
        release.open();
      }
      assert.equal((await writer).error, undefined);
      assert.equal((await deletion).error?.code, "23503");
      assert.equal(await exists(id), true);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.notifications where event_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(await deletions(id), 0);
    },
  );
  await check(
    "FK insert after deletion waits and fails instead of losing child data through cascade",
    async () => {
      const id = await draft(),
        ready = gate(),
        release = gate(),
        inserting = gate();
      const deletion = outcome(
        as(administrator, async (c) => {
          const deleted = await scalar(
            c,
            "select public.delete_draft_event($1,$2) as value",
            [id, title],
          );
          ready.open();
          await release.promise;
          return deleted;
        }),
      );
      await ready.promise;
      let pid;
      const writer = outcome(
        as(
          null,
          async (c) => {
            pid = await scalar(c, "select pg_backend_pid() as value");
            inserting.open();
            return c.query(
              "insert into public.notifications(user_id,event_id,kind,subject,body) values($1,$2,'update','Late local test','Must be rejected')",
              [student, id],
            );
          },
          "service_role",
        ),
      );
      await inserting.promise;
      try {
        await blocked(pid);
      } finally {
        release.open();
      }
      assert.equal((await deletion).value, id);
      assert.equal((await writer).error?.code, "23503");
      assert.equal(await exists(id), false);
      assert.equal(await deletions(id), 1);
    },
  );
  for (const change of ["published", "renamed"])
    await check(
      `concurrent ${change} update is rechecked after acquiring the event lock`,
      async () => {
        const id = await draft(),
          ready = gate(),
          release = gate(),
          deleting = gate();
        const writer = outcome(
          as(board, async (c) => {
            await c.query(
              change === "published"
                ? "update public.events set status='published' where id=$1"
                : "update public.events set title='Changed concurrently' where id=$1",
              [id],
            );
            ready.open();
            await release.promise;
          }),
        );
        await ready.promise;
        let pid;
        const deletion = outcome(
          as(administrator, async (c) => {
            pid = await scalar(c, "select pg_backend_pid() as value");
            deleting.open();
            return scalar(
              c,
              "select public.delete_draft_event($1,$2) as value",
              [id, title],
            );
          }),
        );
        await deleting.promise;
        try {
          await blocked(pid);
        } finally {
          release.open();
        }
        assert.equal((await writer).error, undefined);
        assert.equal((await deletion).error?.code, "22023");
        assert.equal(await exists(id), true);
        assert.equal(await deletions(id), 0);
      },
    );
  await check(
    "simultaneous deletion requests delete and audit exactly once",
    async () => {
      const id = await draft();
      const results = await Promise.allSettled([remove(id), remove(id)]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.find((r) => r.status === "rejected").reason.code,
        "P0002",
      );
      assert.equal(await deletions(id), 1);
    },
  );
}
