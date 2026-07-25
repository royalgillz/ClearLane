// pick the 3 best quotes for marcus. his real priorities, in order: close the rideshare
// gap (a denied period-1 claim can bankrupt him), then price. we only rank quotes that
// actually have a premium, and we keep one quote per provider (the best), so the same
// agency does not take two of the three slots.

export type RankableQuote = {
  id: string;
  provider_id: string;
  monthly_premium: number | null;
  rideshare_endorsement_included: boolean;
};

export function rankQuotes<T extends RankableQuote>(quotes: T[], limit = 3): T[] {
  const withPremium = quotes.filter((q) => q.monthly_premium != null);

  // best per provider: rideshare first, then cheapest
  const bestByProvider = new Map<string, T>();
  for (const q of withPremium) {
    const cur = bestByProvider.get(q.provider_id);
    if (!cur || better(q, cur)) bestByProvider.set(q.provider_id, q);
  }

  return [...bestByProvider.values()].sort(compare).slice(0, limit);
}

function better(a: RankableQuote, b: RankableQuote): boolean {
  return compare(a, b) < 0;
}

function compare(a: RankableQuote, b: RankableQuote): number {
  // rideshare included wins outright, it is the gap that scares marcus
  if (a.rideshare_endorsement_included !== b.rideshare_endorsement_included) {
    return a.rideshare_endorsement_included ? -1 : 1;
  }
  return (a.monthly_premium ?? Infinity) - (b.monthly_premium ?? Infinity);
}
