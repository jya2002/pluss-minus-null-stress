import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import {
  cleanupFixtures,
  developmentProject,
  fixtureEmail,
} from "./registration-live-safety.mjs";

export const deletionOrigin = "http://127.0.0.1:5173";
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function requireDeletionApproval(argv, env) {
  if (
    !argv.includes("--allow-development-account-deletion") ||
    env.PMNS_APPROVE_ACCOUNT_DELETE_TEST !== developmentProject
  )
    throw new Error(
      "Separate approval is required for disposable-account deletion tests.",
    );
}
export function fixturePng(runId, owner, bucket) {
  if (
    !uuid.test(runId) ||
    !uuid.test(owner) ||
    !["avatars", "suggestion-images"].includes(bucket)
  )
    throw new Error("Invalid image fixture.");
  function chunk(name, data) {
    const type = Buffer.from(name),
      size = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([size, type, data, crc]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("tEXt", Buffer.from(`pmns\0${runId}:${owner}:${bucket}`)),
    chunk("IDAT", deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function validateDeletionManifest(m) {
  if (
    !m ||
    m.kind !== "account-delete-v1" ||
    m.project !== developmentProject ||
    !uuid.test(m.runId) ||
    m.testTitle !== `[AUTOTEST ${m.runId}] Påmelding` ||
    m.users?.length !== 2 ||
    new Set(m.users.map((u) => u.id)).size !== 2 ||
    m.events?.length !== 1
  )
    throw new Error("Invalid deletion manifest.");
  for (const [i, label] of ["a", "b"].entries()) {
    const u = m.users[i];
    if (
      !uuid.test(u.id) ||
      u.label !== label ||
      u.email !== fixtureEmail(m.emailBase, m.runId, label)
    )
      throw new Error("Invalid fixture identity.");
  }
  const [a, b] = m.users;
  if (
    !uuid.test(m.events[0].id) ||
    m.events[0].createdBy !== b.id ||
    !uuid.test(m.group?.id) ||
    m.group.name !== `[AUTOTEST ${m.runId}] Slettetest` ||
    !uuid.test(m.suggestion?.id) ||
    m.suggestion.author !== a.id ||
    m.suggestion.title !== `[AUTOTEST ${m.runId}] Sletting` ||
    m.files?.length !== 3
  )
    throw new Error("Invalid fixture ownership.");
  const expected = [
    [a.id, "avatars"],
    [a.id, "suggestion-images"],
    [b.id, "avatars"],
  ];
  for (const [i, [owner, bucket]] of expected.entries()) {
    const f = m.files[i];
    if (
      f.owner !== owner ||
      f.bucket !== bucket ||
      f.path !== `${owner}/${m.runId}.png` ||
      f.sha256 !== digest(fixturePng(m.runId, owner, bucket))
    )
      throw new Error("Invalid fixture image.");
  }
  return m;
}
async function rows(query) {
  const { data, error } = await query;
  if (error || !Array.isArray(data))
    throw new Error("Fixture ownership check failed.");
  return data;
}
// Read and verify every owned object BEFORE the first cleanup mutation.
export async function inspectDeletionFixtures(service, m) {
  validateDeletionManifest(m);
  const absent = new Set();
  for (const u of m.users) {
    const { data, error } = await service.auth.admin.getUserById(u.id);
    if (error?.status === 404) {
      absent.add(u.id);
      continue;
    }
    if (
      error ||
      data.user?.id !== u.id ||
      data.user.email !== u.email ||
      data.user.app_metadata?.pmns_test_run !== m.runId
    )
      throw new Error("Fixture account changed.");
    const roles = await rows(
      service.from("user_roles").select("role").eq("user_id", u.id),
    );
    if (roles.length !== 1 || roles[0].role !== "student")
      throw new Error("Fixture role changed; preserve for review.");
  }
  const event = await rows(
    service
      .from("events")
      .select("id,title,is_demo,created_by,audience")
      .eq("id", m.events[0].id),
  );
  if (
    event.length &&
    (event.length !== 1 ||
      event[0].title !== m.testTitle ||
      event[0].is_demo !== true ||
      event[0].created_by !== m.users[1].id ||
      event[0].audience !== "groups")
  )
    throw new Error("Fixture event changed.");
  const group = await rows(
    service.from("access_groups").select("id,name").eq("id", m.group.id),
  );
  if (group.length && (group.length !== 1 || group[0].name !== m.group.name))
    throw new Error("Fixture group changed.");
  for (const [table, column, value] of [
    ["event_registrations", "event_id", m.events[0].id],
    ["group_members", "group_id", m.group.id],
  ]) {
    const members = await rows(
      service.from(table).select("user_id").eq(column, value),
    );
    if (members.some((r) => !m.users.some((u) => u.id === r.user_id)))
      throw new Error(
        "Non-fixture participant detected; preserve all fixtures.",
      );
  }
  const mappings = await rows(
    service
      .from("event_access_groups")
      .select("event_id,group_id")
      .eq("group_id", m.group.id),
  );
  if (mappings.some((r) => r.event_id !== m.events[0].id))
    throw new Error("Group is used by another event.");
  const eventMappings = await rows(
    service
      .from("event_access_groups")
      .select("group_id")
      .eq("event_id", m.events[0].id),
  );
  if (eventMappings.some((r) => r.group_id !== m.group.id))
    throw new Error("Event access changed.");
  const suggestion = await rows(
    service
      .from("suggestions")
      .select("id,title,author_id,hidden")
      .eq("id", m.suggestion.id),
  );
  if (
    suggestion.length &&
    (suggestion.length !== 1 ||
      suggestion[0].title !== m.suggestion.title ||
      suggestion[0].hidden !== true ||
      !(
        suggestion[0].author_id === m.users[0].id ||
        (suggestion[0].author_id === null && absent.has(m.users[0].id))
      ))
  )
    throw new Error("Fixture suggestion changed.");
  const votes = await rows(
    service
      .from("suggestion_votes")
      .select("user_id")
      .eq("suggestion_id", m.suggestion.id),
  );
  if (votes.some((v) => !m.users.some((u) => u.id === v.user_id)))
    throw new Error("Non-fixture vote detected.");
  const present = [];
  for (const u of m.users)
    for (const bucket of ["avatars", "suggestion-images"]) {
      const store = service.storage.from(bucket);
      const listing = await rows(store.list(u.id, { limit: 100 }));
      for (const object of listing) {
        const file = m.files.find(
          (f) =>
            f.owner === u.id &&
            f.bucket === bucket &&
            `${u.id}/${object.name}` === f.path,
        );
        if (!file)
          throw new Error("Unexpected personal file; preserve for review.");
        const { data, error } = await store.download(file.path);
        if (
          error ||
          !data ||
          digest(Buffer.from(await data.arrayBuffer())) !== file.sha256
        )
          throw new Error("Fixture file contents changed.");
        present.push(file);
      }
    }
  return {
    present,
    suggestion: suggestion[0],
    eventPresent: event.length !== 0,
  };
}
export async function cleanupDeletionFixtures(service, m) {
  try {
    const owned = await inspectDeletionFixtures(service, m);
    for (const f of owned.present) {
      if ((await service.storage.from(f.bucket).remove([f.path])).error)
        throw new Error("Storage cleanup failed.");
    }
    if (owned.suggestion) {
      let query = service
        .from("suggestions")
        .delete()
        .eq("id", m.suggestion.id)
        .eq("title", m.suggestion.title)
        .eq("hidden", true);
      query =
        owned.suggestion.author_id === null
          ? query.is("author_id", null)
          : query.eq("author_id", m.suggestion.author);
      if ((await rows(query.select("id"))).length !== 1)
        throw new Error("Suggestion cleanup failed.");
    }
    const group = await rows(
      service.from("access_groups").select("id").eq("id", m.group.id),
    );
    if (
      group.length &&
      (
        await rows(
          service
            .from("access_groups")
            .delete()
            .eq("id", m.group.id)
            .eq("name", m.group.name)
            .select("id"),
        )
      ).length !== 1
    )
      throw new Error("Group cleanup failed.");
    // Recheck files are gone before delegating Auth deletion. Do not turn a
    // failed Edge deletion into a passing test: the caller records that first.
    await inspectDeletionFixtures(service, m);
    const result = await cleanupFixtures(service, {
      ...m,
      events: owned.eventPresent ? m.events : [],
    });
    if (result.complete) await verifyDeletionCleanup(service, m);
    return { complete: result.complete };
  } catch {
    return { complete: false };
  }
}
export async function verifyDeletionCleanup(service, m) {
  validateDeletionManifest(m);
  for (const user of m.users) {
    const { error } = await service.auth.admin.getUserById(user.id);
    if (error?.status !== 404)
      throw new Error("Fixture Auth account still present or unverified.");
    for (const [table, column] of [
      ["profiles", "id"],
      ["user_roles", "user_id"],
      ["memberships", "user_id"],
      ["group_members", "user_id"],
      ["event_registrations", "user_id"],
      ["suggestion_votes", "user_id"],
      ["notifications", "user_id"],
      ["notification_preferences", "user_id"],
      ["contact_submissions", "user_id"],
    ])
      if (
        (await rows(service.from(table).select(column).eq(column, user.id)))
          .length
      )
        throw new Error("Fixture database rows remain.");
  }
  for (const [table, id] of [
    ["events", m.events[0].id],
    ["suggestions", m.suggestion.id],
    ["access_groups", m.group.id],
  ])
    if ((await rows(service.from(table).select("id").eq("id", id))).length)
      throw new Error("Fixture content remains.");
  const state = await inspectDeletionFixtures(service, m);
  if (state.present.length) throw new Error("Fixture files remain.");
}
