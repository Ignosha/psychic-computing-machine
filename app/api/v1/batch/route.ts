import { chargeExtra, envelope, error, handler, json, options } from "@/lib/api";
import { decodeVinBatch, getRecalls, getSafetyRatings, VIN_RE } from "@/lib/nhtsa";
import { METHODOLOGY, pool, safetyScore } from "@/lib/insights";

export const maxDuration = 60;
export const OPTIONS = options;
const MAX = 50;

// Fleet / dealer inventory screening: decode up to 50 VINs and flag recalls, urgent recalls and safety grades.
export const POST = handler<unknown>(async (req) => {
  let body: unknown;
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"vins": ["VIN1", "VIN2", ...]}'); }
  const raw = (body as { vins?: unknown })?.vins;
  if (!Array.isArray(raw) || !raw.length) return error(400, "invalid_params", 'Send JSON: {"vins": ["VIN1", "VIN2", ...]}');
  if (raw.length > MAX) return error(400, "too_many_vins", `At most ${MAX} VINs per request.`);
  const vins = [...new Set(raw.map((v) => String(v).toUpperCase().replace(/[^A-Z0-9]/g, "")))];
  await chargeExtra(req, vins.length - 1);
  const valid = vins.filter((v) => VIN_RE.test(v));
  const decoded = valid.length ? await decodeVinBatch(valid) : [];
  const byVin = new Map(decoded.map((d) => [d.vin, d]));

  // Each unique year/make/model is looked up once, however many VINs share it.
  const keys = [...new Set(decoded.filter((d) => !d.error).map((d) => `${d.year}|${d.make}|${d.model}`))];
  const reports = new Map(await pool(keys, 5, async (k) => {
    const [y, mk, md] = k.split("|");
    const [recalls, ratings] = await Promise.all([getRecalls(y, mk, md), getSafetyRatings(y, mk, md)]);
    return [k, { recalls, ratings }] as const;
  }));

  const results = vins.map((vin) => {
    if (!VIN_RE.test(vin)) return { vin, status: "error", error: "Invalid VIN format" };
    const d = byVin.get(vin);
    if (!d || d.error) return { vin, status: "error", error: d?.error || "Could not decode" };
    const { recalls, ratings } = reports.get(`${d.year}|${d.make}|${d.model}`)!;
    const urgent = recalls.filter((r) => r.parkIt || r.parkOutSide);
    const s = safetyScore(recalls, ratings);
    return {
      vin, status: "ok",
      vehicle: { year: Number(d.year), make: d.make, model: d.model, trim: d.trim || null },
      recallCount: recalls.length,
      urgentCount: urgent.length,
      urgentCampaigns: urgent.map((r) => ({ campaignNumber: r.NHTSACampaignNumber, doNotDrive: !!r.parkIt, parkOutside: !!r.parkOutSide, component: r.Component })),
      campaignNumbers: recalls.map((r) => r.NHTSACampaignNumber),
      safetyScore: s.score, grade: s.grade,
    };
  });
  const ok = results.filter((r): r is Extract<typeof r, { recallCount: number }> => "recallCount" in r);
  return json(envelope({
    summary: {
      submitted: raw.length, unique: vins.length, decoded: ok.length, failed: vins.length - ok.length,
      vehiclesWithRecalls: ok.filter((r) => r.recallCount > 0).length,
      vehiclesWithUrgentRecalls: ok.filter((r) => r.urgentCount > 0).length,
    },
    results,
    note: "Recalls cover each VIN's model line. Confirm open (unrepaired) status for a specific VIN with the manufacturer or nhtsa.gov/recalls.",
    methodology: METHODOLOGY.safetyScore,
  }));
}, { minPlan: "ULTRA" });
