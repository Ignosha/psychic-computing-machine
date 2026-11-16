import { unstable_cache } from "next/cache";

// Live data client for the free, keyless NHTSA public APIs.
// Docs: https://www.nhtsa.gov/nhtsa-datasets-and-apis

const API = "https://api.nhtsa.gov";
const VPIC = "https://vpic.nhtsa.dot.gov/api";
export const REVALIDATE = 60 * 60 * 6; // refresh live data every 6 hours

export class UpstreamError extends Error {}

// NHTSA returns HTTP 400 with a valid empty body for "no results"; treat that as data.
// Network failures and other statuses throw, so an outage is never reported as "0 recalls".
async function getJson<T>(url: string, raw = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, ...(raw ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE } }) });
  } catch (e) {
    throw new UpstreamError(`NHTSA unreachable: ${(e as Error).message}`);
  }
  if (res.ok || res.status === 400) {
    try {
      return (await res.json()) as T;
    } catch {
      /* fall through */
    }
  }
  throw new UpstreamError(`NHTSA returned HTTP ${res.status}`);
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const ACRONYMS = new Set(["BMW","GMC","USA","AMG","SUV","EV","AWD","FWD","RWD","4WD","2WD","VW","II","III","IV","LLC","GT","GTI","SRT","SS","RS","LX","EX","LE","SE","XLE","XSE","SR","SR5","TRD","SI","HR-V","CR-V","BR-V","ZR2","RAV4","LS","ES","IS","GS","RX","NX","GX","LX","UX","MDX","RDX","TLX","ILX","XC90","XC60","XC40","CX-5","CX-9","CX-30","CX-50","CX-90","MX-5","EQS","EQE","GLE","GLC","GLS","GLA","GLB","SL","CLA","AMG","F-150","F-250","F-350","E-350","RV","ATV","LED","ABS","DOT","EPS"]);
export const titleCase = (s: string) =>
  s.split(/(\s+|\/|\(|\))/).map((w) => {
    const u = w.toUpperCase();
    if (ACRONYMS.has(u) || /\d/.test(w)) return u;
    return w.toLowerCase().replace(/(^|-)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  }).join("");

export type Recall = {
  Manufacturer: string;
  NHTSACampaignNumber: string;
  parkIt: boolean;
  parkOutSide: boolean;
  overTheAirUpdate?: boolean;
  ReportReceivedDate: string; // DD/MM/YYYY
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  Notes?: string;
  PotentialNumberofUnitsAffected?: number;
  ModelYear?: string;
  Make?: string;
  Model?: string;
};

export type Complaint = {
  odiNumber: number;
  crash: boolean;
  fire: boolean;
  numberOfInjuries: number;
  numberOfDeaths: number;
  dateOfIncident: string;
  dateComplaintFiled: string;
  components: string;
  summary: string;
};

export function parseDmy(d: string): number {
  const [dd, mm, yyyy] = (d || "").split("/").map(Number);
  return yyyy ? Date.UTC(yyyy, (mm || 1) - 1, dd || 1) : 0;
}
export function fmtDmy(d: string): string {
  const t = parseDmy(d);
  return t ? new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : d;
}

export const MIN_YEAR = 1995;
export function maxYear() {
  return new Date().getFullYear() + 1;
}
export function validYear(y: string): number | null {
  const n = Number(y);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= maxYear() ? n : null;
}

export async function getMakes(year: number): Promise<string[]> {
  const j = await getJson<{ results: { make: string }[] }>(
    `${API}/products/vehicle/makes?modelYear=${year}&issueType=r`
  );
  return [...new Set((j?.results ?? []).map((r) => r.make))].sort();
}

export async function getModels(year: number, make: string): Promise<string[]> {
  const j = await getJson<{ results: { model: string }[] }>(
    `${API}/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=r`
  );
  return [...new Set((j?.results ?? []).map((r) => r.model))].sort();
}

export async function resolveMake(year: number, slug: string) {
  return (await getMakes(year)).find((m) => slugify(m) === slug) ?? null;
}
export async function resolveModel(year: number, make: string, slug: string) {
  return (await getModels(year, make)).find((m) => slugify(m) === slug) ?? null;
}

export async function getRecalls(year: number | string, make: string, model: string): Promise<Recall[]> {
  const j = await getJson<{ results: Recall[] }>(
    `${API}/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
  );
  return (j?.results ?? []).sort((a, b) => parseDmy(b.ReportReceivedDate) - parseDmy(a.ReportReceivedDate));
}

export async function getCampaign(id: string): Promise<Recall[]> {
  const j = await getJson<{ results: Recall[] }>(
    `${API}/recalls/campaignNumber?campaignNumber=${encodeURIComponent(id)}`
  );
  return j?.results ?? [];
}

export type ComplaintSummary = {
  total: number;
  crashes: number;
  fires: number;
  injuries: number;
  deaths: number;
  byComponent: { component: string; count: number }[];
  recent: Complaint[];
};

// Complaint lists for popular models exceed the 2MB fetch-cache limit, so cache the small computed summary instead.
const cachedComplaintSummary = unstable_cache(
  (year: string, make: string, model: string) => buildComplaintSummary(year, make, model),
  ["complaint-summary-v1"],
  { revalidate: REVALIDATE }
);
export function getComplaintSummary(year: number | string, make: string, model: string): Promise<ComplaintSummary> {
  return cachedComplaintSummary(String(year), make.toUpperCase(), model.toUpperCase());
}

async function buildComplaintSummary(year: string, make: string, model: string): Promise<ComplaintSummary> {
  const j = await getJson<{ results: Complaint[] }>(
    `${API}/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`,
    true
  );
  const rows = j?.results ?? [];
  const comp = new Map<string, number>();
  for (const r of rows)
    for (const c of (r.components || "UNKNOWN").split(/,(?! )/))
      comp.set(c.trim(), (comp.get(c.trim()) ?? 0) + 1);
  const toTime = (d: string) => {
    const [m, dd, y] = (d || "").split("/").map(Number);
    return y ? Date.UTC(y, m - 1, dd) : 0;
  };
  return {
    total: rows.length,
    crashes: rows.filter((r) => r.crash).length,
    fires: rows.filter((r) => r.fire).length,
    injuries: rows.reduce((s, r) => s + (r.numberOfInjuries || 0), 0),
    deaths: rows.reduce((s, r) => s + (r.numberOfDeaths || 0), 0),
    byComponent: [...comp].map(([component, count]) => ({ component, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    recent: [...rows].sort((a, b) => toTime(b.dateComplaintFiled) - toTime(a.dateComplaintFiled)).slice(0, 5),
  };
}

export type SafetyRating = {
  VehicleDescription: string;
  OverallRating: string;
  OverallFrontCrashRating: string;
  OverallSideCrashRating: string;
  RolloverRating: string;
  ComplaintsCount?: number;
  RecallsCount?: number;
};

export async function getSafetyRatings(year: number | string, make: string, model: string): Promise<SafetyRating[]> {
  const list = await getJson<{ Results: { VehicleId: number }[] }>(
    `${API}/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`
  );
  const ids = (list?.Results ?? []).slice(0, 4).map((r) => r.VehicleId);
  const out = await Promise.all(
    ids.map((id) => getJson<{ Results: SafetyRating[] }>(`${API}/SafetyRatings/VehicleId/${id}`))
  );
  return out.flatMap((r) => r?.Results ?? []);
}

export type VinInfo = { vin: string; make: string; model: string; year: string; trim: string; body: string; plant: string; error: string; engine: string; fuel: string };

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export async function decodeVin(vin: string): Promise<VinInfo | null> {
  const j = await getJson<{ Results: Record<string, string>[] }>(
    `${VPIC}/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`
  );
  const r = j.Results?.[0];
  if (!r) return null;
  return {
    vin,
    make: r.Make,
    model: r.Model,
    year: r.ModelYear,
    trim: r.Trim,
    body: r.BodyClass,
    plant: [r.PlantCity, r.PlantState, r.PlantCountry].filter(Boolean).join(", "),
    engine: [r.DisplacementL && `${Number(r.DisplacementL).toFixed(1)}L`, r.EngineCylinders && `${r.EngineCylinders}-cyl`].filter(Boolean).join(" "),
    fuel: r.FuelTypePrimary,
    error: r.ErrorCode && r.ErrorCode !== "0" ? r.ErrorText : "",
  };
}

// Mainstream brands surfaced first on index pages (all makes are still listed).
export const POPULAR = ["TOYOTA","HONDA","FORD","CHEVROLET","NISSAN","JEEP","HYUNDAI","KIA","SUBARU","RAM","GMC","TESLA","VOLKSWAGEN","BMW","MERCEDES-BENZ","MAZDA","DODGE","LEXUS","AUDI","BUICK","CADILLAC","ACURA","CHRYSLER","VOLVO","LINCOLN","INFINITI","MITSUBISHI","PORSCHE","LAND ROVER","GENESIS","RIVIAN","MINI"];
