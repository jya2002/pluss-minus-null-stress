import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const parts = await Promise.all(
  files.map(
    async (f) =>
      `-- ${f}\n${await readFile(`supabase/migrations/${f}`, "utf8")}`,
  ),
);
await mkdir(".runtime", { recursive: true });
await writeFile(
  ".runtime/supabase-setup.sql",
  `-- Run once on a NEW EMPTY development project. No demo seed, no cron activation.\nbegin;\n${parts.join("\n\n")}\ncommit;\n`,
);
console.log(
  "Prepared .runtime/supabase-setup.sql from " +
    files.length +
    " migrations. No database connection or changes performed.",
);
