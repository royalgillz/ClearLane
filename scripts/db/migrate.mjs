import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newClient } from "./pool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "..", "supabase", "migrations");

// drop order matters, children before parents. keep this in sync with 0001_init.
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

async function main() {
  const reset = process.argv.includes("--reset");
  const client = newClient();
  await client.connect();
  try {
    if (reset) {
      console.log("resetting: dropping clearlane objects");
      await client.query(RESET_SQL);
    }

    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const applied = new Set(
      (await client.query("select filename from schema_migrations")).rows.map((r) => r.filename)
    );

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`applying ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations(filename) values ($1)", [file]);
        await client.query("commit");
        ran++;
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    console.log(ran === 0 ? "already up to date" : `applied ${ran} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
