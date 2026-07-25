// the shape marcus fills out. 25 questions grouped so they feel like 6 steps. every
// risky field has a safe default so he taps "next" and corrects two things.

export type Ownership = "own" | "finance" | "lease";
export type PipTier = "unlimited" | "500k" | "250k" | "50k_medicaid" | "optout";

export type IntakeForm = {
  // step 1, who + where
  full_name: string;
  dob: string; // yyyy-mm-dd
  zip: string;
  email: string;
  phone: string;

  // step 2, the car
  vin: string;
  year: number | null;
  make: string;
  model: string;
  body: string;
  engine: string;
  vin_decode_ok: boolean | null;
  ownership: Ownership;
  primary_use: string;
  annual_mileage: number;
  overnight_parking: string;

  // step 3, you as a driver
  marital_status: string;
  occupation: string;
  license_status: string;
  years_licensed: number | null;
  drives_gig: boolean;
  gig_platforms: string[];

  // step 4, history (all default clean)
  accidents_3yr: number;
  violations_3yr: number;
  suspensions: number;
  continuous_coverage: boolean;
  past_claims: number;

  // step 5, current coverage
  current_insurer: string;
  current_premium_monthly: number | null;
  current_limits: string;

  // step 6, what you want
  bi_per_person: number;
  bi_per_accident: number;
  property_damage: number;
  pip_tier: PipTier;
  ppi_included: true; // $1M PPI is required in MI, not a choice
  deductible_comp: number;
  deductible_coll: number;
  want_umuim: boolean;
  want_roadside: boolean;
  want_rental: boolean;
  want_gap: boolean;
  want_rideshare_endorsement: boolean;
};

export const GIG_PLATFORMS = ["Uber", "Lyft", "DoorDash", "Instacart", "Grubhub", "Amazon Flex"];

// michigan default liability, with one-tap upgrades
export const LIABILITY_OPTIONS = [
  { label: "50 / 100 / 10 (Michigan minimum)", bi_per_person: 50000, bi_per_accident: 100000, property_damage: 10000 },
  { label: "100 / 300 / 50 (more protection)", bi_per_person: 100000, bi_per_accident: 300000, property_damage: 50000 },
  { label: "250 / 500 / 100 (most protection)", bi_per_person: 250000, bi_per_accident: 500000, property_damage: 100000 },
];

// the confusing michigan choice a phone agent earns its keep on. plain-english tradeoffs.
export const PIP_TIER_OPTIONS: { value: PipTier; label: string; blurb: string }[] = [
  { value: "unlimited", label: "Unlimited medical", blurb: "The most protection. Costs the most." },
  { value: "500k", label: "$500,000 medical", blurb: "Strong protection, mid cost." },
  { value: "250k", label: "$250,000 medical", blurb: "The common pick. Cheapest tier that still covers a real hospital stay." },
  { value: "50k_medicaid", label: "$50,000 (Medicaid only)", blurb: "Only if you are on Medicaid. Cheap but thin." },
  { value: "optout", label: "Opt out", blurb: "Only with qualifying health coverage. Cheapest, riskiest." },
];

export const DEDUCTIBLE_OPTIONS = [250, 500, 1000];

export function estimateYearsLicensed(dob: string): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  // rough: assume licensed at 18. editable on the form.
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return Math.max(0, age - 18);
}

export function defaultIntake(): IntakeForm {
  return {
    full_name: "", dob: "", zip: "", email: "", phone: "",
    vin: "", year: null, make: "", model: "", body: "", engine: "", vin_decode_ok: null,
    ownership: "finance", // most sporty-car gig drivers finance, and it forces the gap surfacing
    primary_use: "commute", annual_mileage: 12000, overnight_parking: "street",
    marital_status: "single", occupation: "", license_status: "valid", years_licensed: null,
    drives_gig: false, gig_platforms: [],
    accidents_3yr: 0, violations_3yr: 0, suspensions: 0, continuous_coverage: true, past_claims: 0,
    current_insurer: "", current_premium_monthly: null, current_limits: "",
    bi_per_person: 50000, bi_per_accident: 100000, property_damage: 10000,
    pip_tier: "250k", ppi_included: true, deductible_comp: 500, deductible_coll: 500,
    want_umuim: true, want_roadside: false, want_rental: false,
    want_gap: false, want_rideshare_endorsement: false,
  };
}

// conditional branches: financed/leased forces full coverage + surfaces gap. gig flips
// the rideshare endorsement on. call this whenever ownership or gig answers change.
export function applyBranches(form: IntakeForm): IntakeForm {
  const financed = form.ownership === "finance" || form.ownership === "lease";
  return {
    ...form,
    want_gap: financed ? true : form.want_gap,
    want_rideshare_endorsement: form.drives_gig ? true : form.want_rideshare_endorsement,
  };
}
