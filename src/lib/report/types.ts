export type Provenance = "verified_on_call" | "agent_stated" | "online_quoted" | "simulated";

// everything the report needs per option so marcus can finish the purchase himself.
export type ReportOption = {
  providerName: string;
  entityType: string; // direct_carrier | independent_agency | broker
  provenance: Provenance;
  quoteReference: string | null;
  monthlyPremium: number | null;
  annualPremium: number | null;
  coverageSummary: Record<string, unknown> | null;
  endorsements: string[];
  rideshareIncluded: boolean;
  discountsApplied: string[];
  discountsAvailable: string[];
  contactPhone: string | null;
  contactBusinessHours: string | null;
  contactEmail: string | null;
  contactName: string | null;
  producerLicense: string | null;
  expiresAt: string | null;
  whatToSay: string | null;
  reasoning: string; // references marcus's real situation
  monthlySavings: number | null; // vs current premium
};

export type ReportModel = {
  driverFirstName: string;
  currentInsurer: string | null;
  currentMonthly: number | null;
  options: ReportOption[];
  gapSection: { hasGap: boolean; text: string; closedBy: string[] };
  generatedAt: string;
};
