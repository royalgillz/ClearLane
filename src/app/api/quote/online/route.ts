import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveOnlineQuotes } from "@/lib/quoting";

// trigger the online quote path for a session. the worker calls this internally later,
// for now it lets us demonstrate the spread. accepts a status token.

export async function POST(req: Request) {
  let token: string | undefined;
  try {
    token = (await req.json()).token;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: session } = await db.from("sessions").select("id").eq("status_token", token).maybeSingle();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  try {
    const inserted = await resolveOnlineQuotes(session.id);
    // show the spread back, cheapest first
    const { data: spread } = await db
      .from("quotes")
      .select("monthly_premium, annual_premium, quote_reference, provenance, rideshare_endorsement_included, providers(name)")
      .eq("session_id", session.id)
      .eq("outcome", "online")
      .order("monthly_premium", { ascending: true });
    return NextResponse.json({ ok: true, count: inserted.length, quotes: spread });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "quote failed" }, { status: 500 });
  }
}
