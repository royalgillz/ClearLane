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
    // empty env vars (the .env.example placeholders) must read as unset, otherwise "" slips
    // past the ?? defaults and breaks the call config.
    const set = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
    // naturalness first: use elevenlabs when a key is available, else a warm cartesia voice.
    // VOICE_PROVIDER / VOICE_ID override so we can a/b any voice from env on a single call.
    const voiceProvider = set(process.env.VOICE_PROVIDER) ?? (set(process.env.ELEVENLABS_API_KEY) ? "11labs" : "cartesia");
    return new VapiCallProvider(key, phoneNumberId, {
      provider: set(process.env.VOICE_LLM_PROVIDER),
      model: set(process.env.VOICE_LLM_MODEL),
      voiceProvider,
      voiceId: set(process.env.VOICE_ID),
    });
  }
  return new SimulatedCallProvider();
}

export * from "./types";
