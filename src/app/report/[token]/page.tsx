import { supabaseAdmin } from "@/lib/supabase-admin";
import { assembleReport } from "@/lib/report/build";
import { renderReportHtml } from "@/lib/report/email";

// web view of the exact email, rendered in an iframe so the email's own html/body/styles
// apply faithfully. this is what a judge sees on a screen. read-only, does not resend.

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseAdmin();
  const { data: session } = await db
    .from("sessions")
    .select("id, drivers(email)")
    .eq("status_token", token)
    .maybeSingle();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Report not found</h1>
      </main>
    );
  }

  const driver = Array.isArray(session.drivers) ? session.drivers[0] : session.drivers;
  const model = await assembleReport(session.id, driver?.email ?? "", false);
  const html = renderReportHtml(model);

  return <iframe srcDoc={html} style={{ border: "none", width: "100%", height: "100vh" }} title="ClearLane report" />;
}
