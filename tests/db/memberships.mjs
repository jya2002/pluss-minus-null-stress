import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Disposable local PostgreSQL only. Auth identities are test shims; SQL,
// constraints, grants, RLS and checked RPCs execute without API simulation.
export async function testMembership({ admin, as, scalar, check, denied }) {
  const student = randomUUID();
  const peer = randomUUID();
  const automatic = randomUUID();
  const board = randomUUID();
  const administrator = randomUUID();
  for (const id of [student, peer, automatic, board, administrator]) {
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@example.test`,
    ]);
  }
  await admin.query(
    "update public.user_roles set role=case when user_id=$1 then 'board' else 'admin' end where user_id in ($1,$2)",
    [board, administrator],
  );
  const apply = (user) =>
    as(user, (client) => client.query("select public.apply_membership()"));
  const manage = (actor, user, status) =>
    as(actor, (client) =>
      client.query("select public.manage_member($1,$2)", [user, status]),
    );
  const status = (user) =>
    scalar(
      admin,
      "select status as value from public.memberships where user_id=$1",
      [user],
    );
  const initialApproval = await scalar(
    admin,
    "select membership_approval as value from public.site_settings",
  );
  try {
    await admin.query(
      "update public.site_settings set membership_approval=true",
    );
    await check("membership: signup does not imply membership", async () => {
      assert.equal(await status(student), undefined);
    });
    await check(
      "membership: student applies and reads pending status",
      async () => {
        await apply(student);
        const own = await as(student, (client) =>
          client.query(
            "select user_id,status,joined_at from public.memberships",
          ),
        );
        assert.equal(own.rows.length, 1);
        assert.equal(own.rows[0].user_id, student);
        assert.equal(own.rows[0].status, "pending");
        assert.ok(own.rows[0].joined_at instanceof Date);
      },
    );
    await check(
      "membership: pending duplicate rejected without another row",
      async () => {
        await denied(() => apply(student), /allerede/);
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.memberships where user_id=$1",
            [student],
          ),
          1,
        );
      },
    );
    await check(
      "membership: RLS hides a peer's membership from students and anonymous visitors",
      async () => {
        assert.equal(
          await as(peer, (client) =>
            scalar(
              client,
              "select count(*)::int as value from public.memberships where user_id=$1",
              [student],
            ),
          ),
          0,
        );
        await denied(
          () =>
            as(
              null,
              (client) => client.query("select * from public.memberships"),
              "anon",
            ),
          { code: "42501" },
        );
        await denied(
          () =>
            as(
              null,
              (client) => client.query("select public.apply_membership()"),
              "anon",
            ),
          { code: "42501" },
        );
      },
    );
    await check(
      "membership: students cannot forge applications or approve themselves or peers",
      async () => {
        await denied(
          () =>
            as(peer, (client) =>
              client.query(
                "insert into public.memberships(user_id,status) values($1,'approved')",
                [peer],
              ),
            ),
          { code: "42501" },
        );
        for (const target of [student, peer]) {
          await denied(() => manage(student, target, "approved"), {
            code: "42501",
          });
          await denied(
            () =>
              as(student, (client) =>
                client.query(
                  "update public.memberships set status='approved' where user_id=$1",
                  [target],
                ),
              ),
            { code: "42501" },
          );
          await denied(
            () =>
              as(student, (client) =>
                client.query(
                  "delete from public.memberships where user_id=$1",
                  [target],
                ),
              ),
            { code: "42501" },
          );
        }
        await denied(
          () =>
            as(student, (client) =>
              client.query("select public.apply_membership(p_user => $1)", [
                peer,
              ]),
            ),
          { code: "42883" },
        );
        assert.equal(await status(student), "pending");
        assert.equal(await status(peer), undefined);
      },
    );
    await check(
      "membership: board reads applications and approves with an audit entry",
      async () => {
        assert.equal(
          await as(board, (client) =>
            scalar(
              client,
              "select status as value from public.memberships where user_id=$1",
              [student],
            ),
          ),
          "pending",
        );
        await manage(board, student, "approved");
        assert.equal(await status(student), "approved");
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.audit_logs where actor_id=$1 and entity='memberships' and entity_id=$2 and action='membership:approved'",
            [board, student],
          ),
          1,
        );
        await denied(() => apply(student), /allerede/);
      },
    );
    await check(
      "membership: administrator rejects and student sees rejection, then reapplies",
      async () => {
        await manage(administrator, student, "rejected");
        assert.equal(
          await as(student, (client) =>
            scalar(
              client,
              "select status as value from public.memberships where user_id=$1",
              [student],
            ),
          ),
          "rejected",
        );
        await apply(student);
        assert.equal(await status(student), "pending");
        await manage(administrator, student, "inactive");
        await apply(student);
        assert.equal(await status(student), "pending");
        await denied(() => manage(board, student, "admin"), { code: "23514" });
        assert.equal(await status(student), "pending");
      },
    );
    await check(
      "membership: configured automatic approval stays separate from privileged roles",
      async () => {
        await admin.query(
          "update public.site_settings set membership_approval=false",
        );
        await apply(automatic);
        assert.equal(await status(automatic), "approved");
        assert.equal(
          await as(automatic, (client) =>
            scalar(
              client,
              "select role as value from public.user_roles where user_id=$1",
              [automatic],
            ),
          ),
          "student",
        );
      },
    );
    await check(
      "membership: membership-only registration rejects pending or rejected accounts and accepts approved members",
      async () => {
        const event = randomUUID();
        await as(board, (client) =>
          client.query(
            "insert into public.events(id,title,starts_at,ends_at,deadline,category,capacity,status,audience,created_by) values($1,'Medlemsarrangement',now()+interval '7 days',now()+interval '7 days 2 hours',now()+interval '6 days','Sosialt',5,'published','members',$2)",
            [event, board],
          ),
        );
        const register = (user) =>
          as(user, (client) =>
            scalar(client, "select public.register_event($1) as value", [
              event,
            ]),
          );
        await denied(() => register(student), { code: "42501" });
        await manage(board, student, "rejected");
        await denied(() => register(student), { code: "42501" });
        await manage(board, student, "approved");
        assert.equal(await register(student), "confirmed");
      },
    );
  } finally {
    await admin.query(
      "update public.site_settings set membership_approval=$1",
      [initialApproval],
    );
  }
}
