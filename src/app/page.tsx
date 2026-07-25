import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">ClearLane</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight text-ink">
        One form tonight. Your three best options before you wake up.
      </h1>
      <p className="mt-4 text-base text-slate-600">
        We shop every carrier, including the Michigan ones you can only reach by phone, and we
        make the calls you do not have time for. No login. Just an email in the morning.
      </p>
      <Link
        href="/intake"
        className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-accent px-6 text-lg font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        Start, it takes under 3 minutes
      </Link>
      <p className="mt-4 text-xs text-slate-500">
        We never ask for your SSN, license number, or payment info to get a quote.
      </p>
    </main>
  );
}
