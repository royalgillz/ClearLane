# ClearLane, what is real and what is not

Written for a judge or an engineer who wants the truth before they go looking. Every number
here comes from the code, the logs, or a measurement we ran. Where a number does not exist we
say "not measured."

## Architecture

One intake form, then agents shop across channels, place real outbound calls to brokers who do
not quote online, and email the three best options.

It is asynchronous on purpose. Marcus fills the form near midnight when every broker in Michigan
is closed, so a realtime "wait while we call six people" flow is impossible for the real
customer. Intake persists, call jobs queue against provider business hours, a worker resolves
each job (online path from a filed-rate feed, phone path via a Vapi call plus Claude extraction),
outcomes are written back, and the report generates when jobs reach a terminal state.

Stack: Next.js on Vercel, Supabase Postgres, Vapi on Twilio telephony, Deepgram for speech to
text, Cartesia for speech, Claude Haiku on the live turn and Claude Sonnet for extraction,
NHTSA vPIC for VIN decode, Resend for email.

## Real versus mocked

| Component | Status | What backs it | Why |
|---|---|---|---|
| Intake + VIN decode | Fully working | Next.js form, live NHTSA vPIC | Real API, no key |
| Outbound phone call | Fully working | Vapi on Twilio, real call, recording + transcript | 3 real calls placed |
| Post-call extraction | Fully working | Claude Sonnet pulls fields + quote-ref evidence | Runs on the live transcript |
| PII denylist | Fully working | Code-enforced, 6 passing tests | A prompt is not enforcement |
| Report + email | Fully working | Ranking, badges, Resend delivery | Resend test mode sends only to the account owner |
| Online rate feed | Simulated | Deterministic filed-rate model, `SIM-` refs | Raters need a licensed agency + appointments; aggregator APIs are BD deals; neither is same-day |
| Queue + worker | Working with limits | `call_jobs`, `scheduled_for`, per-job resolution, force-now | Continuous background drainer not running yet |
| Business-hours scheduler | Not built | Timezone seeded per provider | The scheduler acting on it is not implemented |

Provenance is an enum: `verified_on_call`, `agent_stated`, `online_quoted`, `simulated`.
Simulated records use a `SIM-` prefix that cannot be mistaken for a real reference. A completed
call with no reference is recorded partial, not success. A call that does not connect is failed
with no quote, never a synthesized outcome. We audited the path: `verified_on_call` requires a
real connected Vapi call (which carries a recording) plus a captured reference. It cannot be
emitted without a real call. Seeded demo distribution today: 3 verified on call, 4 simulated,
across 7 quote records.

## Voice performance (measured 2026-07-25)

| Call, config | Turns | First audio p50 | Turn p50 | Turn p95 |
|---|---|---|---|---|
| Sonnet + default voice | 15 | 1905 ms | 2226 ms | 7690 ms |
| Haiku + Cartesia, first voice | 7 | 1217 ms | 1407 ms | 2229 ms |
| Haiku + Cartesia, current | 7 | 1070 ms | 1228 ms | 1821 ms |

Sample size is small and we say so: 3 real calls. Human turn-taking sits near 200 ms, and past
roughly 1200 ms a call reads as "are you there." Current first audio is 1070 ms p50, we did not
reach the sub-500 ms ideal. What moved it: streaming STT (Deepgram), a fast synthesis engine
(Cartesia, voice latency from ~1000 ms to a measured 334 ms), and a small fast first-turn model
(Haiku, ~485 ms). We do not claim prompt caching, it is not implemented. Barge-in is Vapi's
native turn-taking, not separately benchmarked.

## Legal posture

See `docs/LEGAL.md`. In short: we do not negotiate filed rates (that would be rebating), the
agent discloses and records with consent, a code-enforced denylist blocks SSN, license, and
payment data, and every quote is labeled indicative and subject to underwriting.

## The metric that decides this

Does the phone channel beat online for enough drivers by enough margin. The bar is 25 percent of
profiles by a meaningful margin. Under 10 percent this is a shopping app with a good demo. We
measure it on 50 real broker calls, not a teammate, logging connect rate, whether a broker will
quote a disclosed bot, endorsement availability, premium, discounts, reference captured, and the
delta versus the best online premium for the same profile.
