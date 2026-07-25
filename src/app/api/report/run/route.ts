import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assembleReport } from "@/lib/report/build";
import { sendReport } from "@/lib/report/email";

// rank the 3 best, build the report, send the email. the worker calls this when a session
// is done, for now it is triggerable so we can test and demo.

export async function POST(req: Request) {
  let body: { token?: string; email?: string; send?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: session } = await db
    .from("sessions")
    .select("id, drivers(email)")
    .eq("status_token", body.token)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const driver = Array.isArray(session.drivers) ? session.drivers[0] : session.drivers;
  const emailTo = body.email || driver?.email;
  if (!emailTo) return NextResponse.json({ error: "no email to send to" }, { status: 400 });

  try {
    const model = await assembleReport(session.id, emailTo);
    let emailId: string | null = null;
    if (body.send !== false) emailId = await sendReport(session.id, model, emailTo);
    await db.from("sessions").update({ status: "report_ready" }).eq("id", session.id);
    return NextResponse.json({
      ok: true,
      emailedTo: body.send !== false ? emailTo : null,
      emailId,
      options: model.options.map((o) => ({ provider: o.providerName, monthly: o.monthlyPremium, provenance: o.provenance, ref: o.quoteReference, rideshare: o.rideshareIncluded })),
      gapClosedBy: model.gapSection.closedBy,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "report failed" }, { status: 500 });
  }
}
