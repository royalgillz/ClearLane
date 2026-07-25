import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyBranches, type IntakeForm } from "@/lib/intake";

// persist intake, return a status token for the confirmation url. this is the async
// handoff: we save, marcus leaves, the worker does the rest later.

function token() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

export async function POST(req: Request) {
  let body: { form?: IntakeForm; intakeSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const raw = body.form;
  if (!raw || !raw.full_name || !raw.email || !raw.zip) {
    return NextResponse.json({ error: "name, email, and zip are required" }, { status: 400 });
  }
  const form = applyBranches(raw); // never trust the client to have applied the branches

  // instrumented completion time. logged so we can report the actual number.
  const intakeSeconds = Number.isFinite(body.intakeSeconds) ? Math.round(body.intakeSeconds!) : null;
  console.log(`[intake] ${form.full_name} completed in ${intakeSeconds}s, gig=${form.drives_gig}, financed=${form.ownership}`);

  const db = supabaseAdmin();
  const statusToken = token();

  const { data: session, error: sErr } = await db
    .from("sessions")
    .insert({ status: "submitted", status_token: statusToken, intake_seconds: intakeSeconds })
    .select("id")
    .single();
  if (sErr || !session) {
    console.error("[intake] session insert failed", sErr?.message);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }
  const sessionId = session.id;

  const { error: dErr } = await db.from("drivers").insert({
    session_id: sessionId,
    full_name: form.full_name,
    dob: form.dob || null,
    zip: form.zip,
    email: form.email,
    phone: form.phone || null,
    marital_status: form.marital_status,
    occupation: form.occupation || null,
    license_status: form.license_status,
    years_licensed: form.years_licensed,
    drives_gig: form.drives_gig,
    gig_platforms: form.gig_platforms,
    accidents_3yr: form.accidents_3yr,
    violations_3yr: form.violations_3yr,
    suspensions: form.suspensions,
    continuous_coverage: form.continuous_coverage,
    past_claims: form.past_claims,
  });

  const { error: vErr } = await db.from("vehicles").insert({
    session_id: sessionId,
    vin: form.vin || null,
    year: form.year,
    make: form.make || null,
    model: form.model || null,
    body: form.body || null,
    engine: form.engine || null,
    ownership: form.ownership,
    primary_use: form.primary_use || null,
    annual_mileage: form.annual_mileage,
    overnight_parking: form.overnight_parking || null,
    vin_decode_ok: form.vin_decode_ok,
  });

  const { error: cErr } = await db.from("coverage_prefs").insert({
    session_id: sessionId,
    bi_per_person: form.bi_per_person,
    bi_per_accident: form.bi_per_accident,
    property_damage: form.property_damage,
    pip_tier: form.pip_tier,
    ppi_included: true,
    deductible_comp: form.deductible_comp,
    deductible_coll: form.deductible_coll,
    want_umuim: form.want_umuim,
    want_roadside: form.want_roadside,
    want_rental: form.want_rental,
    want_gap: form.want_gap,
    want_rideshare_endorsement: form.want_rideshare_endorsement,
    current_insurer: form.current_insurer || null,
    current_premium_monthly: form.current_premium_monthly,
    current_limits: form.current_limits || null,
  });

  if (dErr || vErr || cErr) {
    console.error("[intake] child insert failed", dErr?.message, vErr?.message, cErr?.message);
    // session is orphaned but harmless for the demo. do not fabricate success.
    return NextResponse.json({ error: "could not save details" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, statusToken });
}
