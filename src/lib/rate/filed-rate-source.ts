import type { DriverProfile, OnlineQuote, RateProvider, RateSource } from "./types";

// deterministic mock of filed michigan rates. same profile in, same numbers out, so the
// demo is reproducible. realistic detroit full-coverage base (~$430/mo) moved by the
// factors a real rater would use. NOT a real quote: every record is stamped simulated by
// the caller and carries a SIM-#### reference.

// monthly, an average carrier for a clean financed driver. marcus's high-risk factors
// (sporty car, gig, high mileage) push individual carriers up from here, and carrier
// relativity spreads them. tuned so the cheapest online lands below his current $438 and
// the phone-only regionals (resolved separately) are the real ~$150/mo win.
const DETROIT_FULL_COVERAGE_BASE = 330;

// per-carrier relativity. detroit spread between carriers is huge, this reflects it.
const CARRIER_RELATIVITY: Record<string, number> = {
  Progressive: 0.98,
  GEICO: 0.86,
  "Liberty Mutual": 1.14,
};
const DEFAULT_RELATIVITY = 1.0;

const PIP_FACTOR: Record<string, number> = {
  unlimited: 1.18,
  "500k": 1.06,
  "250k": 1.0,
  "50k_medicaid": 0.9,
  optout: 0.82,
};

// clearly-fake but stable reference per provider name
function simRef(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return `SIM-${String(h).padStart(4, "0")}`;
}

function liabilityFactor(p: DriverProfile): number {
  const total = p.coverage.biPerPerson + p.coverage.biPerAccident + p.coverage.propertyDamage;
  if (total >= 850000) return 1.1; // 250/500/100
  if (total >= 450000) return 1.05; // 100/300/50
  return 1.0; // 50/100/10 michigan min
}

function deductibleFactor(p: DriverProfile): number {
  const avg = (p.coverage.deductibleComp + p.coverage.deductibleColl) / 2;
  if (avg <= 250) return 1.08;
  if (avg >= 1000) return 0.93;
  return 1.0;
}

function vehicleFactor(p: DriverProfile): number {
  const sporty = /charger|challenger|mustang|camaro|corvette/i.test(p.vehicle.model);
  return sporty ? 1.1 : 1.0;
}

function mileageFactor(p: DriverProfile): number {
  const over = Math.max(0, p.annualMileage - 12000);
  return 1 + (over / 3000) * 0.03;
}

function historyFactor(p: DriverProfile): number {
  return 1 + p.violations3yr * 0.15 + p.accidents3yr * 0.2;
}

function pipLabel(tier: string): string {
  const map: Record<string, string> = {
    unlimited: "Unlimited medical",
    "500k": "$500k medical",
    "250k": "$250k medical",
    "50k_medicaid": "$50k medical (Medicaid)",
    optout: "PIP opt-out",
  };
  return map[tier] ?? tier;
}

function coverageSummary(p: DriverProfile, rideshareIncluded: boolean) {
  const k = (n: number) => `${n / 1000}k`;
  return {
    liability: `${k(p.coverage.biPerPerson)}/${k(p.coverage.biPerAccident)}/${k(p.coverage.propertyDamage)}`,
    pip: pipLabel(p.coverage.pipTier),
    ppi: "$1M property protection (included)",
    comprehensive: `$${p.coverage.deductibleComp} deductible`,
    collision: `$${p.coverage.deductibleColl} deductible`,
    uninsured_motorist: p.coverage.wantUmuim,
    gap: p.coverage.wantGap,
    rideshare_endorsement: rideshareIncluded,
  };
}

export class FiledRateSource implements RateSource {
  readonly label = "filed-rate mock (Michigan)";

  quote(profile: DriverProfile, providers: RateProvider[]): OnlineQuote[] {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    return providers.map((provider) => {
      const rel = CARRIER_RELATIVITY[provider.name] ?? DEFAULT_RELATIVITY;
      const gigRisk = profile.drivesGig ? 1.05 : 1.0;

      let monthly =
        DETROIT_FULL_COVERAGE_BASE *
        rel *
        (PIP_FACTOR[profile.coverage.pipTier] ?? 1.0) *
        liabilityFactor(profile) *
        deductibleFactor(profile) *
        vehicleFactor(profile) *
        mileageFactor(profile) *
        historyFactor(profile) *
        gigRisk;

      const rideshareIncluded = !!profile.coverage.wantRideshare && provider.rideshareAvailable === true;
      // the endorsement is cheap, mid of the $6-40/mo range
      if (rideshareIncluded) monthly += 18;

      const monthlyPremium = Math.round(monthly);
      const annualPremium = Math.round(monthlyPremium * 12 * 0.96); // small pay-in-full style break

      const endorsements: string[] = [];
      if (profile.coverage.wantGap) endorsements.push("Gap coverage");
      if (rideshareIncluded) endorsements.push("Rideshare / delivery endorsement");

      return {
        providerId: provider.id,
        monthlyPremium,
        annualPremium,
        quoteReference: simRef(provider.name),
        coverageSummary: coverageSummary(profile, rideshareIncluded),
        endorsements,
        rideshareIncluded,
        discountsApplied: ["Paperless", "Pay in full"],
        discountsAvailable: ["Bundle (renters/home)", "Telematics / safe driving", "Autopay"],
        whatToSay: `Finish online, or call ${provider.name} and reference ${simRef(provider.name)}.`,
        expiresAt: expires,
      };
    });
  }
}
