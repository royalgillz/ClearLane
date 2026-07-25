import type { CallProvider } from "./types";
import { SimulatedCallProvider } from "./simulated-provider";
import { VapiCallProvider } from "./vapi-provider";

// use the real vapi provider when the account, an imported number, and a destination are
// all set. otherwise fall back to the honest simulated path so nothing downstream blocks.
export function getCallProvider(): CallProvider {
  const key = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const broker = process.env.BROKER_PHONE_NUMBER;
  if (key && phoneNumberId && broker) {
    return new VapiCallProvider(key, phoneNumberId, {
      provider: process.env.VOICE_LLM_PROVIDER,
      model: process.env.VOICE_LLM_MODEL,
      voiceProvider: process.env.VOICE_PROVIDER,
      voiceId: process.env.VOICE_ID,
    });
  }
  return new SimulatedCallProvider();
}

export * from "./types";
