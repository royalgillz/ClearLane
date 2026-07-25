import { NextResponse } from "next/server";

// nhtsa vpic vin decode. free, no key, no signup. we proxy it server-side so the CA
// bundle covers the tls and we can normalize the messy response. vin typos are common,
// so a miss is a soft failure: the form just lets marcus type the car by hand.

type VpicRow = Record<string, string>;

export async function GET(req: Request) {
  const vin = new URL(req.url).searchParams.get("vin")?.trim() ?? "";
  if (vin.length < 11) {
    return NextResponse.json({ ok: false, reason: "vin too short" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ ok: false, reason: `vpic ${res.status}` }, { status: 502 });

    const data = (await res.json()) as { Results?: VpicRow[] };
    const r = data.Results?.[0];
    if (!r) return NextResponse.json({ ok: false, reason: "no result" }, { status: 502 });

    const year = r.ModelYear ? Number(r.ModelYear) : null;
    const make = r.Make || "";
    const model = r.Model || "";

    // vpic returns an error text when the vin does not decode. treat a missing year or
    // make as a decode miss rather than pretending we got a car.
    if (!year || !make) {
      return NextResponse.json({ ok: false, reason: r.ErrorText || "vin did not decode" });
    }

    const engine =
      [r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : "", r.EngineConfiguration, r.EngineCylinders ? `${r.EngineCylinders}cyl` : ""]
        .filter(Boolean)
        .join(" ")
        .trim() || "";

    return NextResponse.json({
      ok: true,
      vehicle: {
        year,
        make: make.toUpperCase(),
        model,
        body: r.BodyClass || "",
        engine,
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "decode failed";
    return NextResponse.json({ ok: false, reason });
  }
}
