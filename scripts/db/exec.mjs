import "dotenv/config";
import { newClient } from "./pool.mjs";

// two ways to run sql. this machine sits behind a network that drops the postgres
// wire protocol (5432/6543 tcp connects then goes silent), so we run sql over the
// supabase management api on 443, which does pass. pg stays as the fallback for any
// machine that can reach the db port directly (ci, a different network).

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m1 = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (m1) return m1[1];
  const db = process.env.DATABASE_URL || "";
  const m2 = db.match(/postgres\.([a-z0-9]+)@/) || db.match(/@db\.([a-z0-9]+)\.supabase\.co/);
  return m2 ? m2[1] : null;
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
let pgClient = null;

async function httpExec(sql) {
  const ref = projectRef();
  if (!ref) throw new Error("cannot determine supabase project ref from env");
  // node fetch honors NODE_EXTRA_CA_CERTS, so this goes through the proxy cleanly
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`management api ${res.status}: ${body}`);
  try { return JSON.parse(body); } catch { return []; }
}

async function pgExec(sql) {
  if (!pgClient) { pgClient = newClient(); await pgClient.connect(); }
  const r = await pgClient.query(sql);
  return r.rows;
}

// returns rows for selects, [] otherwise. accepts multi-statement sql.
export async function execSql(sql) {
  return token ? httpExec(sql) : pgExec(sql);
}

export function backend() {
  return token ? "management-api (https)" : "postgres (direct)";
}

export async function closeExec() {
  if (pgClient) { await pgClient.end(); pgClient = null; }
}
