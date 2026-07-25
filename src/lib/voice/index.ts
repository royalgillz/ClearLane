import type { CallProvider } from "./types";
import { SimulatedCallProvider } from "./simulated-provider";

// vapi gets wired once the account and a verified outbound number exist. until then every
// call runs through the simulated provider, which is honest by construction (result.real
// is false, so the quote is stamped simulated).
export function getCallProvider(): CallProvider {
  return new SimulatedCallProvider();
}

export * from "./types";
