import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const file = ".runtime/supabase-setup.sql";
const sql = await readFile(file, "utf8");
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const checks = {
  complete: files.length >= 4,
  atomic:
    sql.startsWith("-- Run once") &&
    sql.includes("\nbegin;\n") &&
    sql.trim().endsWith("commit;"),
  noScheduler:
    !/(cron\.schedule|create extension|net\.http_post|vault\.create_secret)/i.test(
      sql,
    ),
  noDestructiveDDL: !/(drop\s+(table|schema|database)|truncate\s)/i.test(sql),
  noDemo: !sql.includes("Quiz & Kaos"),
};
for (const f of files)
  if (!sql.includes(await readFile(`supabase/migrations/${f}`, "utf8")))
    checks.complete = false;
console.log(
  JSON.stringify(
    { file, ...checks, sha256: createHash("sha256").update(sql).digest("hex") },
    null,
    2,
  ),
);
if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
