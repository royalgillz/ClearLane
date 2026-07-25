// the outbound call, behind an interface so vapi (real telephony) and the simulated path
// are interchangeable. callers never know which one ran, except the result says so, which
// is what keeps the provenance honest.

export type CallTurn = {
  role: "agent" | "broker";
  text: string;
  latencyMs?: number; // for agent turns: time to first audio for that turn
};

export type CallRequest = {
  sessionId: string;
  providerId: string;
  toNumber: string; // the broker line we dial
  // everything the agent may state. never includes ssn, license, or payment by construction.
  brief: {
    driverName: string;
    dob: string;
    zip: string;
    vehicle: string; // "2021 Dodge Charger"
    yearsLicensed: number | null;
    cleanRecord: boolean;
    gigPlatforms: string[];
    wantsRideshareEndorsement: boolean;
    coverageAsk: string; // plain english
  };
};

export type CallResult = {
  // true only when a real call connected. simulated calls set this false so persistence
  // stamps the quote 'simulated' and never 'verified_on_call'.
  real: boolean;
  connected: boolean; // false => the call did not complete, record it failed, no synthesis
  disclosureSpoken: boolean;
  transcript: string;
  turns: CallTurn[];
  recordingUrl: string | null;
  latency: { ttfaMs: number | null; p50Ms: number | null; p95Ms: number | null };
  startedAt: string;
  endedAt: string;
};

export interface CallProvider {
  readonly label: string;
  placeCall(req: CallRequest): Promise<CallResult>;
}
