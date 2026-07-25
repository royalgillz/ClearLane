import type { CallRequest, CallTurn } from "./types";

// the verbatim disclosure. spoken first on every call, no exceptions. one-party consent
// in michigan makes it legally simple, we disclose everywhere anyway. (no em dash here on
// purpose, house rule.)
export function disclosureSentence(driverName: string): string {
  return `Hi, this is an automated assistant calling on behalf of ${driverName} to get an auto insurance quote. This call is recorded for quality and accuracy. Is it okay to continue?`;
}

// a realistic broker dialogue for the simulated path. it reaches a michigan regional
// through the agency, confirms the rideshare endorsement, gets a premium, stacks discounts,
// and gets a quote reference plus a named contact. this is what the real vapi call will do
// live; here it is scripted so phase 5 has data and so we have a clean backup.
export function buildSimulatedTranscript(req: CallRequest): CallTurn[] {
  const { brief } = req;
  const gig = brief.gigPlatforms.join(" and ") || "rideshare";

  return [
    { role: "agent", text: disclosureSentence(brief.driverName) },
    { role: "broker", text: "Sure, that's fine. This is Denise at Detroit Metro. What do you need?" },
    {
      role: "agent",
      text: `Thanks Denise. I'm shopping full coverage for a ${brief.vehicle}, financed, garaged in ${brief.zip}. The driver is 29, licensed about ${brief.yearsLicensed ?? 11} years, clean record, and drives for ${gig}. First question: do you have a carrier that offers a rideshare or delivery endorsement?`,
    },
    {
      role: "broker",
      text: "We do. Pioneer State Mutual writes a rideshare endorsement that covers the Period 1 gap, when the app is on but there's no passenger yet. A lot of carriers won't touch that.",
    },
    {
      role: "agent",
      text: "That's exactly what we need. Can you quote full coverage with Michigan 50/100/10 liability, PIP at the 250k tier, 500 deductibles, gap, and that rideshare endorsement added?",
    },
    {
      role: "broker",
      text: "Give me a second. Okay, with Pioneer that comes to about 288 dollars a month, and that already includes the rideshare endorsement.",
    },
    {
      role: "agent",
      text: "Good. Can we stack any discounts on that? Paperless, pay in full, telematics, anything he qualifies for?",
    },
    {
      role: "broker",
      text: "I applied paperless and pay in full, that's baked into the 288. Telematics could knock off a bit more if he enrolls, but I'd have to set that up separately.",
    },
    { role: "agent", text: "Understood. Can I get a quote reference number for that?" },
    { role: "broker", text: "Yep, the reference is M I dash 4 4 7 1 dash 8 8 2 3. That's MI-4471-8823." },
    {
      role: "agent",
      text: "Perfect. And can I get your name and a direct email so we can follow up to bind?",
    },
    {
      role: "broker",
      text: "Denise Carter, my email is denise@detroitmetroins.com, and my producer license is 0912345. The quote is good for 30 days.",
    },
    { role: "agent", text: "Thank you Denise, that's everything I needed. Have a good one." },
  ];
}
