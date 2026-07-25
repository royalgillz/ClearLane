import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractFromTranscript } from "@/lib/voice/extract";
import { quoteFieldsFromExtraction } from "@/lib/phone-quoting";

// re-run extraction on a stored call transcript and update its quote. useful after a prompt
// fix, and a safety net on stage if the first extraction hiccups. a real call is one with a
// recording (vapi), a simulated call has none, which drives the honest provenance.

export async function POST(req: Request) {
  let callId: string | undefined;
  try {
    callId = (await req.json()).callId;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!callId) return NextResponse.json({ error: "callId required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: call } = await db
    .from("calls")
    .select("id, session_id, provider_id, transcript, recording_url")
    .eq("id", callId)
    .maybeSingle();
  if (!call || !call.transcript) return NextResponse.json({ error: "call or transcript not found" }, { status: 404 });

  const [{ data: provider }, { data: coverage }] = await Promise.all([
    db.from("providers").select("*").eq("id", call.provider_id).maybeSingle(),
    db.from("coverage_prefs").select("want_gap").eq("session_id", call.session_id).maybeSingle(),
  ]);
  if (!provider || !coverage) return NextResponse.json({ error: "provider or coverage missing" }, { status: 404 });

  const real = !!call.recording_url; // vapi calls have a recording, simulated do not
  const ex = await extractFromTranscript(call.transcript);
  const fields = quoteFieldsFromExtraction(real, provider, coverage, ex);

  const { data: existing } = await db.from("quotes").select("id").eq("source_call_id", callId).maybeSingle();
  if (existing) {
    await db.from("quotes").update(fields).eq("id", existing.id);
  } else {
    await db.from("quotes").insert({ session_id: call.session_id, provider_id: call.provider_id, source_call_id: callId, ...fields });
  }

  return NextResponse.json({ ok: true, real, provenance: fields.provenance, outcome: fields.outcome, ref: fields.quote_reference, monthly: fields.monthly_premium });
}
