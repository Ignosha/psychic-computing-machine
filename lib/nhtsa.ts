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

async function fetchRecalls(year: number | string, make: string, model: string): Promise<Recall[]> {
  const j = await getJson<{ results: Recall[] }>(
    `${API}/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
  );
  return j.results ?? [];
}

// If the exact model has no recalls, NHTSA may file them under variant names (2025 "ACCORD" -> ACCORD SEDAN, ACCORD HYBRID).
// VIN decoding returns the base name, so without this fallback a VIN check could wrongly report zero recalls.
export async function getRecalls(year: number | string, make: string, model: string): Promise<Recall[]> {
  let rows = await fetchRecalls(year, make, model);
  if (!rows.length) {
    const base = model.toUpperCase();
    const variants = (await getModels(Number(year), make.toUpperCase())).filter((m) => m.toUpperCase().startsWith(base + " "));
    const seen = new Map<string, Recall>();
    for (const v of variants.slice(0, 6))
      for (const r of await fetchRecalls(year, make, v)) if (!seen.has(r.NHTSACampaignNumber)) seen.set(r.NHTSACampaignNumber, r);
    rows = [...seen.values()];
  }
  return rows.sort((a, b) => parseDmy(b.ReportReceivedDate) - parseDmy(a.ReportReceivedDate));
}

export async function getCampaign(id: string): Promise<Recall[]> {
  const j = await getJson<{ results: Recall[] }>(
    `${API}/recalls/campaignNumber?campaignNumber=${encodeURIComponent(id)}`
  );
  return j?.results ?? [];
}

export type ComponentStat = {
  component: string;
  count: number;
  last12Months: number; // complaints filed in the last 12 months
  prior12Months: number; // complaints filed 12-24 months ago
  crashes: number;
  fires: number;
  injuries: number;
  deaths: number;
};

export type ComplaintSummary = {
  total: number;
  crashes: number;
  fires: number;
  injuries: number;
  deaths: number;
  last12Months: number;
  matchedModels: string[]; // NHTSA complaint model names aggregated (e.g. ACCORD SEDAN + ACCORD HYBRID for ACCORD)
  byComponent: { component: string; count: number }[];
  components: ComponentStat[]; // every component, for defect-signal analysis
  recent: Complaint[];
};

// Complaint lists for popular models exceed the 2MB fetch-cache limit, so cache the small computed summary instead.
const cachedComplaintSummary = unstable_cache(
  (year: string, make: string, model: string) => buildComplaintSummary(year, make, model),
  ["complaint-summary-v3"],
  { revalidate: REVALIDATE }
);
export function getComplaintSummary(year: number | string, make: string, model: string): Promise<ComplaintSummary> {
  return cachedComplaintSummary(String(year), make.toUpperCase(), model.toUpperCase());
}

export const mdyTime = (d: string) => {
  const [m, dd, y] = (d || "").split("/").map(Number);
  return y ? Date.UTC(y, m - 1, dd) : 0;
};
export const splitComponents = (s: string) =>
  (s || "UNKNOWN OR OTHER").split(/,(?! )/).map((c) => c.trim().toUpperCase()).filter(Boolean);

async function buildComplaintSummary(year: string, make: string, model: string): Promise<ComplaintSummary> {
  const fetchRows = async (m: string) =>
    (await getJson<{ results: Complaint[] }>(
      `${API}/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(m)}&modelYear=${year}`,
      true
    )).results ?? [];
  let rows = await fetchRows(model);
  let matchedModels = rows.length ? [model] : [];
  if (!rows.length) {
    // NHTSA often files complaints for newer years under variant names (ACCORD SEDAN, ACCORD HYBRID).
    const list = await getJson<{ results: { model: string }[] }>(
      `${API}/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=c`
    );
    const variants = [...new Set((list.results ?? []).map((r) => r.model.toUpperCase()))].filter((m) => m.startsWith(model + " "));
    const seen = new Set<number>();
    for (const v of variants.slice(0, 6)) {
      const vr = await fetchRows(v);
      if (vr.length) matchedModels.push(v);
      for (const r of vr) if (!seen.has(r.odiNumber)) { seen.add(r.odiNumber); rows.push(r); }
    }
  }
  const now = Date.now(), YEAR = 365 * 864e5;
  const comp = new Map<string, ComponentStat>();
  let last12 = 0;
  for (const r of rows) {
    const age = now - mdyTime(r.dateComplaintFiled);
    const recent = age <= YEAR, prior = age > YEAR && age <= 2 * YEAR;
    if (recent) last12++;
    for (const c of splitComponents(r.components)) {
      const st = comp.get(c) ?? { component: c, count: 0, last12Months: 0, prior12Months: 0, crashes: 0, fires: 0, injuries: 0, deaths: 0 };
      st.count++;
      if (recent) st.last12Months++;
      if (prior) st.prior12Months++;
      if (r.crash) st.crashes++;
      if (r.fire) st.fires++;
      st.injuries += r.numberOfInjuries || 0;
      st.deaths += r.numberOfDeaths || 0;
      comp.set(c, st);
    }
  }
  const components = [...comp.values()].sort((a, b) => b.count - a.count);
  return {
    total: rows.length,
    crashes: rows.filter((r) => r.crash).length,
    fires: rows.filter((r) => r.fire).length,
    injuries: rows.reduce((s, r) => s + (r.numberOfInjuries || 0), 0),
    deaths: rows.reduce((s, r) => s + (r.numberOfDeaths || 0), 0),
    last12Months: last12,
    matchedModels,
    byComponent: components.slice(0, 8).map(({ component, count }) => ({ component, count })),
    components,
    recent: [...rows].sort((a, b) => mdyTime(b.dateComplaintFiled) - mdyTime(a.dateComplaintFiled)).slice(0, 5),
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

export type BatchVin = { vin: string; year: string; make: string; model: string; trim: string; error: string };

// vPIC decodes up to 50 VINs per POST.
export async function decodeVinBatch(vins: string[]): Promise<BatchVin[]> {
  let res: Response;
  try {
    res = await fetch(`${VPIC}/vehicles/DecodeVINValuesBatch/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: `format=json&data=${encodeURIComponent(vins.join(";"))}`,
      cache: "no-store",
    });
  } catch (e) {
    throw new UpstreamError(`NHTSA unreachable: ${(e as Error).message}`);
  }
  if (!res.ok) throw new UpstreamError(`NHTSA returned HTTP ${res.status}`);
  const j = (await res.json()) as { Results: Record<string, string>[] };
  return (j.Results ?? []).map((r) => ({
    vin: (r.VIN || "").toUpperCase(), year: r.ModelYear, make: r.Make, model: r.Model, trim: r.Trim,
    error: r.Make && r.Model && r.ModelYear ? "" : r.ErrorText || "Could not decode",
  }));
}

// Mainstream brands surfaced first on index pages (all makes are still listed).
export const POPULAR = ["TOYOTA","HONDA","FORD","CHEVROLET","NISSAN","JEEP","HYUNDAI","KIA","SUBARU","RAM","GMC","TESLA","VOLKSWAGEN","BMW","MERCEDES-BENZ","MAZDA","DODGE","LEXUS","AUDI","BUICK","CADILLAC","ACURA","CHRYSLER","VOLVO","LINCOLN","INFINITI","MITSUBISHI","PORSCHE","LAND ROVER","GENESIS","RIVIAN","MINI"];
