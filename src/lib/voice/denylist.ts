// hard denylist for the voice agent. the prompt also forbids this, but a prompt is not
// enforcement. this runs on generated speech before tts and on tool inputs before they
// execute. it must catch ssn, driver license number, and payment data, and must NOT trip
// on the fields a quote legitimately needs (vin, zip, phone, dob, mileage, premiums).
// @spec VOICE-SAFE-001, VOICE-SAFE-002, VOICE-SAFE-003, VOICE-SAFE-006

export type DeniedCategory = "ssn" | "license" | "payment";

const SSN_FORMATTED = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_CONTEXT = /\b(ssn|social security)\b/i;
const NINE_DIGITS = /\d{9,}/;

// "license"/"dl" followed (loosely) by an alphanumeric token that contains a digit. the
// digit requirement keeps "license status valid" from tripping it.
const LICENSE = /(driver'?s?\s+licen[sc]e|licen[sc]e|\bdl\b)\s*(number|no\.?|#)?\s*[:#-]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9][A-Za-z0-9-]{5,}/i;

const PAYMENT_KEYWORDS = /\b(card\s*number|credit\s*card|debit\s*card|cvv|security\s*code|routing\s*number|account\s*number|bank\s*account|expiration\s*date)\b/i;
// a card-length run of digits (13-19), spaces or dashes allowed. phone (10) and ssn (9)
// are too short to match; vin has letters so it never matches a pure digit run.
const CARD_RUN = /(?:\d[ -]?){13,19}\b/;

export function scanForDenied(text: string): DeniedCategory[] {
  const found: DeniedCategory[] = [];

  if (SSN_FORMATTED.test(text) || (SSN_CONTEXT.test(text) && NINE_DIGITS.test(text))) {
    found.push("ssn");
  }
  if (LICENSE.test(text)) found.push("license");
  if (PAYMENT_KEYWORDS.test(text) || CARD_RUN.test(text)) found.push("payment");

  return found;
}

// @spec VOICE-SAFE-004
export function assertSafeSpeech(text: string): void {
  const hits = scanForDenied(text);
  if (hits.length) {
    throw new Error(`blocked speech, denied content: ${hits.join(", ")}`);
  }
}

// @spec VOICE-SAFE-005
export function assertSafeToolInput(input: unknown): void {
  const hits = scanForDenied(JSON.stringify(input ?? ""));
  if (hits.length) {
    throw new Error(`rejected tool input, denied content: ${hits.join(", ")}`);
  }
}
