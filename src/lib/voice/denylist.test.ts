import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForDenied, assertSafeSpeech, assertSafeToolInput } from "./denylist.ts";

// @spec VOICE-SAFE-001
test("flags a social security number", () => {
  assert.deepEqual(scanForDenied("his ssn is 123-45-6789"), ["ssn"]);
  assert.deepEqual(scanForDenied("social security number 123456789"), ["ssn"]);
  // asr often space-separates the digits, still an ssn
  assert.deepEqual(scanForDenied("his social security is 123 45 6789"), ["ssn"]);
});

// @spec VOICE-SAFE-002
test("flags a driver license number", () => {
  assert.deepEqual(scanForDenied("driver's license number B123-4567-8901"), ["license"]);
  assert.deepEqual(scanForDenied("DL# S12345678"), ["license"]);
});

// @spec VOICE-SAFE-003
test("flags payment information", () => {
  assert.deepEqual(scanForDenied("card number 4111 1111 1111 1111"), ["payment"]);
  assert.deepEqual(scanForDenied("the cvv is 123"), ["payment"]);
  assert.deepEqual(scanForDenied("routing number 021000021"), ["payment"]);
});

// @spec VOICE-SAFE-006
test("does not flag the fields a quote legitimately needs", () => {
  const legit = [
    "the VIN is 2C3CDXBG6MH500001",
    "ZIP code 48228",
    "call me at 313-555-0177",
    "date of birth November 14 1996",
    "2021 Dodge Charger, 18000 miles a year",
    "the premium is 288 dollars a month",
    "quote reference MI-4471-8823",
  ];
  for (const s of legit) assert.deepEqual(scanForDenied(s), [], `should be clean: ${s}`);
});

// @spec VOICE-SAFE-004
test("assertSafeSpeech throws on denied content", () => {
  assert.throws(() => assertSafeSpeech("read me your card number"), /payment/);
  assert.doesNotThrow(() => assertSafeSpeech("can I get a quote reference number for that?"));
});

// @spec VOICE-SAFE-005
test("assertSafeToolInput rejects denied content in any field", () => {
  assert.throws(() => assertSafeToolInput({ note: "ssn 123-45-6789" }), /ssn/);
  assert.throws(() => assertSafeToolInput({ nested: { dl: "license number A1234567" } }), /license/);
  assert.doesNotThrow(() => assertSafeToolInput({ vin: "2C3CDXBG6MH500001", zip: "48228" }));
});
