import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Local disposable PostgreSQL only. Auth identities are shims; all roles,
// privileges, RLS, constraints, locks and RPCs are the actual migrations.
export async function testSuggestions({ admin, as, scalar, check, denied }) {
  const [author, voter, board, administrator] = Array.from(
    { length: 4 },
    randomUUID,
  );
  for (const id of [author, voter, board, administrator])
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@example.test`,
    ]);
  await admin.query(
    "update public.profiles set display_name='Private author identity' where id=$1",
    [author],
  );
  await admin.query(
    "update public.user_roles set role=case when user_id=$1 then 'board' else 'admin' end where user_id in ($1,$2)",
    [board, administrator],
  );
  const submit = (
    user,
    title = "Brettspill med venner",
    description = "En sosial kveld med brettspill og kakao.",
    anonymous = false,
    image = null,
  ) =>
    as(user, (c) =>
      scalar(
        c,
        "select public.submit_suggestion($1,$2,'Spillkveld',null,500,$3,$4) as value",
        [title, description, anonymous, image],
      ),
    );
  const feed = (user, role = "authenticated") =>
    as(
      user,
      async (c) =>
        (
          await c.query("select * from public.suggestion_feed() where id=$1", [
            suggestion,
          ])
        ).rows,
      role,
    );
  const vote = (user, value = true) =>
    as(user, (c) =>
      c.query("select public.vote_suggestion($1,$2)", [suggestion, value]),
    );
  const moderate = (user, status, hidden = false) =>
    as(user, (c) =>
      c.query("select public.moderate_suggestion($1,$2,$3)", [
        suggestion,
        status,
        hidden,
      ]),
    );
  let suggestion;
  await check(
    "suggestions: authenticated submission stores author, anonymity and proposed status",
    async () => {
      suggestion = await submit(
        author,
        "Anonym brettspillkveld",
        undefined,
        true,
      );
      const row = (
        await admin.query(
          "select author_id,status,anonymous,budget_nok from public.suggestions where id=$1",
          [suggestion],
        )
      ).rows[0];
      assert.deepEqual(row, {
        author_id: author,
        status: "proposed",
        anonymous: true,
        budget_nok: 500,
      });
      assert.equal((await feed(voter))[0].votes, "0");
    },
  );
  await check(
    "suggestions: invalid title, description, category, budget and foreign image rejected server-side",
    async () => {
      await denied(() => submit(author, "x"), { code: "23514" });
      await denied(() => submit(author, "Valid title", "short"), {
        code: "23514",
      });
      await denied(
        () =>
          as(author, (c) =>
            c.query(
              "select public.submit_suggestion('Valid title','Valid description text','unknown')",
            ),
          ),
        { code: "23503" },
      );
      await denied(
        () =>
          as(author, (c) =>
            c.query(
              "select public.submit_suggestion('Valid title','Valid description text','Quiz',null,-1)",
            ),
          ),
        { code: "23514" },
      );
      await denied(
        () =>
          submit(
            author,
            "Valid title",
            undefined,
            false,
            `${voter}/${randomUUID()}.jpg`,
          ),
        /Ugyldig bilde/,
      );
    },
  );
  await check(
    "suggestions: anonymous visitors cannot submit or vote",
    async () => {
      await denied(
        () =>
          as(
            null,
            (c) =>
              c.query(
                "select public.submit_suggestion('Valid title','Valid description text','Quiz')",
              ),
            "anon",
          ),
        { code: "42501" },
      );
      await denied(
        () =>
          as(
            null,
            (c) =>
              c.query("select public.vote_suggestion($1,true)", [suggestion]),
            "anon",
          ),
        { code: "42501" },
      );
    },
  );
  await check(
    "suggestions: public and other students cannot recover anonymous author identity",
    async () => {
      for (const [user, role] of [
        [null, "anon"],
        [voter, "authenticated"],
      ]) {
        const [row] = await feed(user, role);
        assert.equal(row.author_name, "Anonym student");
        assert.equal("author_id" in row, false);
        assert.equal(JSON.stringify(row).includes(author), false);
        assert.equal(
          JSON.stringify(row).includes("Private author identity"),
          false,
        );
      }
      assert.equal(
        await as(voter, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.suggestions where id=$1",
            [suggestion],
          ),
        ),
        0,
      );
      await denied(
        () =>
          as(
            null,
            (c) =>
              c.query("select * from public.suggestions where id=$1", [
                suggestion,
              ]),
            "anon",
          ),
        { code: "42501" },
      );
      assert.equal(
        await as(board, (c) =>
          scalar(
            c,
            "select author_id as value from public.suggestions where id=$1",
            [suggestion],
          ),
        ),
        author,
      );
    },
  );
  await check(
    "suggestions: anonymous image paths never disclose the author UUID",
    async () => {
      const id = await submit(
        author,
        "Anonymt forslag med bilde",
        undefined,
        true,
        `${author}/${randomUUID()}.jpg`,
      );
      const row = await as(
        voter,
        async (c) =>
          (
            await c.query(
              "select * from public.suggestion_feed() where id=$1",
              [id],
            )
          ).rows[0],
      );
      assert.equal(row.image_path, null);
      assert.equal(JSON.stringify(row).includes(author), false);
    },
  );
  await check(
    "suggestions: storage listings do not expose another author's upload directory",
    async () => {
      const path = `${author}/${randomUUID()}.jpg`;
      await as(author, (c) =>
        c.query(
          "insert into storage.objects(bucket_id,name) values('suggestion-images',$1)",
          [path],
        ),
      );
      for (const [user, role] of [
        [null, "anon"],
        [voter, "authenticated"],
      ])
        assert.equal(
          await as(
            user,
            (c) =>
              scalar(
                c,
                "select count(*)::int as value from storage.objects where bucket_id='suggestion-images' and name=$1",
                [path],
              ),
            role,
          ),
          0,
        );
      for (const user of [author, board])
        assert.equal(
          await as(user, (c) =>
            scalar(
              c,
              "select count(*)::int as value from storage.objects where bucket_id='suggestion-images' and name=$1",
              [path],
            ),
          ),
          1,
        );
    },
  );
  await check(
    "suggestions: repeated and concurrent votes remain one per account",
    async () => {
      await vote(voter);
      await vote(voter);
      await Promise.all(Array.from({ length: 8 }, () => vote(author)));
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.suggestion_votes where suggestion_id=$1",
          [suggestion],
        ),
        2,
      );
      const [row] = await feed(voter);
      assert.equal(row.votes, "2");
      assert.equal(row.my_vote, true);
    },
  );
  await check(
    "suggestions: withdrawing affects only the current user's vote and is idempotent",
    async () => {
      await vote(voter, false);
      await vote(voter, false);
      const [row] = await feed(voter);
      assert.equal(row.votes, "1");
      assert.equal(row.my_vote, false);
      assert.equal(
        await scalar(
          admin,
          "select count(*)::int as value from public.suggestion_votes where suggestion_id=$1 and user_id=$2",
          [suggestion, author],
        ),
        1,
      );
    },
  );
  await check(
    "suggestions: student cannot forge authors, raw suggestions, vote ownership or moderation",
    async () => {
      for (const sql of [
        "insert into public.suggestions(author_id,title,description,category) values($1,'Forged title','Forged description','Quiz')",
        "update public.suggestions set author_id=$1,status='planned'",
        "delete from public.suggestions where author_id=$1",
        "insert into public.suggestion_votes(suggestion_id,user_id) values($2,$1)",
        "update public.suggestion_votes set user_id=$1 where suggestion_id=$2",
        "delete from public.suggestion_votes where user_id=$1 and suggestion_id=$2",
      ]) {
        // Each denied transaction must be separate; PostgreSQL aborts it on error.
        await denied(
          () =>
            as(voter, (c) =>
              c.query(
                sql,
                sql.includes("$2") ? [author, suggestion] : [author],
              ),
            ),
          { code: "42501" },
        );
      }
      await denied(() => moderate(voter, "planned"), { code: "42501" });
      assert.equal(
        await scalar(
          admin,
          "select status as value from public.suggestions where id=$1",
          [suggestion],
        ),
        "proposed",
      );
      assert.equal(
        await scalar(
          admin,
          "select author_id as value from public.suggestions where id=$1",
          [suggestion],
        ),
        author,
      );
      assert.equal(
        await as(voter, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.suggestion_votes where suggestion_id=$1",
            [suggestion],
          ),
        ),
        0,
      );
    },
  );
  await check(
    "suggestions: board can use all five statuses, closed proposals reject votes, admin can reopen",
    async () => {
      for (const status of [
        "reviewing",
        "planned",
        "completed",
        "rejected",
        "proposed",
      ]) {
        await moderate(board, status);
        assert.equal((await feed(voter))[0].status, status);
        if (["planned", "completed", "rejected"].includes(status))
          await denied(() => vote(voter), /stengt for stemmer/);
      }
      await moderate(administrator, "reviewing");
      await vote(voter);
      await denied(() => moderate(board, "invented"), { code: "23514" });
    },
  );
  await check(
    "suggestions: hidden proposal stays accessible to staff and owner only, excluded from feed and voting",
    async () => {
      await moderate(board, "reviewing", true);
      assert.equal((await feed(null, "anon")).length, 0);
      assert.equal((await feed(voter)).length, 0);
      await denied(() => vote(voter), /stengt for stemmer/);
      assert.equal(
        await as(author, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.suggestions where id=$1",
            [suggestion],
          ),
        ),
        1,
      );
      assert.equal(
        await as(board, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.suggestions where id=$1",
            [suggestion],
          ),
        ),
        1,
      );
      await moderate(administrator, "proposed", false);
      assert.equal((await feed(voter)).length, 1);
    },
  );
}
