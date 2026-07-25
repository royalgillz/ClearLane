import type { CallProvider, CallRequest, CallResult, CallTurn } from "./types";
import { disclosureSentence } from "./script";

// real outbound call through vapi (twilio + transcriber + tts + llm). the assistant is
// configured to hit the conversation goals in order and is told, hard, never to speak or
// request ssn / license / payment. the denylist in denylist.ts is the code backstop; this
// is the prompt-level instruction on top of it.

const VAPI_BASE = "https://api.vapi.ai";

function systemPrompt(req: CallRequest): string {
  const b = req.brief;
  const gig = b.gigPlatforms.join(" and ") || "rideshare and delivery";
  return `You are an automated assistant calling an insurance broker on behalf of ${b.driverName} to get an auto insurance quote. Keep it natural and brief, this is a phone call. Speak one short turn at a time and let the broker respond.

Driver facts you may state (only these):
- Name: ${b.driverName}, ZIP ${b.zip}, Detroit Michigan
- Vehicle: ${b.vehicle}, financed
- Licensed about ${b.yearsLicensed ?? 11} years, ${b.cleanRecord ? "clean record, no accidents or violations" : "some history"}
- Drives for ${gig}
- Wants: ${b.coverageAsk}

Your goals, in this order:
1. Confirm the broker has a carrier that offers a rideshare or delivery endorsement (this closes the Period 1 gap).
2. Get a monthly premium for that full coverage.
3. Ask to stack any discounts he qualifies for (paperless, pay in full, telematics).
4. Near the end, explicitly ask: "Can I get a quote reference number for that?"
5. Get the broker's name and a direct email to follow up.

Absolute rules:
- NEVER say or ask for a Social Security number, a driver license number, or any payment, card, or bank information. If the broker asks for any of those, say it is not needed just to get a quote and move on.
- Do not agree to bind or purchase anything. You are only gathering a quote.
- Once you have the premium and a quote reference number (or the broker says they cannot give one), thank them and end the call.`;
}

type VapiMessage = { role?: string; message?: string; time?: number; secondsFromStart?: number; source?: string };
type VapiCall = {
  id: string;
  status?: string;
  endedReason?: string;
  artifact?: { transcript?: string; recordingUrl?: string; messages?: VapiMessage[] };
};

async function api(path: string, init: RequestInit, key: string) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`vapi ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// best-effort per-assistant-turn latency from message timestamps. the dashboard has the
// authoritative numbers, this is what we can compute from the artifact.
function latencyFromMessages(messages: VapiMessage[] | undefined): number[] {
  if (!messages) return [];
  const out: number[] = [];
  let lastUserEnd: number | null = null;
  for (const m of messages) {
    const role = m.role ?? m.source;
    const t = m.secondsFromStart != null ? m.secondsFromStart * 1000 : m.time;
    if (t == null) continue;
    if (role === "user" || role === "customer") lastUserEnd = t;
    else if ((role === "bot" || role === "assistant") && lastUserEnd != null) {
      out.push(Math.max(0, Math.round(t - lastUserEnd)));
      lastUserEnd = null;
    }
  }
  return out;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const NON_CONNECT = /no-answer|did-not-answer|busy|voicemail|failed|declined|customer-busy/i;

export class VapiCallProvider implements CallProvider {
  readonly label = "vapi (live)";
  constructor(
    private apiKey: string,
    private phoneNumberId: string,
    private opts: { model?: string; provider?: string; voiceId?: string } = {}
  ) {}

  async placeCall(req: CallRequest): Promise<CallResult> {
    const startedAt = new Date().toISOString();

    const created: VapiCall = await api(
      "/call",
      {
        method: "POST",
        body: JSON.stringify({
          phoneNumberId: this.phoneNumberId,
          customer: { number: req.toNumber },
          assistant: {
            firstMessage: disclosureSentence(req.brief.driverName),
            firstMessageMode: "assistant-speaks-first",
            maxDurationSeconds: 240,
            model: {
              provider: this.opts.provider ?? "anthropic",
              model: this.opts.model ?? "claude-3-5-sonnet-20241022",
              temperature: 0.4,
              messages: [{ role: "system", content: systemPrompt(req) }],
            },
            transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
            voice: { provider: "vapi", voiceId: this.opts.voiceId ?? "Elliot" },
          },
        }),
      },
      this.apiKey
    );

    // poll until the call ends. dev runs this inline, which is fine locally.
    const deadline = Date.now() + 5 * 60 * 1000;
    let call: VapiCall = created;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      call = await api(`/call/${created.id}`, { method: "GET" }, this.apiKey);
      if (call.status === "ended") break;
    }

    const transcript = call.artifact?.transcript ?? "";
    const latencies = latencyFromMessages(call.artifact?.messages);
    const connected = !!transcript && !NON_CONNECT.test(call.endedReason ?? "");

    const turns: CallTurn[] = (call.artifact?.messages ?? [])
      .filter((m) => (m.role ?? m.source) !== "system")
      .map((m): CallTurn => {
        const r = m.role ?? m.source;
        return { role: r === "user" || r === "customer" ? "broker" : "agent", text: m.message ?? "" };
      })
      .filter((t) => t.text);

    return {
      real: true,
      connected,
      disclosureSpoken: true, // firstMessage is the disclosure, vapi speaks it first
      transcript,
      turns,
      recordingUrl: call.artifact?.recordingUrl ?? null,
      latency: { ttfaMs: latencies[0] ?? null, p50Ms: percentile(latencies, 50), p95Ms: percentile(latencies, 95) },
      startedAt,
      endedAt: new Date().toISOString(),
    };
  }
}
