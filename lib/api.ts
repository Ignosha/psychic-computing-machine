import { timingSafeEqual } from "node:crypto";
import {
  decodeVin, getCampaign, getComplaintSummary, getRecalls, getSafetyRatings, parseDmy,
  UpstreamError, REVALIDATE, type Recall, type SafetyRating,
} from "./nhtsa";

// Auth: when RAPIDAPI_PROXY_SECRET is set, only requests forwarded by RapidAPI (which add this header) are served.
// In production without a secret the API is closed unless API_PUBLIC=true, so it can't be used for free by accident.
const SECRET = process.env.RAPIDAPI_PROXY_SECRET || "";
const PUBLIC = process.env.API_PUBLIC === "true";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

function authorized(req: Request) {
  if (SECRET) {
    const got = Buffer.from(req.headers.get("x-rapidapi-proxy-secret") || "");
    const want = Buffer.from(SECRET);
    return got.length === want.length && timingSafeEqual(got, want);
  }
  return PUBLIC || process.env.NODE_ENV !== "production";
}

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": status === 200 ? `private, max-age=${REVALIDATE}` : "no-store" },
  });
}
export const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
export const options = () => new Response(null, { status: 204, headers: CORS });

// Wraps a handler with auth and consistent errors.
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    if (!authorized(req)) return error(401, "unauthorized", "Missing or invalid API credentials. Subscribe via the API marketplace to get a key.");
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof UpstreamError) return error(502, "upstream_unavailable", "The NHTSA data source is temporarily unavailable. Please retry shortly.");
      console.error(e);
      return error(500, "internal_error", "Unexpected error.");
    }
  };
}

const meta = () => ({ source: "U.S. National Highway Traffic Safety Administration (NHTSA)", generatedAt: new Date().toISOString() });
export const envelope = (data: unknown) => ({ data, meta: meta() });

const iso = (t: number) => (t ? new Date(t).toISOString().slice(0, 10) : null);
const mdyIso = (d: string) => {
  const [m, dd, y] = (d || "").split("/").map(Number);
  return y ? iso(Date.UTC(y, m - 1, dd)) : null;
};
const num = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null);

export function formatRecall(r: Recall) {
  return {
    campaignNumber: r.NHTSACampaignNumber,
    manufacturer: r.Manufacturer,
    component: r.Component,
    summary: r.Summary,
    consequence: r.Consequence,
    remedy: r.Remedy,
    notes: r.Notes || null,
    reportDate: iso(parseDmy(r.ReportReceivedDate)),
    doNotDrive: !!r.parkIt,
    parkOutside: !!r.parkOutSide,
    overTheAirFix: !!r.overTheAirUpdate,
    unitsAffected: r.PotentialNumberofUnitsAffected ?? null,
  };
}

const formatRating = (r: SafetyRating) => ({
  vehicle: r.VehicleDescription,
  overall: num(r.OverallRating),
  frontal: num(r.OverallFrontCrashRating),
  side: num(r.OverallSideCrashRating),
  rollover: num(r.RolloverRating),
});

export async function vehicleReport(year: string | number, make: string, model: string) {
  const [recalls, complaints, ratings] = await Promise.all([
    getRecalls(year, make, model),
    getComplaintSummary(year, make, model),
    getSafetyRatings(year, make, model),
  ]);
  return {
    vehicle: { year: Number(year), make: make.toUpperCase(), model: model.toUpperCase() },
    recalls: {
      count: recalls.length,
      urgentCount: recalls.filter((r) => r.parkIt || r.parkOutSide).length,
      items: recalls.map(formatRecall),
    },
    complaints: {
      total: complaints.total,
      crashes: complaints.crashes,
      fires: complaints.fires,
      injuries: complaints.injuries,
      deaths: complaints.deaths,
      topComponents: complaints.byComponent,
      recent: complaints.recent.map((c) => ({
        id: c.odiNumber, components: c.components, summary: c.summary, crash: c.crash, fire: c.fire,
        injuries: c.numberOfInjuries, deaths: c.numberOfDeaths,
        incidentDate: mdyIso(c.dateOfIncident), filedDate: mdyIso(c.dateComplaintFiled),
      })),
    },
    safetyRatings: ratings.map(formatRating),
  };
}

export { decodeVin, getCampaign };
