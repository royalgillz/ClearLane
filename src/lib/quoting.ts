import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatBusinessHours } from "@/lib/hours";
import { getRateSource, type DriverProfile, type RateProvider } from "@/lib/rate";

// resolve the online quote path for a session: mocked filed rates for the carriers that
// quote online. every row is stamped provenance 'simulated' and carries a SIM-#### ref.
// phone quotes are a separate path (the voice agent). idempotent per session.

export async function resolveOnlineQuotes(sessionId: string) {
  const db = supabaseAdmin();

  const [{ data: driver }, { data: vehicle }, { data: coverage }, { data: providers }] = await Promise.all([
    db.from("drivers").select("*").eq("session_id", sessionId).maybeSingle(),
    db.from("vehicles").select("*").eq("session_id", sessionId).maybeSingle(),
    db.from("coverage_prefs").select("*").eq("session_id", sessionId).maybeSingle(),
    db.from("providers").select("*").eq("quotes_online", true),
  ]);

  if (!driver || !vehicle || !coverage) throw new Error("session is missing intake rows");

  const profile: DriverProfile = {
    zip: driver.zip,
    drivesGig: driver.drives_gig,
    yearsLicensed: driver.years_licensed,
    accidents3yr: driver.accidents_3yr,
    violations3yr: driver.violations_3yr,
    annualMileage: vehicle.annual_mileage,
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model },
    coverage: {
      biPerPerson: coverage.bi_per_person,
      biPerAccident: coverage.bi_per_accident,
      propertyDamage: coverage.property_damage,
      pipTier: coverage.pip_tier,
      deductibleComp: coverage.deductible_comp,
      deductibleColl: coverage.deductible_coll,
      wantUmuim: coverage.want_umuim,
      wantGap: coverage.want_gap,
      wantRideshare: coverage.want_rideshare_endorsement,
    },
  };

  const rateProviders: RateProvider[] = (providers ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    rideshareAvailable: p.rideshare_endorsement_available,
    phone: p.phone,
    email: p.email,
    businessHoursText: formatBusinessHours(p.business_hours, p.timezone),
  }));

  const quotes = getRateSource().quote(profile, rateProviders);
  const byId = new Map(rateProviders.map((p) => [p.id, p]));

  // idempotent: clear prior online rows so a re-run does not stack duplicates
  await db.from("quotes").delete().eq("session_id", sessionId).eq("outcome", "online");

  const rows = quotes.map((q) => {
    const p = byId.get(q.providerId)!;
    return {
      session_id: sessionId,
      provider_id: q.providerId,
      provenance: "simulated" as const,
      outcome: "online" as const,
      quote_reference: q.quoteReference,
      monthly_premium: q.monthlyPremium,
      annual_premium: q.annualPremium,
      coverage_summary: q.coverageSummary,
      endorsements: q.endorsements,
      rideshare_endorsement_included: q.rideshareIncluded,
      discounts_applied: q.discountsApplied,
      discounts_available: q.discountsAvailable,
      contact_phone: p.phone,
      contact_business_hours: p.businessHoursText,
      contact_email: p.email,
      what_to_say: q.whatToSay,
      expires_at: q.expiresAt,
    };
  });

  const { data: inserted, error } = await db.from("quotes").insert(rows).select("id, provider_id, monthly_premium");
  if (error) throw new Error(`quote insert failed: ${error.message}`);
  return inserted ?? [];
}
