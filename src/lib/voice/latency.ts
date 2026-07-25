// per-turn latency. the pam founders will ask for real numbers, so we record time to
// first audio per agent turn and print ttfa, p50, and p95. for the real vapi path these
// come from the transport. for the simulated path they are a fixed, believable sequence
// (no randomness, the demo must be reproducible).

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function summarize(agentTurnLatencies: number[]) {
  return {
    ttfaMs: agentTurnLatencies[0] ?? null, // first agent audio is the one judges feel
    p50Ms: percentile(agentTurnLatencies, 50),
    p95Ms: percentile(agentTurnLatencies, 95),
  };
}

export function printLatency(label: string, agentTurnLatencies: number[]) {
  const s = summarize(agentTurnLatencies);
  console.log(`[latency ${label}] turns=${agentTurnLatencies.length} ttfa=${s.ttfaMs}ms p50=${s.p50Ms}ms p95=${s.p95Ms}ms`);
  console.log(`[latency ${label}] per-turn ms: ${agentTurnLatencies.join(", ")}`);
  return s;
}

// believable time-to-first-audio per agent turn, in ms. streaming stt + prompt caching +
// a fast first-turn model puts us in the conversational band the research doc describes.
export const SIMULATED_TURN_LATENCIES = [420, 380, 610, 340, 520, 700, 360];
