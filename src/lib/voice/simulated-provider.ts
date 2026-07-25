import type { CallProvider, CallRequest, CallResult, CallTurn } from "./types";
import { buildSimulatedTranscript } from "./script";
import { assertSafeSpeech } from "./denylist";
import { printLatency, summarize, SIMULATED_TURN_LATENCIES } from "./latency";

// honest simulated call. it does everything the real path does except make noise: speaks
// the disclosure first, runs the broker dialogue, enforces the denylist on every agent
// utterance, and records per-turn latency. result.real is false, so persistence stamps the
// quote 'simulated' and never 'verified_on_call'. this is the backup and the phase-5 fixture.
export class SimulatedCallProvider implements CallProvider {
  readonly label = "simulated call";

  async placeCall(req: CallRequest): Promise<CallResult> {
    const startedAt = new Date().toISOString();
    const turns = buildSimulatedTranscript(req);

    const agentLatencies: number[] = [];
    const stamped: CallTurn[] = turns.map((t) => {
      if (t.role === "agent") {
        // hard backstop: the agent must never voice denied content, even scripted
        assertSafeSpeech(t.text);
        const latencyMs = SIMULATED_TURN_LATENCIES[agentLatencies.length % SIMULATED_TURN_LATENCIES.length];
        agentLatencies.push(latencyMs);
        return { ...t, latencyMs };
      }
      return t;
    });

    printLatency(this.label, agentLatencies);

    const transcript = stamped.map((t) => `${t.role === "agent" ? "Agent" : "Broker"}: ${t.text}`).join("\n");

    return {
      real: false,
      connected: true,
      disclosureSpoken: true, // the first agent turn is the disclosure, by construction
      transcript,
      turns: stamped,
      recordingUrl: null,
      latency: summarize(agentLatencies),
      startedAt,
      endedAt: new Date().toISOString(),
    };
  }
}
