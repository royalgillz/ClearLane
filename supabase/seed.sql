-- idempotent seed. fixed uuids + on conflict do update so re-running is safe and the
-- demo is reproducible. marcus exactly as the research doc describes, plus a realistic
-- michigan provider mix (3 online-quoting, 5 phone-only).

insert into sessions (id, status, status_token, intake_seconds, created_at)
values ('11111111-1111-4111-8111-111111111111', 'submitted', 'marcus-demo', 168, now())
on conflict (id) do update set status = excluded.status, status_token = excluded.status_token;

-- 29yo -> born 1996. licensed at 18 -> ~11 years. gig on uber + doordash.
insert into drivers
  (id, session_id, full_name, dob, zip, email, phone, marital_status, occupation,
   license_status, years_licensed, drives_gig, gig_platforms,
   accidents_3yr, violations_3yr, suspensions, continuous_coverage, past_claims)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
   'Marcus Boswell', '1996-11-14', '48228', 'marcus.boswell.demo@gmail.com', '+1-313-555-0177',
   'domestic_partner', 'Warehouse picker (overnight)', 'valid', 11, true,
   array['uber','doordash'], 0, 0, 0, true, 0)
on conflict (id) do update set
  full_name = excluded.full_name, dob = excluded.dob, zip = excluded.zip,
  drives_gig = excluded.drives_gig, gig_platforms = excluded.gig_platforms;

-- 2021 dodge charger sxt, financed (48 months left). gig driver so mileage runs high.
insert into vehicles
  (id, session_id, vin, year, make, model, body, engine, ownership,
   primary_use, annual_mileage, overnight_parking, vin_decode_ok)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
   '2C3CDXBG6MH500001', 2021, 'DODGE', 'Charger', 'Sedan/Saloon', '3.6L V6', 'finance',
   'commute + rideshare/delivery', 18000, 'street', true)
on conflict (id) do update set
  vin = excluded.vin, year = excluded.year, make = excluded.make, model = excluded.model,
  ownership = excluded.ownership;

-- financed -> gap auto-checked. gig -> rideshare endorsement auto-checked. MI 50/100/10,
-- pip 250k default, $1M ppi included. current non-standard carrier at $438/mo.
insert into coverage_prefs
  (id, session_id, bi_per_person, bi_per_accident, property_damage, pip_tier, ppi_included,
   deductible_comp, deductible_coll, want_umuim, want_roadside, want_rental,
   want_gap, want_rideshare_endorsement, current_insurer, current_premium_monthly, current_limits)
values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111',
   50000, 100000, 10000, '250k', true, 500, 500, true, false, false,
   true, true, 'Direct Auto (non-standard)', 438.00,
   '50/100/10, PIP 250k, no rideshare endorsement')
on conflict (id) do update set
  want_gap = excluded.want_gap, want_rideshare_endorsement = excluded.want_rideshare_endorsement,
  current_premium_monthly = excluded.current_premium_monthly;

-- providers. mon-fri hours unless a weekend is listed. tz is per-provider.
insert into providers
  (id, name, entity_type, channel, phone, email, business_hours, timezone,
   quotes_online, rideshare_endorsement_available, notes)
values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'Progressive', 'direct_carrier', 'both',
   '+1-800-776-4737', 'quotes@progressive.example',
   '{"mon":["08:00","21:00"],"tue":["08:00","21:00"],"wed":["08:00","21:00"],"thu":["08:00","21:00"],"fri":["08:00","21:00"],"sat":["09:00","17:00"]}'::jsonb,
   'America/Detroit', true, true, 'national direct, quotes online, has a rideshare endorsement in MI'),

  ('aaaaaaa2-0000-4000-8000-000000000002', 'GEICO', 'direct_carrier', 'both',
   '+1-800-207-7847', 'service@geico.example',
   '{"mon":["08:00","21:00"],"tue":["08:00","21:00"],"wed":["08:00","21:00"],"thu":["08:00","21:00"],"fri":["08:00","21:00"],"sat":["09:00","17:00"]}'::jsonb,
   'America/Detroit', true, true, 'national direct, quotes online'),

  ('aaaaaaa3-0000-4000-8000-000000000003', 'Liberty Mutual', 'direct_carrier', 'both',
   '+1-800-290-8711', 'quotes@libertymutual.example',
   '{"mon":["08:00","21:00"],"tue":["08:00","21:00"],"wed":["08:00","21:00"],"thu":["08:00","21:00"],"fri":["08:00","21:00"],"sat":["09:00","17:00"]}'::jsonb,
   'America/Detroit', true, false, 'quotes online but no rideshare endorsement, leaves marcus with the period-1 gap'),

  ('aaaaaaa4-0000-4000-8000-000000000004', 'Auto-Owners Insurance', 'direct_carrier', 'phone',
   '+1-517-323-1200', 'info@auto-owners.example',
   '{"mon":["08:00","18:00"],"tue":["08:00","18:00"],"wed":["08:00","18:00"],"thu":["08:00","18:00"],"fri":["08:00","18:00"]}'::jsonb,
   'America/Detroit', false, true, 'michigan HQ, agent-sold only, does not quote online. worth a call.'),

  ('aaaaaaa5-0000-4000-8000-000000000005', 'Pioneer State Mutual', 'direct_carrier', 'phone',
   '+1-810-767-0555', 'quotes@psmic.example',
   '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"]}'::jsonb,
   'America/Detroit', false, null, 'michigan regional mutual, phone-only, rideshare availability unknown until we ask'),

  ('aaaaaaa6-0000-4000-8000-000000000006', 'Hastings Mutual', 'direct_carrier', 'phone',
   '+1-800-442-8277', 'service@hastingsmutual.example',
   '{"mon":["08:00","18:00"],"tue":["08:00","18:00"],"wed":["08:00","18:00"],"thu":["08:00","18:00"],"fri":["08:00","18:00"]}'::jsonb,
   'America/Detroit', false, true, 'michigan regional, phone-only via independent agents'),

  ('aaaaaaa7-0000-4000-8000-000000000007', 'Detroit Metro Insurance Group', 'independent_agency', 'phone',
   '+1-313-555-0142', 'denise@detroitmetroins.example',
   '{"mon":["09:00","17:30"],"tue":["09:00","17:30"],"wed":["09:00","17:30"],"thu":["09:00","17:30"],"fri":["09:00","17:30"]}'::jsonb,
   'America/Detroit', false, true, 'the independent agency the voice agent actually calls on stage. represents MI regionals.'),

  ('aaaaaaa8-0000-4000-8000-000000000008', 'Great Lakes Insurance Brokers', 'broker', 'phone',
   '+1-616-555-0198', 'quotes@greatlakesbrokers.example',
   '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"]}'::jsonb,
   'America/Detroit', false, true, 'broker, shops several regionals, phone-only')
on conflict (id) do update set
  name = excluded.name, entity_type = excluded.entity_type, channel = excluded.channel,
  phone = excluded.phone, email = excluded.email, business_hours = excluded.business_hours,
  timezone = excluded.timezone, quotes_online = excluded.quotes_online,
  rideshare_endorsement_available = excluded.rideshare_endorsement_available, notes = excluded.notes;
