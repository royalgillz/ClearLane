import { supabaseAdmin } from "@/lib/supabase-admin";

// confirmation + status. the async story made legible: marcus submitted, we are doing
// the work, the answer lands by email. per-provider progress gets wired in once the
// worker and quote engine exist (phase 3/4).

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseAdmin();

  const { data: session } = await db
    .from("sessions")
    .select("id, status, created_at, drivers(full_name, email)")
    .eq("status_token", token)
    .maybeSingle();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-ink">We could not find that request</h1>
        <p className="mt-3 text-slate-600">The link may be wrong. Try submitting the form again.</p>
      </main>
    );
  }

  const driver = Array.isArray(session.drivers) ? session.drivers[0] : session.drivers;
  const firstName = driver?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">You are all set</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Thanks, {firstName}. Go to sleep.</h1>
        <p className="mt-3 text-base text-slate-700">
          We are shopping every carrier, including the Michigan ones that only quote by phone, and
          making the calls you do not have time for. Your three best options land in your inbox
          {driver?.email ? ` at ${driver.email}` : ""} before you wake up.
        </p>
      </div>

      <div className="mt-6 space-y-3 text-sm text-slate-600">
        <p>Here is what happens next while you sleep:</p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>We pull online quotes from the carriers that publish rates.</li>
          <li>We call the brokers and regional carriers that do not.</li>
          <li>We confirm your rideshare endorsement and stack every discount you qualify for.</li>
          <li>We email you the top 3 with a plain-English reason for each.</li>
        </ol>
      </div>

      {session.status === "report_ready" && (
        <a
          href={`/report/${token}`}
          className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-accent px-6 text-lg font-semibold text-white"
        >
          See your 3 best options
        </a>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">Status: {session.status}</p>
    </main>
  );
}
