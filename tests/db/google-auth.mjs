import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function testGoogleRoles({ admin, as, scalar, check, denied }) {
  // Add fields to the local Auth shim only, never to a Supabase project.
  await admin.query(
    "alter table auth.users add column raw_user_meta_data jsonb, add column raw_app_meta_data jsonb",
  );
  const a = randomUUID(),
    b = randomUUID();
  await check(
    "Google-like signup metadata cannot assign a privileged application role",
    async () => {
      for (const id of [a, b])
        await admin.query(
          "insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4)",
          [
            id,
            `${id}@offline.invalid`,
            JSON.stringify({
              role: "admin",
              is_admin: true,
              email_verified: true,
            }),
            JSON.stringify({ provider: "google", providers: ["google"] }),
          ],
        );
      for (const id of [a, b]) {
        assert.equal(
          await scalar(
            admin,
            "select role as value from public.user_roles where user_id=$1",
            [id],
          ),
          "student",
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.profiles where id=$1",
            [id],
          ),
          1,
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.notification_preferences where user_id=$1",
            [id],
          ),
          1,
        );
        assert.equal(
          await scalar(
            admin,
            "select count(*)::int as value from public.memberships where user_id=$1",
            [id],
          ),
          0,
        );
      }
    },
  );
  await check(
    "Google-like student cannot self-promote through direct writes or RPC",
    async () => {
      await denied(
        () =>
          as(a, (c) =>
            c.query(
              "update public.user_roles set role='admin' where user_id=$1",
              [a],
            ),
          ),
        /permission denied/,
      );
      await denied(
        () => as(a, (c) => c.query("select public.set_role($1,'admin')", [a])),
        /administrator/,
      );
    },
  );
  await check(
    "Google-like student membership uses the existing workflow and remains isolated",
    async () => {
      await as(a, (c) => c.query("select public.apply_membership()"));
      assert.equal(
        await as(a, (c) =>
          scalar(
            c,
            "select status as value from public.memberships where user_id=$1",
            [a],
          ),
        ),
        "pending",
      );
      assert.equal(
        await as(b, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.memberships where user_id=$1",
            [a],
          ),
        ),
        0,
      );
      await denied(
        () =>
          as(a, (c) =>
            c.query(
              "update public.memberships set status='approved' where user_id=$1",
              [a],
            ),
          ),
        /permission denied/,
      );
    },
  );
  await check(
    "Google-like student cannot create an event or read other profiles",
    async () => {
      await denied(
        () =>
          as(a, (c) =>
            c.query(
              "insert into public.events(title,starts_at,ends_at,deadline,category,capacity,created_by) values('Local OAuth test',now()+interval '7 days',now()+interval '8 days',now()+interval '6 days','Sosialt',1,$1)",
              [a],
            ),
          ),
        /row-level security/,
      );
      assert.equal(
        await as(a, (c) =>
          scalar(
            c,
            "select count(*)::int as value from public.profiles where id=$1",
            [b],
          ),
        ),
        0,
      );
    },
  );
  await check(
    "trusted existing board role survives Auth metadata changes",
    async () => {
      await admin.query(
        "update public.user_roles set role='board' where user_id=$1",
        [b],
      );
      await admin.query(
        "update auth.users set raw_user_meta_data=$2 where id=$1",
        [b, JSON.stringify({ role: "student", provider: "google" })],
      );
      assert.equal(
        await as(b, (c) =>
          scalar(
            c,
            "select role as value from public.user_roles where user_id=$1",
            [b],
          ),
        ),
        "board",
      );
    },
  );
}
