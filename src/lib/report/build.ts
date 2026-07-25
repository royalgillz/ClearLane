import { supabaseAdmin } from "@/lib/supabase-admin";
import { rankQuotes } from "./ranking";
import type { Provenance, ReportModel, ReportOption } from "./types";

const ENTITY_LABEL: Record<string, string> = {
  direct_carrier: "Direct carrier",
  independent_agency: "Independent agency",
  broker: "Broker",
};

type QuoteRow = {
  id: string;
  provider_id: string;
  provenance: Provenance;
  outcome: string;
  quote_reference: string | null;
  monthly_premium: number | null;
  annual_premium: number | null;
  coverage_summary: Record<string, unknown> | null;
  endorsements: string[];
  rideshare_endorsement_included: boolean;
  discounts_applied: string[];
  discounts_available: string[];
  contact_phone: string | null;
  contact_business_hours: string | null;
  contact_email: string | null;
  contact_name: string | null;
  producer_license: string | null;
  expires_at: string | null;
  what_to_say: string | null;
  providers: { name: string; entity_type: string } | { name: string; entity_type: string }[] | null;
};

function providerOf(row: QuoteRow) {
  const p = Array.isArray(row.providers) ? row.providers[0] : row.providers;
  return { name: p?.name ?? "Unknown", entityType: ENTITY_LABEL[p?.entity_type ?? ""] ?? p?.entity_type ?? "" };
}

function money(n: number | null): string {
  return n == null ? "" : `$${Math.round(n)}`;
}

function reasoningFor(row: QuoteRow, name: string, currentInsurer: string | null, savings: number | null): string {
  const isPhone = row.outcome !== "online";
  const save = savings != null && savings > 0 ? ` It saves you about ${money(savings)} a month versus your ${currentInsurer ?? "current"} policy.` : "";

  if (!row.rideshare_endorsement_included) {
    return `At ${money(row.monthly_premium)}/mo this is a real option, but it does not include a rideshare endorsement, so your Period 1 gap stays open. Cheaper is not safer here.`;
  }
  if (isPhone) {
    return `The strongest option, and it closes your rideshare gap. We reached ${name} by phone, the comparison sites never surface this one.${save}`;
  }
  return `Quotable online in minutes and it includes the rideshare endorsement, so your Period 1 gap is covered.${save} You can finish this one yourself tonight.`;
}

export async function assembleReport(sessionId: string, emailTo: string, persist = true): Promise<ReportModel> {
  const db = supabaseAdmin();

  const [{ data: driver }, { data: coverage }, { data: quotes }] = await Promise.all([
    db.from("drivers").select("full_name, drives_gig").eq("session_id", sessionId).maybeSingle(),
    db.from("coverage_prefs").select("current_insurer, current_premium_monthly").eq("session_id", sessionId).maybeSingle(),
    db.from("quotes").select("*, providers(name, entity_type)").eq("session_id", sessionId),
  ]);
  if (!driver) throw new Error("no driver for session");

  const currentMonthly = coverage?.current_premium_monthly ?? null;
  const top = rankQuotes((quotes ?? []) as QuoteRow[]);

  const options: ReportOption[] = top.map((row) => {
    const { name, entityType } = providerOf(row);
    const savings = currentMonthly != null && row.monthly_premium != null ? Math.round(currentMonthly - row.monthly_premium) : null;
    return {
      providerName: name,
      entityType,
      provenance: row.provenance,
      quoteReference: row.quote_reference,
      monthlyPremium: row.monthly_premium,
      annualPremium: row.annual_premium,
      coverageSummary: row.coverage_summary,
      endorsements: row.endorsements ?? [],
      rideshareIncluded: row.rideshare_endorsement_included,
      discountsApplied: row.discounts_applied ?? [],
      discountsAvailable: row.discounts_available ?? [],
      contactPhone: row.contact_phone,
      contactBusinessHours: row.contact_business_hours,
      contactEmail: row.contact_email,
      contactName: row.contact_name,
      producerLicense: row.producer_license,
      expiresAt: row.expires_at,
      whatToSay: row.what_to_say,
      reasoning: reasoningFor(row, name, coverage?.current_insurer ?? null, savings),
      monthlySavings: savings,
    };
  });

  const closedBy = options.filter((o) => o.rideshareIncluded).map((o) => o.providerName);
  const gapSection = {
    hasGap: !!driver.drives_gig,
    text: driver.drives_gig
      ? `Your current ${coverage?.current_insurer ?? "personal"} policy does not include a rideshare endorsement. The moment your Uber or DoorDash app is on but you have not accepted a ride yet (Period 1), a personal policy can legally deny the claim. That is the gap that left a driver in your DoorDash group paying about $4,800 out of pocket.`
      : "No rideshare gap detected for your profile.",
    closedBy,
  };

  const model: ReportModel = {
    driverFirstName: driver.full_name.split(" ")[0],
    currentInsurer: coverage?.current_insurer ?? null,
    currentMonthly,
    options,
    gapSection,
    generatedAt: new Date().toISOString(),
  };

  // persist the report, one per session. skipped for read-only renders (the web view)
  if (persist) {
    await db.from("reports").delete().eq("session_id", sessionId);
    await db.from("reports").insert({
      session_id: sessionId,
      top_quote_ids: top.map((q) => q.id),
      reasoning: options.map((o) => ({ provider: o.providerName, reasoning: o.reasoning })),
      gap_section: gapSection,
      email_to: emailTo,
      email_status: "pending",
    });
  }

  return model;
}
