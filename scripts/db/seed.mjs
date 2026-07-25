import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSql, backend, closeExec } from "./exec.mjs";

// seed lives in supabase/seed.sql (idempotent, single source of truth). this just
// runs it and prints a summary.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFile = path.join(__dirname, "..", "..", "supabase", "seed.sql");

async function main() {
  console.log(`seed via ${backend()}`);
  try {
    await execSql(fs.readFileSync(seedFile, "utf8"));
    const rows = await execSql(`
      select
        (select count(*) from providers) as providers,
        (select count(*) from providers where quotes_online) as online,
        (select count(*) from providers where not quotes_online) as phone_only,
        (select count(*) from sessions) as sessions
    `);
    const c = rows[0];
    console.log(`seeded: marcus (session marcus-demo), ${c.providers} providers (${c.online} online, ${c.phone_only} phone-only)`);
  } finally {
    await closeExec();
  }
}

main().catch(async (err) => {
  console.error(err.message);
  await closeExec();
  process.exit(1);
});
