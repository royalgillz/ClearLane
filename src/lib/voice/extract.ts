// post-call extraction with claude. this is a real, working part even when the call audio
// is simulated: it pulls structured fields from the transcript, and specifically the quote
// reference number plus the sentence that contains it (the evidence). the quote number is
// the proof the call did something, so we capture where it came from.

export type CallExtraction = {
  carrier: string | null;
  premiumMonthly: number | null;
  premiumAnnual: number | null;
  rideshareIncluded: boolean;
  discountsApplied: string[];
  discountsAvailable: string[];
  quoteReference: string | null;
  quoteReferenceEvidence: string | null;
  contactName: string | null;
  contactEmail: string | null;
  producerLicense: string | null;
  expiresInDays: number | null;
};

const EMPTY: CallExtraction = {
  carrier: null, premiumMonthly: null, premiumAnnual: null, rideshareIncluded: false,
  discountsApplied: [], discountsAvailable: [], quoteReference: null, quoteReferenceEvidence: null,
  contactName: null, contactEmail: null, producerLicense: null, expiresInDays: null,
};

const SYSTEM = `You extract structured data from an auto-insurance phone call transcript between an AI agent and an insurance broker. Return ONLY a JSON object, no prose, matching exactly these keys:
carrier (string or null, the underlying insurance carrier named),
premiumMonthly (number or null, dollars per month),
premiumAnnual (number or null, dollars per year, null if not stated),
rideshareIncluded (boolean, true only if a rideshare or delivery endorsement was confirmed as included),
discountsApplied (array of short strings actually applied to the quote),
discountsAvailable (array of short strings mentioned as available but not applied),
quoteReference (string or null, the quote reference the broker gave. brokers often read it out as separate characters like "M I 4 4 7 1" or "1 2 3 4 5", normalize it to MI-4471 or 12345),
quoteReferenceEvidence (string or null, the single sentence from the transcript that contains the quote reference number, verbatim),
contactName (string or null, the human the agent reached),
contactEmail (string or null),
producerLicense (string or null, the producer or agent license number if stated),
expiresInDays (number or null, how many days the quote is valid).
If the quote reference number was never given, quoteReference and quoteReferenceEvidence must be null.`;

export async function extractFromTranscript(transcript: string): Promise<CallExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }],
    }),
  });

  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }

  // claude-sonnet-5 emits a thinking block before the text block, so grab every text
  // block, not just content[0].
  const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("")
    .trim();
  const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(json) as Partial<CallExtraction>;
    return { ...EMPTY, ...parsed };
  } catch {
    // never fabricate. if extraction is unreadable, return empty and let the outcome be partial.
    console.error("[extract] could not parse claude output:", text.slice(0, 200));
    return EMPTY;
  }
}
