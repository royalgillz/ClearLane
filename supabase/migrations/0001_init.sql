-- clearlane core schema. one driver, every carrier, one call.
-- async by design: intake persists, call_jobs get scheduled per provider business
-- hours, a worker drains them, then a report generates and emails.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- enums. small stable value sets. provenance is the honesty backbone.
-- ---------------------------------------------------------------------------

create type session_status as enum (
  'submitted',    -- intake saved, jobs not yet enqueued
  'quoting',      -- worker draining online + phone jobs
  'report_ready', -- all jobs terminal (or deadline), report sent
  'failed'
);

create type provenance as enum (
  'verified_on_call', -- heard on a completed call AND has a real quote reference
  'agent_stated',     -- the voice agent stated it but it was not independently verified
  'online_quoted',    -- pulled from an online rate path
  'simulated'         -- mocked filed-rate data. quote_reference must be SIM-####
);

create type provider_entity_type as enum ('direct_carrier', 'independent_agency', 'broker');
create type provider_channel as enum ('online', 'phone', 'both');

create type vehicle_ownership as enum ('own', 'finance', 'lease');

-- michigan no-fault pip medical tier choice. this is the confusing thing a phone
-- agent earns its keep on. 250k is the default, cheapest tier that still covers a
-- real hospital stay.
create type pip_medical_tier as enum ('unlimited', '500k', '250k', '50k_medicaid', 'optout');

create type call_job_status as enum (
  'pending',     -- created, waiting for its scheduled window
  'scheduled',   -- window reached, ready for the worker
  'in_progress',
  'succeeded',   -- call completed with a quote reference
  'partial',     -- call completed but no quote reference obtained
  'failed'       -- call did not complete. never synthesize an outcome here.
);

create type call_status as enum ('completed', 'no_answer', 'failed');

create type quote_outcome as enum ('success', 'partial', 'failed', 'online');

create type report_email_status as enum ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- intake
-- ---------------------------------------------------------------------------

create table sessions (
  id uuid primary key default gen_random_uuid(),
  status session_status not null default 'submitted',
  -- opaque token in the status url so we do not expose the raw session id
  status_token text not null unique,
  intake_seconds integer, -- instrumented completion time, target under 180
  report_deadline_at timestamptz, -- generate the report by here even if a job hangs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  full_name text not null,
  dob date not null,
  zip text not null,
  email text not null,
  phone text,
  marital_status text,
  occupation text,
  license_status text not null default 'valid',
  years_licensed integer,
  drives_gig boolean not null default false,
  gig_platforms text[] not null default '{}',
  -- history, all default to clean, one tap to add on the form
  accidents_3yr integer not null default 0,
  violations_3yr integer not null default 0,
  suspensions integer not null default 0,
  continuous_coverage boolean not null default true,
  past_claims integer not null default 0,
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  vin text,
  year integer,
  make text,
  model text,
  body text,
  engine text,
  ownership vehicle_ownership not null default 'finance',
  primary_use text,
  annual_mileage integer not null default 12000,
  overnight_parking text,
  vin_decode_ok boolean, -- null = not attempted, false = decode failed, true = decoded
  created_at timestamptz not null default now()
);

create table coverage_prefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  -- michigan 50/100/10 default
  bi_per_person integer not null default 50000,
  bi_per_accident integer not null default 100000,
  property_damage integer not null default 10000,
  pip_tier pip_medical_tier not null default '250k',
  ppi_included boolean not null default true, -- $1M property protection, not a choice in MI
  deductible_comp integer not null default 500,
  deductible_coll integer not null default 500,
  want_umuim boolean not null default true,
  want_roadside boolean not null default false,
  want_rental boolean not null default false,
  -- auto-checked because financed
  want_gap boolean not null default false,
  -- auto-checked because gig
  want_rideshare_endorsement boolean not null default false,
  current_insurer text,
  current_premium_monthly numeric(10,2),
  current_limits text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- providers. the mix of who quotes online vs who you have to call.
-- ---------------------------------------------------------------------------

create table providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type provider_entity_type not null,
  channel provider_channel not null,
  phone text,
  email text,
  business_hours jsonb, -- { "mon": ["09:00","17:00"], ... }
  timezone text not null default 'America/Detroit',
  quotes_online boolean not null default false,
  rideshare_endorsement_available boolean,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------

create table call_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  provider_id uuid not null references providers(id),
  status call_job_status not null default 'pending',
  scheduled_for timestamptz not null, -- respects the provider's business hours + tz
  force_now boolean not null default false, -- demo override, bypass the schedule
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  call_job_id uuid not null references call_jobs(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  provider_id uuid not null references providers(id),
  status call_status not null,
  recording_url text,
  transcript text,
  disclosure_spoken boolean not null default false, -- verbatim disclosure sentence went out
  ttfa_ms integer,        -- time to first audio, target under 500
  latency_p50_ms integer,
  latency_p95_ms integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- quotes. carries every field the emailed report needs so marcus can finish
-- the purchase himself.
-- ---------------------------------------------------------------------------

create table quotes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  provider_id uuid not null references providers(id),
  provenance provenance not null,
  outcome quote_outcome not null,
  -- exactly as the carrier or broker gave it. SIM-#### for simulated, never faked
  -- for anything else. null when a call completed but gave no reference (partial).
  quote_reference text,
  monthly_premium numeric(10,2),
  annual_premium numeric(10,2),
  -- plain-english coverage incl michigan pip tier and the $1M ppi line
  coverage_summary jsonb,
  endorsements text[] not null default '{}',
  rideshare_endorsement_included boolean not null default false,
  discounts_applied text[] not null default '{}',
  discounts_available text[] not null default '{}',
  -- contact block, so the report is actionable
  contact_phone text,
  contact_business_hours text,
  contact_email text,
  contact_name text,          -- named human if the call reached one
  producer_license text,      -- their license number if they gave it
  what_to_say text,           -- "ask for denise and reference quote MI-4471-8823"
  expires_at date,
  source_call_id uuid references calls(id),
  transcript_evidence text,   -- the sentence containing the quote number
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- report
-- ---------------------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  top_quote_ids uuid[] not null default '{}', -- ordered, the 3 best
  reasoning jsonb,   -- per-option written reasoning tied to marcus
  gap_section jsonb, -- period-1 rideshare gap and which option closes it
  email_to text,
  email_status report_email_status not null default 'pending',
  email_provider_id text, -- resend message id
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_drivers_session on drivers(session_id);
create index idx_vehicles_session on vehicles(session_id);
create index idx_coverage_session on coverage_prefs(session_id);
create index idx_call_jobs_session on call_jobs(session_id);
create index idx_call_jobs_status on call_jobs(status, scheduled_for);
create index idx_calls_job on calls(call_job_id);
create index idx_quotes_session on quotes(session_id);
create index idx_reports_session on reports(session_id);
