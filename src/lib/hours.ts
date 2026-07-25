// format a provider's business_hours jsonb into something marcus can read in the report,
// and a short timezone label. hours look like { "mon": ["09:00","17:00"], ... }.

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const TZ_ABBREV: Record<string, string> = {
  "America/Detroit": "ET",
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
};

export function tzLabel(tz: string): string {
  return TZ_ABBREV[tz] ?? tz;
}

type Hours = Record<string, [string, string]>;

export function formatBusinessHours(hours: Hours | null | undefined, tz: string): string {
  if (!hours) return "call for hours";
  const present = DAY_ORDER.filter((d) => hours[d]);
  if (present.length === 0) return "call for hours";

  // collapse runs of consecutive days that share the same open/close
  const parts: string[] = [];
  let i = 0;
  while (i < present.length) {
    const day = present[i];
    const [open, close] = hours[day];
    let j = i;
    while (
      j + 1 < present.length &&
      hours[present[j + 1]][0] === open &&
      hours[present[j + 1]][1] === close &&
      DAY_ORDER.indexOf(present[j + 1]) === DAY_ORDER.indexOf(present[j]) + 1
    ) {
      j++;
    }
    const range = `${open}-${close}`;
    parts.push(i === j ? `${DAY_LABEL[day]} ${range}` : `${DAY_LABEL[present[i]]}-${DAY_LABEL[present[j]]} ${range}`);
    i = j + 1;
  }
  return `${parts.join(", ")} ${tzLabel(tz)}`;
}
