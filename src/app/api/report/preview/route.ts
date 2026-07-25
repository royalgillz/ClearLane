import { supabaseAdmin } from "@/lib/supabase-admin";
import { assembleReport } from "@/lib/report/build";
import { renderReportHtml } from "@/lib/report/email";

// returns the raw email html for a session, no send. used to screenshot the email in dark
// mode at phone width during the audit, and handy for eyeballing render changes.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("token required", { status: 400 });

  const db = supabaseAdmin();
  const { data: session } = await db
    .from("sessions")
    .select("id, drivers(email)")
    .eq("status_token", token)
    .maybeSingle();
  if (!session) return new Response("not found", { status: 404 });

  const driver = Array.isArray(session.drivers) ? session.drivers[0] : session.drivers;
  const model = await assembleReport(session.id, driver?.email ?? "", false);
  return new Response(renderReportHtml(model), { headers: { "content-type": "text/html; charset=utf-8" } });
}
