"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyBranches,
  defaultIntake,
  estimateYearsLicensed,
  DEDUCTIBLE_OPTIONS,
  GIG_PLATFORMS,
  LIABILITY_OPTIONS,
  PIP_TIER_OPTIONS,
  type IntakeForm as Form,
} from "@/lib/intake";

const STEP_TITLES = ["You", "Your car", "Your driving", "History", "Current policy", "What you want"];
const TOTAL = STEP_TITLES.length;

export default function IntakeForm() {
  const router = useRouter();
  const startRef = useRef<number>(Date.now());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(defaultIntake);
  const [vinState, setVinState] = useState<"idle" | "loading" | "ok" | "miss">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // one setter, always re-runs the conditional branches so gap/rideshare stay correct
  function update(patch: Partial<Form>) {
    setForm((f) => applyBranches({ ...f, ...patch }));
  }

  const financed = form.ownership === "finance" || form.ownership === "lease";

  async function decodeVin() {
    if (form.vin.trim().length < 11) return;
    setVinState("loading");
    try {
      const res = await fetch(`/api/vin?vin=${encodeURIComponent(form.vin.trim())}`);
      const data = await res.json();
      if (data.ok) {
        update({ ...data.vehicle, vin_decode_ok: true });
        setVinState("ok");
      } else {
        update({ vin_decode_ok: false });
        setVinState("miss");
      }
    } catch {
      update({ vin_decode_ok: false });
      setVinState("miss");
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return !!(form.full_name && form.email && form.zip);
    return true;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const intakeSeconds = (Date.now() - startRef.current) / 1000;
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, intakeSeconds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "something went wrong");
      router.push(`/status/${data.statusToken}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <Progress step={step} />
      <h2 className="mt-4 text-2xl font-bold text-ink">{STEP_TITLES[step]}</h2>

      <div className="mt-5 flex-1 space-y-4">
        {step === 0 && <StepYou form={form} update={update} />}
        {step === 1 && (
          <StepCar form={form} update={update} vinState={vinState} decodeVin={decodeVin} financed={financed} />
        )}
        {step === 2 && <StepDriving form={form} update={update} />}
        {step === 3 && <StepHistory form={form} update={update} />}
        {step === 4 && <StepCurrent form={form} update={update} />}
        {step === 5 && <StepWants form={form} update={update} financed={financed} />}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="min-h-[52px] flex-1 rounded-xl border border-slate-300 px-4 text-base font-semibold text-slate-700"
          >
            Back
          </button>
        )}
        {step < TOTAL - 1 ? (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            className="min-h-[52px] flex-[2] rounded-xl bg-accent px-4 text-base font-semibold text-white disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="min-h-[52px] flex-[2] rounded-xl bg-accent px-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Get my 3 best options"}
          </button>
        )}
      </div>
    </main>
  );
}

function Progress({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>
          Step {step + 1} of {TOTAL}
        </span>
        <span>under 3 minutes</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---- small field primitives, kept local. two call sites do not justify a lib. ----

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{children}</label>;
}

const inputClass =
  "mt-1 block w-full min-h-[48px] rounded-lg border border-slate-300 px-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Text({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input className={inputClass} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-11 w-11 rounded-lg border border-slate-300 text-xl font-semibold text-slate-700"
          aria-label={`decrease ${label}`}
        >
          -
        </button>
        <span className="w-6 text-center text-lg font-semibold text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-11 w-11 rounded-lg border border-slate-300 text-xl font-semibold text-slate-700"
          aria-label={`increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
        value ? "border-accent bg-teal-50" : "border-slate-300"
      }`}
    >
      <span>
        <span className="block text-base font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <span className={`ml-3 h-6 w-11 flex-shrink-0 rounded-full ${value ? "bg-accent" : "bg-slate-300"} relative transition-colors`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{children}</div>
  );
}

// ---- steps ----

type StepProps = { form: Form; update: (p: Partial<Form>) => void };

function StepYou({ form, update }: StepProps) {
  return (
    <>
      <Text label="Full name" value={form.full_name} onChange={(v) => update({ full_name: v })} placeholder="Marcus Boswell" />
      <Text
        label="Date of birth"
        type="date"
        value={form.dob}
        onChange={(v) => update({ dob: v, years_licensed: estimateYearsLicensed(v) })}
      />
      <Text label="ZIP code" value={form.zip} onChange={(v) => update({ zip: v })} placeholder="48228" />
      <Text label="Email" type="email" value={form.email} onChange={(v) => update({ email: v })} placeholder="you@email.com" />
      <Text label="Phone" type="tel" value={form.phone} onChange={(v) => update({ phone: v })} placeholder="(313) 555-0100" />
    </>
  );
}

function StepCar({
  form, update, vinState, decodeVin, financed,
}: StepProps & { vinState: string; decodeVin: () => void; financed: boolean }) {
  return (
    <>
      <div>
        <Label>VIN (we auto-fill your car)</Label>
        <div className="mt-1 flex gap-2">
          <input
            className={inputClass}
            value={form.vin}
            onChange={(e) => update({ vin: e.target.value.toUpperCase() })}
            placeholder="17 characters, on the dash or door"
          />
          <button
            type="button"
            onClick={decodeVin}
            className="min-h-[48px] whitespace-nowrap rounded-lg bg-ink px-4 text-sm font-semibold text-white"
          >
            {vinState === "loading" ? "..." : "Decode"}
          </button>
        </div>
        {vinState === "ok" && (
          <p className="mt-2 text-sm font-medium text-teal-700">
            Got it: {form.year} {form.make} {form.model}
          </p>
        )}
        {vinState === "miss" && (
          <p className="mt-2 text-sm text-amber-700">Could not read that VIN. No worries, type the car below.</p>
        )}
      </div>

      {(vinState === "miss" || vinState === "ok") && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <Label>Year</Label>
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.year ?? ""}
              onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="col-span-1">
            <Label>Make</Label>
            <input className={inputClass} value={form.make} onChange={(e) => update({ make: e.target.value })} />
          </div>
          <div className="col-span-1">
            <Label>Model</Label>
            <input className={inputClass} value={form.model} onChange={(e) => update({ model: e.target.value })} />
          </div>
        </div>
      )}

      <Select
        label="Do you own, finance, or lease it?"
        value={form.ownership}
        onChange={(v) => update({ ownership: v as Form["ownership"] })}
        options={[
          { value: "own", label: "Own it outright" },
          { value: "finance", label: "Financing (making payments)" },
          { value: "lease", label: "Leasing" },
        ]}
      />
      {financed && (
        <Note>
          Since it is financed, your lender requires full coverage. We will also line up gap
          insurance so a total loss does not leave you owing on a car you no longer have.
        </Note>
      )}

      <Select
        label="Main use"
        value={form.primary_use}
        onChange={(v) => update({ primary_use: v })}
        options={[
          { value: "commute", label: "Commuting" },
          { value: "pleasure", label: "Personal / pleasure" },
          { value: "business", label: "Business" },
        ]}
      />
      <Text
        label="Miles you drive a year"
        type="number"
        value={String(form.annual_mileage)}
        onChange={(v) => update({ annual_mileage: v ? Number(v) : 12000 })}
      />
      <Select
        label="Where it parks overnight"
        value={form.overnight_parking}
        onChange={(v) => update({ overnight_parking: v })}
        options={[
          { value: "street", label: "On the street" },
          { value: "driveway", label: "Driveway" },
          { value: "garage", label: "Garage" },
          { value: "lot", label: "Parking lot" },
        ]}
      />
    </>
  );
}

function StepDriving({ form, update }: StepProps) {
  return (
    <>
      <Select
        label="Marital status"
        value={form.marital_status}
        onChange={(v) => update({ marital_status: v })}
        options={[
          { value: "single", label: "Single" },
          { value: "married", label: "Married" },
          { value: "domestic_partner", label: "Living with partner" },
          { value: "divorced", label: "Divorced" },
          { value: "widowed", label: "Widowed" },
        ]}
      />
      <Text label="Occupation" value={form.occupation} onChange={(v) => update({ occupation: v })} placeholder="Warehouse picker" />
      <Select
        label="License status"
        value={form.license_status}
        onChange={(v) => update({ license_status: v })}
        options={[
          { value: "valid", label: "Valid" },
          { value: "permit", label: "Permit" },
          { value: "suspended", label: "Suspended" },
          { value: "expired", label: "Expired" },
        ]}
      />
      <Text
        label="Years licensed"
        type="number"
        value={form.years_licensed == null ? "" : String(form.years_licensed)}
        onChange={(v) => update({ years_licensed: v ? Number(v) : null })}
      />

      <Toggle
        label="Do you drive for Uber, Lyft, DoorDash, or similar?"
        value={form.drives_gig}
        onChange={(v) => update({ drives_gig: v })}
        hint="This is the question that fixes the gap that can deny your claim."
      />
      {form.drives_gig && (
        <>
          <div className="flex flex-wrap gap-2">
            {GIG_PLATFORMS.map((p) => {
              const on = form.gig_platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    update({ gig_platforms: on ? form.gig_platforms.filter((x) => x !== p) : [...form.gig_platforms, p] })
                  }
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${
                    on ? "border-accent bg-accent text-white" : "border-slate-300 text-slate-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <Note>
            We turned on the rideshare endorsement. It closes the Period 1 gap (app on, no
            passenger yet) that your personal policy does not cover.
          </Note>
        </>
      )}
    </>
  );
}

function StepHistory({ form, update }: StepProps) {
  return (
    <>
      <p className="text-sm text-slate-500">Most people tap through this. Defaults are set to none.</p>
      <Counter label="At-fault accidents (last 3 years)" value={form.accidents_3yr} onChange={(v) => update({ accidents_3yr: v })} />
      <Counter label="Tickets / violations (last 3 years)" value={form.violations_3yr} onChange={(v) => update({ violations_3yr: v })} />
      <Counter label="License suspensions" value={form.suspensions} onChange={(v) => update({ suspensions: v })} />
      <Counter label="Past claims" value={form.past_claims} onChange={(v) => update({ past_claims: v })} />
      <Toggle
        label="Insured continuously (no gap over 30 days)?"
        value={form.continuous_coverage}
        onChange={(v) => update({ continuous_coverage: v })}
      />
    </>
  );
}

function StepCurrent({ form, update }: StepProps) {
  return (
    <>
      <p className="text-sm text-slate-500">So we can show you exactly how much you save. Optional.</p>
      <Text label="Current insurer" value={form.current_insurer} onChange={(v) => update({ current_insurer: v })} placeholder="Direct Auto" />
      <Text
        label="Current monthly premium"
        type="number"
        value={form.current_premium_monthly == null ? "" : String(form.current_premium_monthly)}
        onChange={(v) => update({ current_premium_monthly: v ? Number(v) : null })}
        placeholder="438"
      />
      <Text label="Current limits (if you know them)" value={form.current_limits} onChange={(v) => update({ current_limits: v })} placeholder="optional" />
    </>
  );
}

function StepWants({ form, update, financed }: StepProps & { financed: boolean }) {
  const liabilityKey = useMemo(
    () => `${form.bi_per_person}/${form.bi_per_accident}/${form.property_damage}`,
    [form.bi_per_person, form.bi_per_accident, form.property_damage]
  );
  return (
    <>
      <div>
        <Label>Liability limits</Label>
        <div className="mt-2 space-y-2">
          {LIABILITY_OPTIONS.map((o) => {
            const key = `${o.bi_per_person}/${o.bi_per_accident}/${o.property_damage}`;
            const on = key === liabilityKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ bi_per_person: o.bi_per_person, bi_per_accident: o.bi_per_accident, property_damage: o.property_damage })}
                className={`w-full rounded-xl border px-4 py-3 text-left text-base font-medium ${
                  on ? "border-accent bg-teal-50 text-ink" : "border-slate-300 text-slate-700"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Michigan PIP medical coverage</Label>
        <div className="mt-2 space-y-2">
          {PIP_TIER_OPTIONS.map((o) => {
            const on = o.value === form.pip_tier;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => update({ pip_tier: o.value })}
                className={`w-full rounded-xl border px-4 py-3 text-left ${on ? "border-accent bg-teal-50" : "border-slate-300"}`}
              >
                <span className="block text-base font-medium text-ink">{o.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{o.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Note>$1,000,000 Property Protection (PPI) is included. In Michigan it is required, not a choice.</Note>

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Comprehensive deductible"
          value={String(form.deductible_comp)}
          onChange={(v) => update({ deductible_comp: Number(v) })}
          options={DEDUCTIBLE_OPTIONS.map((d) => ({ value: String(d), label: `$${d}` }))}
        />
        <Select
          label="Collision deductible"
          value={String(form.deductible_coll)}
          onChange={(v) => update({ deductible_coll: Number(v) })}
          options={DEDUCTIBLE_OPTIONS.map((d) => ({ value: String(d), label: `$${d}` }))}
        />
      </div>

      <div className="space-y-2">
        <Toggle label="Uninsured / underinsured motorist" value={form.want_umuim} onChange={(v) => update({ want_umuim: v })} />
        <Toggle label="Roadside assistance" value={form.want_roadside} onChange={(v) => update({ want_roadside: v })} />
        <Toggle label="Rental car reimbursement" value={form.want_rental} onChange={(v) => update({ want_rental: v })} />
        <Toggle
          label="Gap insurance"
          value={form.want_gap}
          onChange={(v) => update({ want_gap: v })}
          hint={financed ? "On because your car is financed." : undefined}
        />
        <Toggle
          label="Rideshare / delivery endorsement"
          value={form.want_rideshare_endorsement}
          onChange={(v) => update({ want_rideshare_endorsement: v })}
          hint={form.drives_gig ? "On because you drive gig. Closes the Period 1 gap." : undefined}
        />
      </div>
    </>
  );
}
