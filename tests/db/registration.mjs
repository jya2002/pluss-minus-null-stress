import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Uses the existing disposable PostgreSQL database and real migrations. Auth
// identities are shims; permissions, locks, constraints and transactions are real.
export async function testRegistration({ admin, as, scalar, check, denied }) {
  const students = Array.from({ length: 24 }, () => randomUUID());
  const [a, b, c] = students;
  const board = randomUUID();
  const administrator = randomUUID();
  for (const id of [...students, board, administrator]) {
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@example.test`,
    ]);
  }
  await admin.query(
    "update public.user_roles set role=case when user_id=$1 then 'board' else 'admin' end where user_id in ($1,$2)",
    [board, administrator],
  );
  const register = (user, event) =>
    as(user, (client) =>
      scalar(client, "select public.register_event($1) as value", [event]),
    );
  const cancel = (user, event, target = null) =>
    as(user, (client) =>
      client.query("select public.cancel_registration($1,$2)", [event, target]),
    );
  const status = (user, event) =>
    scalar(
      admin,
      "select status as value from public.event_registrations where event_id=$1 and user_id=$2",
      [event, user],
    );
  async function createEvent() {
    const id = randomUUID();
    await as(board, (client) =>
      client.query(
        "insert into public.events(id,title,starts_at,ends_at,deadline,category,capacity,waitlist_enabled,status,is_demo,created_by) values($1,'Test: påmelding',now()+interval '7 days',now()+interval '7 days 2 hours',now()+interval '6 days','Sosialt',1,true,'published',true,$2)",
        [id, board],
      ),
    );
    return id;
  }
  async function assertCounts(event, confirmed, waitlisted) {
    const counts = (
      await admin.query(
        "select count(*) filter(where status='confirmed')::int as confirmed, count(*) filter(where status='waitlisted')::int as waitlisted from public.event_registrations where event_id=$1",
        [event],
      )
    ).rows[0];
    assert.deepEqual(counts, { confirmed, waitlisted });
  }
  const event = await createEvent();
  await check("capacity 1 and enabled waitlist created by board", async () => {
    const row = (
      await admin.query(
        "select capacity,waitlist_enabled from public.events where id=$1",
        [event],
      )
    ).rows[0];
    assert.deepEqual(row, { capacity: 1, waitlist_enabled: true });
  });
  await check("student A is confirmed and status is persisted", async () => {
    assert.equal(await register(a, event), "confirmed");
    assert.equal(await status(a, event), "confirmed");
  });
  await check("student B is waitlisted and capacity remains 1", async () => {
    assert.equal(await register(b, event), "waitlisted");
    assert.equal(await status(b, event), "waitlisted");
    await assertCounts(event, 1, 1);
  });
  await check(
    "duplicate confirmed and waitlisted registrations rejected",
    async () => {
      for (const user of [a, b]) {
        await denied(() => register(user, event), { code: "23505" });
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.event_registrations where event_id=$1 and user_id=$2",
            [event, user],
          ),
          1,
        );
      }
    },
  );
  await check(
    "student cannot register or cancel another user or forge raw writes",
    async () => {
      await denied(
        () =>
          as(c, (client) =>
            client.query(
              "select public.register_event(p_event => $1, p_user => $2)",
              [event, a],
            ),
          ),
        { code: "42883" },
      );
      await denied(
        () =>
          as(c, (client) =>
            client.query(
              "insert into public.event_registrations(event_id,user_id,status) values($1,$2,'confirmed')",
              [event, a],
            ),
          ),
        { code: "42501" },
      );
      await denied(() => cancel(c, event, a), { code: "42501" });
      for (const sql of [
        "update public.event_registrations set status='cancelled' where event_id=$1 and user_id=$2",
        "delete from public.event_registrations where event_id=$1 and user_id=$2",
      ])
        await denied(() => as(c, (client) => client.query(sql, [event, a])), {
          code: "42501",
        });
      assert.equal(await status(a, event), "confirmed");
    },
  );
  await check(
    "A cancellation automatically confirms B with one promotion notification",
    async () => {
      await cancel(a, event);
      assert.equal(await status(a, event), "cancelled");
      assert.equal(await status(b, event), "confirmed");
      await assertCounts(event, 1, 0);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.notifications where event_id=$1 and user_id=$2 and kind='promotion'",
          [event, b],
        ),
        1,
      );
    },
  );
  await check(
    "re-registration reuses one row and returns to the end of FIFO queue",
    async () => {
      assert.equal(await register(c, event), "waitlisted");
      assert.equal(await register(a, event), "waitlisted");
      await cancel(b, event);
      assert.equal(await status(c, event), "confirmed");
      assert.equal(await status(a, event), "waitlisted");
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.event_registrations where event_id=$1 and user_id=$2",
          [event, a],
        ),
        1,
      );
    },
  );
  await check(
    "registration after deadline rejected without creating a row",
    async () => {
      const expired = await createEvent();
      await as(board, (client) =>
        client.query(
          "update public.events set deadline=clock_timestamp()-interval '1 hour' where id=$1",
          [expired],
        ),
      );
      await denied(() => register(a, expired), /stengt/);
      await assertCounts(expired, 0, 0);
    },
  );
  await check(
    "20 actual concurrent transactions never overbook capacity 1",
    async () => {
      const concurrent = await createEvent();
      const results = await Promise.all(
        students.slice(0, 20).map(async (user) => {
          const result = await register(user, concurrent);
          assert.equal(
            await scalar(
              admin,
              "select count(*)::int as value from public.event_registrations where event_id=$1 and status='confirmed'",
              [concurrent],
            ),
            1,
          );
          return result;
        }),
      );
      assert.equal(results.filter((s) => s === "confirmed").length, 1);
      assert.equal(results.filter((s) => s === "waitlisted").length, 19);
      await assertCounts(concurrent, 1, 19);
    },
  );
  await check(
    "simultaneous duplicate requests leave exactly one active row",
    async () => {
      const concurrent = await createEvent();
      const results = await Promise.allSettled([
        register(a, concurrent),
        register(a, concurrent),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const rejected = results.find((r) => r.status === "rejected");
      assert.equal(rejected.reason.code, "23505");
      await assertCounts(concurrent, 1, 0);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.event_registrations where event_id=$1",
          [concurrent],
        ),
        1,
      );
    },
  );
  await check(
    "concurrent cancellation and new registration preserve queue priority",
    async () => {
      const race = await createEvent();
      await register(a, race);
      await register(b, race);
      await Promise.all([cancel(a, race), register(c, race)]);
      assert.equal(await status(b, race), "confirmed");
      assert.equal(await status(c, race), "waitlisted");
      await assertCounts(race, 1, 1);
    },
  );
  await check(
    "RLS isolates students and denies anonymous private access",
    async () => {
      assert.equal(
        await as(a, (client) =>
          scalar(
            client,
            "select count(*)::int as value from public.event_registrations where user_id<>$1",
            [a],
          ),
        ),
        0,
      );
      assert.equal(
        await as(a, (client) =>
          scalar(
            client,
            "select count(*)::int as value from public.profiles where id<>$1",
            [a],
          ),
        ),
        0,
      );
      await denied(
        () =>
          as(
            null,
            (client) =>
              client.query("select * from public.event_registrations"),
            "anon",
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(
            null,
            (client) =>
              client.query("select public.register_event($1)", [event]),
            "anon",
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(
            null,
            (client) =>
              client.query("select public.cancel_registration($1)", [event]),
            "anon",
          ),
        { code: "42501" },
      );
    },
  );
  await check(
    "board and admin read participants; students cannot elevate or change capacity",
    async () => {
      for (const staff of [board, administrator]) {
        assert.equal(
          await as(staff, (client) =>
            scalar(
              client,
              "select count(*)::int as value from public.event_registrations where event_id=$1",
              [event],
            ),
          ),
          3,
        );
      }
      await denied(
        () =>
          as(a, (client) =>
            client.query(
              "update public.user_roles set role='admin' where user_id=$1",
              [a],
            ),
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(a, (client) =>
            client.query("select public.set_role($1,'admin')", [a]),
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(board, (client) =>
            client.query("select public.set_role($1,'board')", [a]),
          ),
        { code: "42501" },
      );
      assert.equal(
        (
          await as(a, (client) =>
            client.query(
              "update public.events set capacity=999 where id=$1 returning id",
              [event],
            ),
          )
        ).rowCount,
        0,
      );
      assert.equal(
        await scalar(
          admin,
          "select capacity as value from public.events where id=$1",
          [event],
        ),
        1,
      );
      await denied(
        () =>
          as(board, (client) =>
            client.query("update public.events set capacity=0 where id=$1", [
              event,
            ]),
          ),
        /Kapasiteten|check constraint/,
      );
      await as(administrator, (client) =>
        client.query("select public.set_role($1,'board')", [students[23]]),
      );
      assert.equal(
        await scalar(
          admin,
          "select role as value from public.user_roles where user_id=$1",
          [students[23]],
        ),
        "board",
      );
    },
  );
  await check(
    "board can cancel a participant and safely promote the queue",
    async () => {
      await cancel(board, event, c);
      assert.equal(await status(c, event), "cancelled");
      assert.equal(await status(a, event), "confirmed");
      await assertCounts(event, 1, 0);
    },
  );
  await check(
    "capacity increase promotes waiting students and decrease cannot overbook",
    async () => {
      const increased = await createEvent();
      await register(a, increased);
      await register(b, increased);
      await as(board, (client) =>
        client.query("update public.events set capacity=2 where id=$1", [
          increased,
        ]),
      );
      await assertCounts(increased, 2, 0);
      await denied(
        () =>
          as(board, (client) =>
            client.query("update public.events set capacity=1 where id=$1", [
              increased,
            ]),
          ),
        /Kapasiteten/,
      );
      await assertCounts(increased, 2, 0);
    },
  );
  await check(
    "disabled waitlist rejects a second student without storing a row",
    async () => {
      const closed = await createEvent();
      await as(board, (client) =>
        client.query(
          "update public.events set waitlist_enabled=false where id=$1",
          [closed],
        ),
      );
      await register(a, closed);
      await denied(() => register(b, closed), /fullt/);
      await assertCounts(closed, 1, 0);
    },
  );
  async function acrossDeadline(user, expiring, operation) {
    let releaseLock;
    const released = new Promise((resolve) => {
      releaseLock = resolve;
    });
    let lockReady;
    const ready = new Promise((resolve) => {
      lockReady = resolve;
    });
    const locker = as(board, async (client) => {
      await client.query(
        "select id from public.events where id=$1 for update",
        [expiring],
      );
      lockReady();
      await released;
      await client.query(
        "update public.events set deadline=clock_timestamp() where id=$1",
        [expiring],
      );
    });
    await ready;
    let identify;
    const identified = new Promise((resolve) => {
      identify = resolve;
    });
    const pending = as(user, async (client) => {
      const pid = await scalar(client, "select pg_backend_pid() as value");
      identify(pid);
      return client.query(operation, [expiring]);
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    const pid = await identified;
    try {
      const until = Date.now() + 3000;
      while (
        (await scalar(
          admin,
          "select wait_event_type as value from pg_stat_activity where pid=$1",
          [pid],
        )) !== "Lock"
      ) {
        assert.ok(
          Date.now() < until,
          "registration must actually wait for the event lock",
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      releaseLock();
      await locker;
    }
    return pending;
  }
  await check(
    "a request waiting on the event lock must recheck the actual deadline",
    async () => {
      const expiring = await createEvent();
      const result = await acrossDeadline(
        a,
        expiring,
        "select public.register_event($1)",
      );
      assert.match(result.error?.message ?? "", /stengt/);
      await assertCounts(expiring, 0, 0);
    },
  );
  await check(
    "cancellation after lock wait does not promote students past the deadline",
    async () => {
      const expiring = await createEvent();
      await register(a, expiring);
      await register(b, expiring);
      const result = await acrossDeadline(
        a,
        expiring,
        "select public.cancel_registration($1)",
      );
      assert.equal(result.error, undefined);
      assert.equal(await status(a, expiring), "cancelled");
      assert.equal(await status(b, expiring), "waitlisted");
      await assertCounts(expiring, 0, 1);
    },
  );
}
