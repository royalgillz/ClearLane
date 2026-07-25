// the online rate path. named for what it does (a source of filed rates), not for the
// fact that today it is mocked. a real comparative rater or aggregator implements the
// same interface and drops in without touching callers.

export type DriverProfile = {
  zip: string;
  drivesGig: boolean;
  yearsLicensed: number | null;
  accidents3yr: number;
  violations3yr: number;
  annualMileage: number;
  vehicle: { year: number | null; make: string; model: string };
  coverage: {
    biPerPerson: number;
    biPerAccident: number;
    propertyDamage: number;
    pipTier: string;
    deductibleComp: number;
    deductibleColl: number;
    wantUmuim: boolean;
    wantGap: boolean;
    wantRideshare: boolean;
  };
};

export type RateProvider = {
  id: string;
  name: string;
  rideshareAvailable: boolean | null;
  phone: string | null;
  email: string | null;
  businessHoursText: string | null;
};

export type OnlineQuote = {
  providerId: string;
  monthlyPremium: number;
  annualPremium: number;
  quoteReference: string; // SIM-#### for simulated, never a real-looking format
  coverageSummary: Record<string, unknown>;
  endorsements: string[];
  rideshareIncluded: boolean;
  discountsApplied: string[];
  discountsAvailable: string[];
  whatToSay: string;
  expiresAt: string; // yyyy-mm-dd
};

export interface RateSource {
  // human label, surfaced in logs and the provenance story
  readonly label: string;
  quote(profile: DriverProfile, providers: RateProvider[]): OnlineQuote[];
}
