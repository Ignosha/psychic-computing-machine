import { timingSafeEqual } from "node:crypto";
import * as billing from "./billing/accounts";
import { planName, planRank, PLAN_ORDER, type Plan } from "./plans";
import { classifyRemedy, defectSignals, METHODOLOGY, safetyScore } from "./insights";
import {
  decodeVin, getCampaign, getComplaintSummary, getRecalls, getSafetyRatings, parseDmy,
  UpstreamError, REVALIDATE, type Recall, type SafetyRating,
} from "./nhtsa";

// Two ways to authenticate:
// 1. RapidAPI: when RAPIDAPI_PROXY_SECRET is set, requests forwarded by RapidAPI carry the proxy secret (one per listing,
//    comma-separated) plus the caller's plan and username.
// 2. Prepaid crypto credits: an "X-API-Key" bought with USDC (see /api/v1/billing). Each call deducts credits;
//    failed calls (4xx/5xx) are refunded automatically.
// In production with neither configured the API is closed unless API_PUBLIC=true, so it can't be used for free by accident.
const SECRETS = (process.env.RAPIDAPI_PROXY_SECRET || "").split(",").map((s) => s.trim()).filter(Boolean);
const SECRET = SECRETS.length > 0;
const PUBLIC = process.env.API_PUBLIC === "true";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" };

function rapidApiAuthorized(req: Request) {
  if (SECRET) {
    const got = Buffer.from(req.headers.get("x-rapidapi-proxy-secret") || "");
    return SECRETS.some((s) => { const want = Buffer.from(s); return got.length === want.length && timingSafeEqual(got, want); });
  }
  return PUBLIC || process.env.NODE_ENV !== "production";
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": status === 200 ? `private, max-age=${REVALIDATE}` : "no-store", ...extraHeaders },
  });
}
export const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
export const options = () => new Response(null, { status: 204, headers: CORS });

// Per-request state for API-key (crypto credit) callers.
type KeyCtx = { accountId: string; charged: number; credits: number };
const keyCtx = new WeakMap<Request, KeyCtx>();

// The caller's plan. Crypto-credit keys get Business-level features (they pay per call); without RapidAPI
// (local/dev or API_PUBLIC) every feature is available.
export const callerPlan = (req: Request): Plan =>
  keyCtx.has(req) ? "ULTRA" : SECRET ? PLAN_ORDER[planRank(req.headers.get("x-rapidapi-subscription"))] : "MEGA";

// Stable customer identity for stored data (monitors, alerts, webhooks): the crypto-credit account, or RapidAPI's
// X-RapidAPI-User (trusted only after the proxy secret is verified), or "dev" locally. Otherwise none.
export const callerId = (req: Request): string | null => {
  const k = keyCtx.get(req);
  if (k) return `key:${k.accountId}`;
  return SECRET ? (req.headers.get("x-rapidapi-user") || "").slice(0, 120) || null : process.env.NODE_ENV !== "production" ? "dev" : null;
};

export class PaymentRequired extends Error {}

// Charges additional credits for multi-item requests (batch items, monitors). No-op for RapidAPI callers.
export async function chargeExtra(req: Request, credits: number) {
  const k = keyCtx.get(req);
  if (!k || credits <= 0) return;
  try {
    k.credits = await billing.adjust(k.accountId, credits);
    k.charged += credits;
  } catch (e) {
    if ((e as Error).message.includes("insufficient_credits")) throw new PaymentRequired(`This request needs ${credits + 1} credits.`);
    throw e;
  }
}

// Wraps a handler with auth, plan gating, credit charging and consistent errors.
// opts.cost: credits charged per call for API-key callers (default 1; 0 for free endpoints).
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>, opts: { minPlan?: Plan; planLabel?: string; cost?: number } = {}) {
  return async (req: Request, ctx: C) => {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey) {
      const auth = await billing.authenticate(apiKey, opts.cost ?? 1);
      if (!auth.ok) return auth.response;
      keyCtx.set(req, { accountId: auth.accountId, charged: opts.cost ?? 1, credits: auth.credits });
    } else {
      if (!rapidApiAuthorized(req)) return error(401, "unauthorized", "Missing or invalid API credentials. Subscribe via the API marketplace, or buy prepaid credits with USDC: GET /api/v1/billing/info.");
      if (opts.minPlan && SECRET && planRank(req.headers.get("x-rapidapi-subscription")) < PLAN_ORDER.indexOf(opts.minPlan))
        return error(403, "plan_upgrade_required", `This endpoint requires the ${opts.planLabel ?? planName(opts.minPlan)} plan or higher.`);
    }
    let res: Response;
    try {
      res = await fn(req, ctx);
    } catch (e) {
      if (e instanceof PaymentRequired) res = error(402, "insufficient_credits", `${e.message} Top up with USDC: GET /api/v1/billing/info.`);
      else if (e instanceof UpstreamError) res = error(502, "upstream_unavailable", "The NHTSA data source is temporarily unavailable. Please retry shortly.");
      else { console.error(e); res = error(500, "internal_error", "Unexpected error."); }
    }
    const k = keyCtx.get(req);
    if (k) {
      // Failed requests are free: refund everything charged for this call.
      if (res.status >= 400 && k.charged > 0) {
        try { k.credits = await billing.adjust(k.accountId, -k.charged); k.charged = 0; } catch (e) { console.error("refund failed", e); }
      }
      res.headers.set("X-Credits-Charged", String(k.charged));
      res.headers.set("X-Credits-Remaining", String(k.credits));
    }
    return res;
  };
}

const NHTSA = "U.S. National Highway Traffic Safety Administration (NHTSA)";
export const SANCTIONS_SOURCE = "Official sanctions lists: OFAC (U.S. Treasury), UN Security Council, European Union, UK FCDO";
export const envelope = (data: unknown, source: string = NHTSA) => ({ data, meta: { source, generatedAt: new Date().toISOString() } });

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
    remedyType: classifyRemedy(r).type,
    remedyPhased: classifyRemedy(r).phased,
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
      matchedModels: complaints.matchedModels,
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
    safetyScore: { ...safetyScore(recalls, ratings), methodology: METHODOLOGY.safetyScore },
  };
}

export async function defectReport(year: string | number, make: string, model: string) {
  const [recalls, complaints] = await Promise.all([getRecalls(year, make, model), getComplaintSummary(year, make, model)]);
  return {
    vehicle: { year: Number(year), make: make.toUpperCase(), model: model.toUpperCase() },
    complaintsTotal: complaints.total,
    complaintModels: complaints.matchedModels,
    complaintsLast12Months: complaints.last12Months,
    recalledComponents: [...new Set(recalls.flatMap((r) => r.Component.split(/,(?! )/).map((c) => c.split(":")[0].trim())))],
    signals: defectSignals(complaints, recalls, 10).map((s) => ({
      component: s.component, complaints: s.count, last12Months: s.last12Months, prior12Months: s.prior12Months,
      trend: s.trend, crashes: s.crashes, fires: s.fires, injuries: s.injuries, deaths: s.deaths, severity: s.severity,
    })),
    methodology: METHODOLOGY.defectSignals,
  };
}

export { decodeVin, getCampaign };
