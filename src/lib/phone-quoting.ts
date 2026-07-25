import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatBusinessHours } from "@/lib/hours";
import { getCallProvider, type CallRequest } from "@/lib/voice";
import { assertSafeToolInput } from "@/lib/voice/denylist";
import { extractFromTranscript, type CallExtraction } from "@/lib/voice/extract";

// provider + coverage shapes we read off the db rows (loose, they come from supabase-js)
type ProviderRow = { name: string; phone: string | null; email: string | null; business_hours: unknown; timezone: string };
type CoverageRow = { want_gap: boolean };

// turn an extraction into the honest quote fields. this is where provenance and the quote
// reference are decided, shared by a fresh call and a re-extract so they can never diverge.
export function quoteFieldsFromExtraction(real: boolean, provider: ProviderRow, coverage: CoverageRow, ex: CallExtraction) {
  const gotRef = !!ex.quoteReference;

  let provenance: "verified_on_call" | "agent_stated" | "simulated";
  let quoteReference: string | null;
  if (!real) {
    provenance = "simulated";
    quoteReference = simRef(provider.name); // never the extracted real-looking ref
  } else {
    provenance = gotRef ? "verified_on_call" : "agent_stated";
    quoteReference = ex.quoteReference;
  }

  const outcome: "success" | "partial" = ex.premiumMonthly != null && (real ? gotRef : true) ? "success" : "partial";
  const monthly = ex.premiumMonthly;
  const annual = ex.premiumAnnual ?? (monthly != null ? Math.round(monthly * 12 * 0.96) : null);
  const contactFirst = ex.contactName?.split(" ")[0] ?? "the agent";
  const refForScript = quoteReference ?? "your quote";

  const endorsements: string[] = [];
  if (coverage.want_gap) endorsements.push("Gap coverage");
  if (ex.rideshareIncluded) endorsements.push("Rideshare / delivery endorsement");

  const days = ex.expiresInDays ?? 30;
  const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return {
    provenance,
    outcome,
    quote_reference: quoteReference,
    monthly_premium: monthly,
    annual_premium: annual,
    coverage_summary: {
      liability: "50k/100k/10k", pip: "$250k medical", ppi: "$1M property protection (included)",
      carrier: ex.carrier, rideshare_endorsement: ex.rideshareIncluded, gap: coverage.want_gap,
    },
    endorsements,
    rideshare_endorsement_included: ex.rideshareIncluded,
    discounts_applied: ex.discountsApplied,
    discounts_available: ex.discountsAvailable,
    contact_phone: provider.phone,
    contact_business_hours: formatBusinessHours(provider.business_hours as never, provider.timezone),
    contact_email: ex.contactEmail ?? provider.email,
    contact_name: ex.contactName,
    producer_license: ex.producerLicense,
    what_to_say: `Ask for ${contactFirst} and reference ${refForScript}.`,
    expires_at: expiresAt,
    transcript_evidence: ex.quoteReferenceEvidence,
  };
}

// resolve one phone call job: place the call, extract the outcome with claude, and persist
// a call row plus a quote row. honesty is enforced here, not hoped for:
//  - a call that did not connect writes a failed call and NO quote (VOICE-PROV-003)
//  - a simulated call is stamped provenance 'simulated' with a SIM-#### ref, never a real
//    one and never 'verified_on_call' (VOICE-PROV-002)
//  - a completed call with no quote reference is 'partial', not 'success' (VOICE-PROV-001)

function simRef(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return `SIM-${String(h).padStart(4, "0")}`;
}

type CallJob = { id: string; session_id: string; provider_id: string };

export async function resolveCallJob(job: CallJob) {
  const db = supabaseAdmin();

  const [{ data: driver }, { data: vehicle }, { data: coverage }, { data: provider }] = await Promise.all([
    db.from("drivers").select("*").eq("session_id", job.session_id).maybeSingle(),
    db.from("vehicles").select("*").eq("session_id", job.session_id).maybeSingle(),
    db.from("coverage_prefs").select("*").eq("session_id", job.session_id).maybeSingle(),
    db.from("providers").select("*").eq("id", job.provider_id).maybeSingle(),
  ]);
  if (!driver || !vehicle || !coverage || !provider) throw new Error("job is missing session or provider rows");

  const vehicleDesc = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const req: CallRequest = {
    sessionId: job.session_id,
    providerId: job.provider_id,
    // demo dials the verified teammate line if set, otherwise the seeded provider phone
    toNumber: process.env.BROKER_PHONE_NUMBER || provider.phone || "",
    brief: {
      driverName: driver.full_name,
      dob: driver.dob,
      zip: driver.zip,
      vehicle: vehicleDesc,
      yearsLicensed: driver.years_licensed,
      cleanRecord: driver.accidents_3yr === 0 && driver.violations_3yr === 0,
      gigPlatforms: driver.gig_platforms ?? [],
      wantsRideshareEndorsement: coverage.want_rideshare_endorsement,
      coverageAsk: "full coverage, MI 50/100/10, PIP 250k, $500 deductibles, gap, rideshare endorsement",
    },
  };
  // the brief is built from safe fields, but check anyway per VOICE-SAFE-005
  assertSafeToolInput(req.brief);

  const result = await getCallProvider().placeCall(req);

  // did not connect: record it failed, do not synthesize an outcome
  if (!result.connected) {
    const { data: call } = await db
      .from("calls")
      .insert({
        call_job_id: job.id, session_id: job.session_id, provider_id: job.provider_id,
        status: "failed", disclosure_spoken: result.disclosureSpoken,
        started_at: result.startedAt, ended_at: result.endedAt,
      })
      .select("id")
      .single();
    await db.from("call_jobs").update({ status: "failed" }).eq("id", job.id);
    return { callId: call?.id, outcome: "failed" as const, quoteId: null };
  }

  const { data: call } = await db
    .from("calls")
    .insert({
      call_job_id: job.id, session_id: job.session_id, provider_id: job.provider_id,
      status: "completed", recording_url: result.recordingUrl, transcript: result.transcript,
      disclosure_spoken: result.disclosureSpoken,
      ttfa_ms: result.latency.ttfaMs, latency_p50_ms: result.latency.p50Ms, latency_p95_ms: result.latency.p95Ms,
      started_at: result.startedAt, ended_at: result.endedAt,
    })
    .select("id")
    .single();
  const callId = call!.id;

  const ex = await extractFromTranscript(result.transcript);
  const fields = quoteFieldsFromExtraction(result.real, provider, coverage, ex);

  const { data: quote } = await db
    .from("quotes")
    .insert({ session_id: job.session_id, provider_id: job.provider_id, source_call_id: callId, ...fields })
    .select("id")
    .single();

  await db.from("call_jobs").update({ status: fields.outcome === "success" ? "succeeded" : "partial" }).eq("id", job.id);

  return { callId, outcome: fields.outcome, quoteId: quote?.id, provenance: fields.provenance, quoteReference: fields.quote_reference, monthly: fields.monthly_premium };
}
