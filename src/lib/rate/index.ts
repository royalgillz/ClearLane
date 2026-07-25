import { FiledRateSource } from "./filed-rate-source";
import type { RateSource } from "./types";

// swap this for a real comparative rater later. callers only see the interface.
export function getRateSource(): RateSource {
  return new FiledRateSource();
}

export * from "./types";
