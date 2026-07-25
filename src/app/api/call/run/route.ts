import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveCallJob } from "@/lib/phone-quoting";

// force one call to run now, bypassing the schedule. this is the demo trigger (phase 7)
// and how we test the pipeline. the queue architecture stays intact underneath: this just
// creates a job with force_now and resolves it immediately.

export async function POST(req: Request) {
  let body: { token?: string; providerName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: session } = await db.from("sessions").select("id").eq("status_token", body.token).maybeSingle();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const providerName = body.providerName || "Detroit Metro Insurance Group";
  const { data: provider } = await db.from("providers").select("id, name").eq("name", providerName).maybeSingle();
  if (!provider) return NextResponse.json({ error: `provider not found: ${providerName}` }, { status: 404 });

  const { data: job, error } = await db
    .from("call_jobs")
    .insert({
      session_id: session.id, provider_id: provider.id,
      status: "in_progress", scheduled_for: new Date().toISOString(), force_now: true,
    })
    .select("id, session_id, provider_id")
    .single();
  if (error || !job) return NextResponse.json({ error: "could not create job" }, { status: 500 });

  try {
    const result = await resolveCallJob(job);
    return NextResponse.json({ ok: true, provider: provider.name, ...result });
  } catch (e) {
    await db.from("call_jobs").update({ status: "failed", last_error: String(e) }).eq("id", job.id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "call failed" }, { status: 500 });
  }
}
