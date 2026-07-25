import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSql, backend, closeExec } from "./exec.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "..", "supabase", "migrations");

// drop order matters, children before parents. keep in sync with 0001_init.
const RESET_SQL = `
drop table if exists reports cascade;
drop table if exists quotes cascade;
drop table if exists calls cascade;
drop table if exists call_jobs cascade;
drop table if exists coverage_prefs cascade;
drop table if exists vehicles cascade;
drop table if exists drivers cascade;
drop table if exists providers cascade;
drop table if exists sessions cascade;
drop table if exists schema_migrations cascade;
drop type if exists report_email_status cascade;
drop type if exists quote_outcome cascade;
drop type if exists call_status cascade;
drop type if exists call_job_status cascade;
drop type if exists pip_medical_tier cascade;
drop type if exists vehicle_ownership cascade;
drop type if exists provider_channel cascade;
drop type if exists provider_entity_type cascade;
drop type if exists provenance cascade;
drop type if exists session_status cascade;
`;

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function main() {
  const reset = process.argv.includes("--reset");
  console.log(`migrate via ${backend()}`);
  try {
    if (reset) {
      console.log("resetting: dropping clearlane objects");
      await execSql(RESET_SQL);
    }

    await execSql(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    const appliedRows = await execSql("select filename from schema_migrations");
    const applied = new Set(appliedRows.map((r) => r.filename));

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`applying ${file}`);
      await execSql(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
      await execSql(`insert into schema_migrations(filename) values (${sqlLiteral(file)})`);
      ran++;
    }

    console.log(ran === 0 ? "already up to date" : `applied ${ran} migration(s)`);
  } finally {
    await closeExec();
  }
}

main().catch(async (err) => {
  console.error(err.message);
  await closeExec();
  process.exit(1);
});
