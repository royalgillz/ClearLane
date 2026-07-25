import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Provenance, ReportModel, ReportOption } from "./types";

// interactive email report. assume broken css: table layout, inline styles, no external
// anything. a <style> block adds dark-mode + hover as progressive enhancement for clients
// that support it, but every important thing is inline so it survives gmail stripping it.

const BADGE: Record<Provenance, { label: string; bg: string; fg: string }> = {
  verified_on_call: { label: "VERIFIED ON CALL", bg: "#dcfce7", fg: "#166534" },
  agent_stated: { label: "STATED BY AGENT", bg: "#fef3c7", fg: "#92400e" },
  online_quoted: { label: "QUOTED ONLINE", bg: "#dbeafe", fg: "#1e40af" },
  simulated: { label: "SIMULATED DATA", bg: "#fee2e2", fg: "#b91c1c" },
};

const money = (n: number | null) => (n == null ? "n/a" : `$${Math.round(n).toLocaleString()}`);
const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

function badge(p: Provenance): string {
  const b = BADGE[p];
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em;background:${b.bg};color:${b.fg}">${b.label}</span>`;
}

function coverageLines(cs: Record<string, unknown> | null): string {
  if (!cs) return "";
  const rows: string[] = [];
  if (cs.liability) rows.push(`Liability ${esc(cs.liability)}`);
  if (cs.pip) rows.push(`PIP ${esc(cs.pip)}`);
  if (cs.ppi) rows.push(`${esc(cs.ppi)}`);
  if (cs.comprehensive) rows.push(`Comprehensive ${esc(cs.comprehensive)}`);
  if (cs.collision) rows.push(`Collision ${esc(cs.collision)}`);
  return rows.map((r) => `<div style="color:#475569;font-size:14px;line-height:22px">${r}</div>`).join("");
}

function list(items: string[], color: string): string {
  if (!items.length) return "";
  return items.map((i) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 8px;border-radius:6px;background:${color};color:#334155;font-size:13px">${esc(i)}</span>`).join("");
}

function optionCard(o: ReportOption, rank: number): string {
  const save = o.monthlySavings != null && o.monthlySavings > 0
    ? `<div style="color:#166534;font-weight:700;font-size:15px;margin-top:2px">Saves about ${money(o.monthlySavings)}/mo</div>` : "";

  const ref = o.quoteReference
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0"><tr><td style="background:#0f172a;border-radius:10px;padding:12px 16px">
         <div style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Quote reference</div>
         <div style="color:#ffffff;font-size:22px;font-weight:800;font-family:'Courier New',monospace;letter-spacing:.04em">${esc(o.quoteReference)}</div>
       </td></tr></table>` : "";

  const whatToSay = o.whatToSay
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#ecfdf5;border-left:4px solid #0d9488;border-radius:6px;padding:10px 14px;margin-top:8px">
         <div style="color:#0f766e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">What to say when you call</div>
         <div style="color:#134e4a;font-size:15px;margin-top:2px">${esc(o.whatToSay)}</div>
       </td></tr></table>` : "";

  const contactRows: string[] = [];
  if (o.contactPhone) contactRows.push(`<div style="font-size:16px;margin:3px 0"><a href="tel:${esc(o.contactPhone)}" style="color:#0d9488;font-weight:700;text-decoration:none">${esc(o.contactPhone)}</a>${o.contactBusinessHours ? `<span style="color:#64748b;font-size:13px"> &nbsp;${esc(o.contactBusinessHours)}</span>` : ""}</div>`);
  if (o.contactEmail) contactRows.push(`<div style="font-size:14px;margin:3px 0"><a href="mailto:${esc(o.contactEmail)}" style="color:#334155">${esc(o.contactEmail)}</a></div>`);
  if (o.contactName) contactRows.push(`<div style="font-size:14px;margin:3px 0;color:#334155">Ask for ${esc(o.contactName)}${o.producerLicense ? ` <span style="color:#94a3b8">(lic. ${esc(o.producerLicense)})</span>` : ""}</div>`);

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top">
          <div style="color:#64748b;font-size:13px;font-weight:700">OPTION ${rank}</div>
          <div style="color:#0f172a;font-size:20px;font-weight:800;margin-top:2px">${esc(o.providerName)}</div>
          <div style="color:#64748b;font-size:13px">${esc(o.entityType)}</div>
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="color:#0f172a;font-size:26px;font-weight:800">${money(o.monthlyPremium)}<span style="font-size:14px;color:#64748b;font-weight:600">/mo</span></div>
          <div style="color:#64748b;font-size:13px">${money(o.annualPremium)}/yr</div>
          ${save}
        </td>
      </tr></table>

      <div style="margin:12px 0 6px">${badge(o.provenance)}${o.rideshareIncluded ? `<span style="display:inline-block;margin-left:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#ccfbf1;color:#0f766e">RIDESHARE ENDORSEMENT</span>` : ""}</div>

      <div style="color:#334155;font-size:15px;line-height:22px;margin:10px 0">${esc(o.reasoning)}</div>

      ${coverageLines(o.coverageSummary)}
      <div style="margin:10px 0 2px">${list(o.discountsApplied.map((d) => `+ ${d}`), "#f1f5f9")}</div>
      ${o.discountsAvailable.length ? `<div style="color:#64748b;font-size:13px;margin-top:4px">Still available: ${esc(o.discountsAvailable.join(", "))}</div>` : ""}

      ${ref}

      <div style="border-top:1px solid #e2e8f0;margin-top:12px;padding-top:12px">
        <div style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Call to finalize</div>
        ${contactRows.join("")}
        ${o.expiresAt ? `<div style="color:#94a3b8;font-size:13px;margin-top:6px">Quote expires ${esc(o.expiresAt)}</div>` : ""}
      </div>
      ${whatToSay}
    </td></tr>
  </table>`;
}

export function renderReportHtml(m: ReportModel): string {
  const bestSave = m.options.reduce((max, o) => Math.max(max, o.monthlySavings ?? 0), 0);
  const gap = m.gapSection.hasGap
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:18px">
         <div style="color:#9a3412;font-size:15px;font-weight:800;margin-bottom:6px">The gap that can bankrupt you</div>
         <div style="color:#7c2d12;font-size:14px;line-height:21px">${esc(m.gapSection.text)}</div>
         ${m.gapSection.closedBy.length ? `<div style="color:#166534;font-size:14px;font-weight:700;margin-top:8px">Closed by: ${esc(m.gapSection.closedBy.join(", "))}</div>` : ""}
       </td></tr></table>` : "";

  const anySim = m.options.some((o) => o.provenance === "simulated");
  const honesty = anySim
    ? `<div style="color:#64748b;font-size:12px;line-height:18px;margin-top:8px">Options marked SIMULATED use realistic filed-rate data for the demo, not live bindable quotes. The phone call, the VIN decode, and this email are real. In production the mocked feed becomes real through a licensed agency partner.</div>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media (prefers-color-scheme: dark) {
    .cl-body { background:#0f172a !important; }
    .cl-card { background:#1e293b !important; border-color:#334155 !important; }
    .cl-h { color:#f1f5f9 !important; }
  }
</style></head>
<body class="cl-body" style="margin:0;padding:0;background:#f1f5f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <tr><td style="padding:0 4px 16px">
          <div style="color:#0d9488;font-size:13px;font-weight:800;letter-spacing:.06em">CLEARLANE</div>
          <div class="cl-h" style="color:#0f172a;font-size:24px;font-weight:800;margin-top:4px">${esc(m.driverFirstName)}, your 3 best options</div>
          ${bestSave > 0 ? `<div style="color:#166534;font-size:16px;font-weight:700;margin-top:4px">Up to ${money(bestSave)}/mo less than your ${esc(m.currentInsurer ?? "current")} policy</div>` : ""}
        </td></tr>
        <tr><td>${gap}</td></tr>
        <tr><td>${m.options.map((o, i) => optionCard(o, i + 1)).join("")}</td></tr>
        <tr><td style="padding:8px 4px 24px">${honesty}
          <div style="color:#94a3b8;font-size:12px;margin-top:10px">We never ask for your SSN, license number, or payment info to get a quote.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendReport(sessionId: string, m: ReportModel, to: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const html = renderReportHtml(m);
  const db = supabaseAdmin();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `ClearLane <${from}>`,
      to: [to],
      subject: `${m.driverFirstName}, your 3 best auto insurance options`,
      html,
    }),
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    await db.from("reports").update({ email_status: "failed" }).eq("session_id", sessionId);
    throw new Error(`resend ${res.status}: ${JSON.stringify(body)}`);
  }
  await db.from("reports").update({ email_status: "sent", email_provider_id: body.id, sent_at: new Date().toISOString() }).eq("session_id", sessionId);
  return body.id as string;
}
