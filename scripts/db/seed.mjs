import { newClient } from "./pool.mjs";

// idempotent seed. fixed uuids + on conflict do update so re-running is safe and the
// demo is reproducible. marcus exactly as the research doc describes, plus a realistic
// michigan provider mix (3 online-quoting, 5 phone-only).

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_ID = "22222222-2222-4222-8222-222222222222";
const VEHICLE_ID = "33333333-3333-4333-8333-333333333333";
const COVERAGE_ID = "44444444-4444-4444-8444-444444444444";

// mon-fri only unless noted. [open, close] 24h local time. tz is per-provider.
const WEEKDAYS_9_5 = { mon: ["09:00", "17:00"], tue: ["09:00", "17:00"], wed: ["09:00", "17:00"], thu: ["09:00", "17:00"], fri: ["09:00", "17:00"] };
const WEEKDAYS_8_6 = { mon: ["08:00", "18:00"], tue: ["08:00", "18:00"], wed: ["08:00", "18:00"], thu: ["08:00", "18:00"], fri: ["08:00", "18:00"] };
const CARRIER_LONG = { mon: ["08:00", "21:00"], tue: ["08:00", "21:00"], wed: ["08:00", "21:00"], thu: ["08:00", "21:00"], fri: ["08:00", "21:00"], sat: ["09:00", "17:00"] };

const PROVIDERS = [
  {
    id: "aaaaaaa1-0000-4000-8000-000000000001",
    name: "Progressive",
    entity_type: "direct_carrier", channel: "both", quotes_online: true,
    rideshare_endorsement_available: true,
    phone: "+1-800-776-4737", email: "quotes@progressive.example",
    business_hours: CARRIER_LONG, timezone: "America/Detroit",
    notes: "national direct, quotes online, has a rideshare endorsement in MI",
  },
  {
    id: "aaaaaaa2-0000-4000-8000-000000000002",
    name: "GEICO",
    entity_type: "direct_carrier", channel: "both", quotes_online: true,
    rideshare_endorsement_available: true,
    phone: "+1-800-207-7847", email: "service@geico.example",
    business_hours: CARRIER_LONG, timezone: "America/Detroit",
    notes: "national direct, quotes online",
  },
  {
    id: "aaaaaaa3-0000-4000-8000-000000000003",
    name: "Liberty Mutual",
    entity_type: "direct_carrier", channel: "both", quotes_online: true,
    rideshare_endorsement_available: false,
    phone: "+1-800-290-8711", email: "quotes@libertymutual.example",
    business_hours: CARRIER_LONG, timezone: "America/Detroit",
    notes: "quotes online but no rideshare endorsement, leaves marcus with the period-1 gap",
  },
  {
    id: "aaaaaaa4-0000-4000-8000-000000000004",
    name: "Auto-Owners Insurance",
    entity_type: "direct_carrier", channel: "phone", quotes_online: false,
    rideshare_endorsement_available: true,
    phone: "+1-517-323-1200", email: "info@auto-owners.example",
    business_hours: WEEKDAYS_8_6, timezone: "America/Detroit",
    notes: "michigan HQ, agent-sold only, does not quote online. worth a call.",
  },
  {
    id: "aaaaaaa5-0000-4000-8000-000000000005",
    name: "Pioneer State Mutual",
    entity_type: "direct_carrier", channel: "phone", quotes_online: false,
    rideshare_endorsement_available: null,
    phone: "+1-810-767-0555", email: "quotes@psmic.example",
    business_hours: WEEKDAYS_9_5, timezone: "America/Detroit",
    notes: "michigan regional mutual, phone-only, rideshare availability unknown until we ask",
  },
  {
    id: "aaaaaaa6-0000-4000-8000-000000000006",
    name: "Hastings Mutual",
    entity_type: "direct_carrier", channel: "phone", quotes_online: false,
    rideshare_endorsement_available: true,
    phone: "+1-800-442-8277", email: "service@hastingsmutual.example",
    business_hours: WEEKDAYS_8_6, timezone: "America/Detroit",
    notes: "michigan regional, phone-only via independent agents",
  },
  {
    id: "aaaaaaa7-0000-4000-8000-000000000007",
    name: "Detroit Metro Insurance Group",
    entity_type: "independent_agency", channel: "phone", quotes_online: false,
    rideshare_endorsement_available: true,
    // demo swaps this for the verified teammate phone via BROKER_PHONE_NUMBER at call time
    phone: "+1-313-555-0142", email: "denise@detroitmetroins.example",
    business_hours: { mon: ["09:00", "17:30"], tue: ["09:00", "17:30"], wed: ["09:00", "17:30"], thu: ["09:00", "17:30"], fri: ["09:00", "17:30"] },
    timezone: "America/Detroit",
    notes: "the independent agency the voice agent actually calls on stage. represents MI regionals.",
  },
  {
    id: "aaaaaaa8-0000-4000-8000-000000000008",
    name: "Great Lakes Insurance Brokers",
    entity_type: "broker", channel: "phone", quotes_online: false,
    rideshare_endorsement_available: true,
    phone: "+1-616-555-0198", email: "quotes@greatlakesbrokers.example",
    business_hours: WEEKDAYS_9_5, timezone: "America/Detroit",
    notes: "broker, shops several regionals, phone-only",
  },
];

async function seedSession(client) {
  await client.query(
    `insert into sessions (id, status, status_token, intake_seconds, created_at)
     values ($1, 'submitted', 'marcus-demo', 168, now())
     on conflict (id) do update set status = excluded.status, status_token = excluded.status_token`,
    [SESSION_ID]
  );

  // 29yo -> born 1996. licensed at 18 -> ~11 years. gig on uber + doordash.
  await client.query(
    `insert into drivers
       (id, session_id, full_name, dob, zip, email, phone, marital_status, occupation,
        license_status, years_licensed, drives_gig, gig_platforms,
        accidents_3yr, violations_3yr, suspensions, continuous_coverage, past_claims)
     values ($1,$2,'Marcus Boswell','1996-11-14','48228','marcus.boswell.demo@gmail.com',
        '+1-313-555-0177','domestic_partner','Warehouse picker (overnight)',
        'valid', 11, true, $3, 0, 0, 0, true, 0)
     on conflict (id) do update set
        full_name = excluded.full_name, dob = excluded.dob, zip = excluded.zip,
        drives_gig = excluded.drives_gig, gig_platforms = excluded.gig_platforms`,
    [DRIVER_ID, SESSION_ID, ["uber", "doordash"]]
  );

  // 2021 dodge charger sxt, financed (48 months left). gig driver so mileage runs high.
  await client.query(
    `insert into vehicles
       (id, session_id, vin, year, make, model, body, engine, ownership,
        primary_use, annual_mileage, overnight_parking, vin_decode_ok)
     values ($1,$2,'2C3CDXBG6MH500001',2021,'DODGE','Charger','Sedan/Saloon',
        '3.6L V6','finance','commute + rideshare/delivery',18000,'street',true)
     on conflict (id) do update set
        vin = excluded.vin, year = excluded.year, make = excluded.make, model = excluded.model,
        ownership = excluded.ownership`,
    [VEHICLE_ID, SESSION_ID]
  );

  // financed -> gap auto-checked. gig -> rideshare endorsement auto-checked. MI 50/100/10,
  // pip 250k default, $1M ppi included. current non-standard carrier at $438/mo.
  await client.query(
    `insert into coverage_prefs
       (id, session_id, bi_per_person, bi_per_accident, property_damage, pip_tier, ppi_included,
        deductible_comp, deductible_coll, want_umuim, want_roadside, want_rental,
        want_gap, want_rideshare_endorsement, current_insurer, current_premium_monthly, current_limits)
     values ($1,$2,50000,100000,10000,'250k',true,500,500,true,false,false,
        true, true, 'Direct Auto (non-standard)', 438.00, '50/100/10, PIP 250k, no rideshare endorsement')
     on conflict (id) do update set
        want_gap = excluded.want_gap, want_rideshare_endorsement = excluded.want_rideshare_endorsement,
        current_premium_monthly = excluded.current_premium_monthly`,
    [COVERAGE_ID, SESSION_ID]
  );
}

async function seedProviders(client) {
  for (const p of PROVIDERS) {
    await client.query(
      `insert into providers
         (id, name, entity_type, channel, phone, email, business_hours, timezone,
          quotes_online, rideshare_endorsement_available, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
          name = excluded.name, entity_type = excluded.entity_type, channel = excluded.channel,
          phone = excluded.phone, email = excluded.email, business_hours = excluded.business_hours,
          timezone = excluded.timezone, quotes_online = excluded.quotes_online,
          rideshare_endorsement_available = excluded.rideshare_endorsement_available,
          notes = excluded.notes`,
      [p.id, p.name, p.entity_type, p.channel, p.phone, p.email, JSON.stringify(p.business_hours),
       p.timezone, p.quotes_online, p.rideshare_endorsement_available, p.notes]
    );
  }
}

async function main() {
  const client = newClient();
  await client.connect();
  try {
    await seedSession(client);
    await seedProviders(client);
    const counts = await client.query(
      `select
         (select count(*) from providers) as providers,
         (select count(*) from providers where quotes_online) as online,
         (select count(*) from providers where not quotes_online) as phone_only,
         (select count(*) from sessions) as sessions`
    );
    const c = counts.rows[0];
    console.log(`seeded: marcus (session marcus-demo), ${c.providers} providers (${c.online} online, ${c.phone_only} phone-only)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
