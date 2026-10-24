import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Disposable local database only. Supabase Auth identities are shims; SQL,
// constraints, permissions, RLS and concurrent transactions are real.
export async function testPolls({ admin, as, scalar, check, denied }) {
  const [a, b, member, board, administrator] = Array.from({ length: 5 }, () =>
    randomUUID(),
  );
  for (const id of [a, b, member, board, administrator])
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@example.test`,
    ]);
  await admin.query(
    "update public.user_roles set role=case when user_id=$1 then 'board' else 'admin' end where user_id in ($1,$2)",
    [board, administrator],
  );
  await admin.query(
    "insert into public.memberships(user_id,status) values($1,'approved'),($2,'pending')",
    [member, b],
  );
  const create = (user = board, extra = {}) =>
    as(user, (c) =>
      scalar(c, "select public.create_poll($1,$2,$3,$4,$5,$6) as value", [
        `Lokal test ${randomUUID()}`,
        extra.opens ?? new Date(Date.now() - 60000),
        extra.closes ?? new Date(Date.now() + 3600000),
        extra.options ?? ["Brettspill", "Film og pizza"],
        extra.hide ?? true,
        extra.audience ?? "everyone",
      ]),
    );
  const options = async (poll) =>
    (
      await admin.query(
        "select id from public.poll_options where poll_id=$1 order by label",
        [poll],
      )
    ).rows.map((r) => r.id);
  const vote = (user, poll, option) =>
    as(user, (c) => c.query("select public.vote_poll($1,$2)", [poll, option]));
  const results = (user, poll, role = "authenticated") =>
    as(
      user,
      (c) => c.query("select * from public.poll_results($1)", [poll]),
      role,
    );
  const poll = await create();
  const [first, second] = await options(poll);
  await check(
    "poll: board creates published poll with exactly its options",
    async () => {
      assert.equal(
        await scalar(
          admin,
          "select published as value from public.polls where id=$1",
          [poll],
        ),
        true,
      );
      assert.equal((await options(poll)).length, 2);
      assert.ok(await create(administrator));
    },
  );
  await check(
    "poll: student and anonymous cannot create polls or change publication",
    async () => {
      await denied(() => create(a), { code: "42501" });
      await denied(
        () =>
          as(
            null,
            (c) =>
              c.query(
                "select public.create_poll('Test question',now(),now()+interval '1 hour',array['A','B'])",
              ),
            "anon",
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(a, (c) =>
            c.query(
              "insert into public.polls(question,opens_at,closes_at) values('Test question',now(),now()+interval '1 hour')",
            ),
          ),
        { code: "42501" },
      );
      assert.equal(
        (
          await as(a, (c) =>
            c.query(
              "update public.polls set hide_results=false,published=false where id=$1 returning id",
              [poll],
            ),
          )
        ).rowCount,
        0,
      );
    },
  );
  await check(
    "poll: draft and options stay invisible, draft cannot receive votes",
    async () => {
      await as(board, (c) =>
        c.query("update public.polls set published=false where id=$1", [poll]),
      );
      for (const [user, role] of [
        [a, "authenticated"],
        [null, "anon"],
      ]) {
        assert.equal(
          (
            await as(
              user,
              (c) => c.query("select * from public.polls where id=$1", [poll]),
              role,
            )
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await as(
              user,
              (c) =>
                c.query("select * from public.poll_options where poll_id=$1", [
                  poll,
                ]),
              role,
            )
          ).rowCount,
          0,
        );
        assert.equal((await results(user, poll, role)).rowCount, 0);
      }
      await denied(() => vote(a, poll, first), /Avstemningen er stengt/);
      assert.equal(
        (
          await as(board, (c) =>
            c.query("select * from public.poll_options where poll_id=$1", [
              poll,
            ]),
          )
        ).rowCount,
        2,
      );
      await as(board, (c) =>
        c.query("update public.polls set published=true where id=$1", [poll]),
      );
    },
  );
  await check(
    "poll: one student vote is stored, duplicate and changed option rejected",
    async () => {
      await vote(a, poll, first);
      await denied(() => vote(a, poll, first), { code: "23505" });
      await denied(() => vote(a, poll, second), { code: "23505" });
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.poll_votes where poll_id=$1 and user_id=$2",
          [poll, a],
        ),
        1,
      );
    },
  );
  await check(
    "poll: simultaneous votes from same account persist exactly once",
    async () => {
      const calls = await Promise.allSettled([
        vote(b, poll, first),
        vote(b, poll, second),
      ]);
      assert.equal(calls.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        calls.filter(
          (r) => r.status === "rejected" && r.reason.code === "23505",
        ).length,
        1,
      );
    },
  );
  await check(
    "poll: hidden results cannot leak through RPC, raw rows or peer votes",
    async () => {
      for (const [user, role] of [
        [member, "authenticated"],
        [null, "anon"],
      ]) {
        assert.equal((await results(user, poll, role)).rowCount, 0);
        if (role === "anon")
          await denied(
            () =>
              as(
                user,
                (c) =>
                  c.query("select * from public.poll_votes where poll_id=$1", [
                    poll,
                  ]),
                role,
              ),
            { code: "42501" },
          );
        else
          assert.equal(
            (
              await as(
                user,
                (c) =>
                  c.query("select * from public.poll_votes where poll_id=$1", [
                    poll,
                  ]),
                role,
              )
            ).rowCount,
            0,
          );
      }
      const own = await as(a, (c) =>
        c.query(
          "select user_id,option_id from public.poll_votes where poll_id=$1",
          [poll],
        ),
      );
      assert.deepEqual(own.rows, [{ user_id: a, option_id: first }]);
      assert.equal(
        (await results(board, poll)).rows.reduce(
          (n, r) => n + Number(r.votes),
          0,
        ),
        2,
      );
    },
  );
  await check(
    "poll: raw writes cannot impersonate, change or delete votes",
    async () => {
      for (const sql of [
        "insert into public.poll_votes(poll_id,user_id,option_id) values($1,$2,$3)",
        "update public.poll_votes set option_id=$3 where poll_id=$1 and user_id=$2",
        "delete from public.poll_votes where poll_id=$1 and user_id=$2 and option_id=$3",
      ])
        await denied(() => as(b, (c) => c.query(sql, [poll, a, first])), {
          code: "42501",
        });
      await denied(
        () =>
          as(a, (c) =>
            c.query(
              "update public.poll_options set label='Manipulated' where id=$1",
              [first],
            ),
          ),
        { code: "42501" },
      );
    },
  );
  await check("poll: opening time and closing time are enforced", async () => {
    const future = await create(board, { opens: new Date(Date.now() + 60000) });
    const closed = await create(board, {
      opens: new Date(Date.now() - 120000),
      closes: new Date(Date.now() - 60000),
    });
    await denied(
      async () => vote(a, future, (await options(future))[0]),
      /Avstemningen er stengt/,
    );
    await denied(
      async () => vote(a, closed, (await options(closed))[0]),
      /Avstemningen er stengt/,
    );
    assert.equal((await results(null, closed, "anon")).rowCount, 2);
  });
  await check(
    "poll: only approved members vote in members-only poll",
    async () => {
      const restricted = await create(board, { audience: "members" });
      const [option] = await options(restricted);
      for (const user of [a, b])
        await denied(() => vote(user, restricted, option), { code: "42501" });
      await vote(member, restricted, option);
      await denied(() => vote(board, restricted, option), { code: "42501" });
    },
  );
  await check(
    "poll: an option from another poll cannot be submitted",
    async () => {
      const other = await create();
      await denied(async () => vote(member, poll, (await options(other))[0]), {
        code: "23503",
      });
    },
  );
  await check(
    "poll: visible results count actual votes and closing reveals hidden results",
    async () => {
      await as(administrator, (c) =>
        c.query("update public.polls set hide_results=false where id=$1", [
          poll,
        ]),
      );
      assert.equal(
        (await results(null, poll, "anon")).rows.reduce(
          (n, r) => n + Number(r.votes),
          0,
        ),
        2,
      );
      await as(board, (c) =>
        c.query(
          "update public.polls set hide_results=true,closes_at=clock_timestamp() where id=$1",
          [poll],
        ),
      );
      assert.equal(
        (await results(null, poll, "anon")).rows.reduce(
          (n, r) => n + Number(r.votes),
          0,
        ),
        2,
      );
    },
  );
  await check(
    "poll: invalid option count and time range rejected atomically",
    async () => {
      await denied(
        () => create(board, { options: ["Only one"] }),
        /mellom 2 og 12/,
      );
      await denied(
        () => create(board, { opens: new Date(Date.now() + 7200000) }),
        { code: "23514" },
      );
    },
  );
  await check(
    "poll: request waiting on row lock cannot vote after deadline",
    async () => {
      const locked = await create(board, {
        closes: new Date(Date.now() + 1600),
      });
      const [option] = await options(locked);
      await admin.query("begin");
      let pending;
      try {
        await admin.query(
          "select id from public.polls where id=$1 for update",
          [locked],
        );
        pending = vote(a, locked, option).then(
          () => ({ accepted: true }),
          (e) => ({ accepted: false, message: e.message }),
        );
        // The transaction starts before the deadline, but obtains its row lock after.
        await admin.query("select pg_sleep(2)");
      } finally {
        await admin.query("commit");
      }
      const outcome = await pending;
      assert.equal(
        outcome.accepted,
        false,
        "a stale transaction-start time allowed a vote after closing",
      );
      assert.match(outcome.message, /Avstemningen er stengt/);
    },
  );
}
