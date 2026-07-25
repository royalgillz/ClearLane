import { createClient } from "@supabase/supabase-js";

// server-only client. uses the service role key so it can write intake rows. never
// import this into a client component. supabase rest runs over 443, which is the only
// thing this network lets through.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase env not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}
