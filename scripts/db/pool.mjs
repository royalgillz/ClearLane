import fs from "node:fs";
import "dotenv/config";
import pg from "pg";

// tls to supabase goes over 5432 and uses a real public cert chain. we trust the
// system bundle (already exported to NODE_EXTRA_CA_CERTS via dev-env.sh) instead of
// turning verification off. if supabase hands back a cert that does not chain to a
// public root, grab their CA from the dashboard and point SUPABASE_CA_CERT at it.
function sslConfig() {
  const caPath = process.env.SUPABASE_CA_CERT || process.env.NODE_EXTRA_CA_CERTS;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true };
}

export function newClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  // local dev postgres (docker) has no tls, only wire ssl for remote hosts like supabase
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  return new pg.Client({ connectionString, ssl: isLocal ? false : sslConfig() });
}
