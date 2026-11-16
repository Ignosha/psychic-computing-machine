// Derived analytics computed from live NHTSA data. Every output is reproducible from public records,
// and each method is documented in METHODOLOGY so customers can audit it.
import {
  getComplaintSummary, getRecalls, getSafetyRatings, splitComponents,
  type ComplaintSummary, type ComponentStat, type Recall, type SafetyRating,
} from "./nhtsa";

export const METHODOLOGY = {
  safetyScore:
    "Starts at 100. Minus 5 per recall campaign (max 35), minus 15 per do-not-drive or park-outside recall (max 30), minus 5/15/25 for an NHTSA overall crash rating of 4/3/2-or-less stars (unrated: no change). Grades: A>=90, B>=80, C>=70, D>=60, else F. Complaint counts are excluded because they scale with sales volume.",
  defectSignals:
    "Complaint clusters on a component that has NO recall for this vehicle. A cluster needs at least 10 complaints. Severity = complaints + 5 x crashes + 5 x fires + 10 x injuries + 50 x deaths. Trend compares complaints filed in the last 12 months with the 12 months before (rising: >=3 recent and >1.5x prior; falling: <0.67x prior). These are owner reports, not confirmed defects or predictions.",
  remedyType:
    "Classified from the manufacturer's remedy text at the time of filing: over_the_air, software, replace, inspect, repair, refund or other. 'phased' means the manufacturer announced a staged rollout.",
  modelHistory:
    "Per model year: recalls, urgent recalls, complaints and serious incidents (crashes + fires + injuries + deaths) from NHTSA, plus the safety score. Worst years rank by urgent recalls, then serious incidents, then recalls. Years with no NHTSA records are excluded from rankings, and the two newest years cannot be ranked best because they have had less time to accumulate reports. Years with zero complaints on record also cannot rank best. When NHTSA files complaints under variant names (e.g. ACCORD SEDAN), those are combined and listed in complaintModels.",
};

// ---------- Remedy classification ----------
export function classifyRemedy(r: Recall) {
  const t = (r.Remedy || "").toLowerCase();
  const type = r.overTheAirUpdate || /over[- ]the[- ]air/.test(t) ? "over_the_air"
    : /reprogram|software|re-flash|reflash|update the .*(module|calibration)/.test(t) ? "software"
    : /\binspect/.test(t) ? "inspect"
    : /replace/.test(t) ? "replace"
    : /refund|repurchase|buy ?back/.test(t) ? "refund"
    : /repair|install|modify|adjust|apply|add |reposition|secure/.test(t) ? "repair"
    : "other";
  return { type, phased: /phased|in phases|multiple phases/.test(t) };
}

// ---------- Safety score ----------
export function safetyScore(recalls: Recall[], ratings: SafetyRating[]) {
  const urgent = recalls.filter((r) => r.parkIt || r.parkOutSide).length;
  const overall = ratings.map((r) => Number(r.OverallRating)).filter((n) => n >= 1 && n <= 5);
  const best = overall.length ? Math.max(...overall) : null;
  const parts = [
    { factor: "recalls", value: recalls.length, points: -Math.min(35, recalls.length * 5) },
    { factor: "urgentRecalls", value: urgent, points: -Math.min(30, urgent * 15) },
    { factor: "crashRating", value: best, points: best == null ? 0 : best >= 5 ? 0 : best === 4 ? -5 : best === 3 ? -15 : -25 },
  ];
  const score = Math.max(0, 100 + parts.reduce((s, p) => s + p.points, 0));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return { score, grade, breakdown: parts };
}

// ---------- Defect signals ----------
export type DefectSignal = ComponentStat & { severity: number; trend: "rising" | "steady" | "falling" };

export function recalledComponents(recalls: Recall[]) {
  return new Set(recalls.flatMap((r) => splitComponents(r.Component).map((c) => c.split(":")[0].trim())));
}

export function defectSignals(complaints: ComplaintSummary, recalls: Recall[], limit = 5): DefectSignal[] {
  const recalled = recalledComponents(recalls);
  return complaints.components
    .filter((c) => c.count >= 10 && c.component !== "UNKNOWN OR OTHER" && !recalled.has(c.component.split(":")[0]))
    .map((c) => ({
      ...c,
      severity: c.count + 5 * c.crashes + 5 * c.fires + 10 * c.injuries + 50 * c.deaths,
      trend: (c.last12Months >= 3 && c.last12Months > c.prior12Months * 1.5 ? "rising"
        : c.last12Months < c.prior12Months * 0.67 ? "falling" : "steady") as DefectSignal["trend"],
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, limit);
}

// ---------- Model-year history ----------
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export async function modelHistory(make: string, model: string, from: number, to: number) {
  const years = Array.from({ length: to - from + 1 }, (_, i) => to - i);
  const rows = await pool(years, 4, async (year) => {
    const [recalls, complaints, ratings] = await Promise.all([
      getRecalls(year, make, model), getComplaintSummary(year, make, model), getSafetyRatings(year, make, model),
    ]);
    const urgent = recalls.filter((r) => r.parkIt || r.parkOutSide).length;
    const serious = complaints.crashes + complaints.fires + complaints.injuries + complaints.deaths;
    const hasData = recalls.length > 0 || complaints.total > 0 || ratings.length > 0;
    return {
      year, hasData,
      recalls: recalls.length, urgentRecalls: urgent,
      complaints: complaints.total, complaintModels: complaints.matchedModels, seriousIncidents: serious, deaths: complaints.deaths,
      topProblem: complaints.byComponent.find((c) => c.component !== "UNKNOWN OR OTHER")?.component ?? null,
      ...(() => { const s = safetyScore(recalls, ratings); return { safetyScore: s.score, grade: s.grade }; })(),
    };
  });
  const ranked = rows.filter((r) => r.hasData);
  const worst = [...ranked].sort((a, b) => b.urgentRecalls - a.urgentRecalls || b.seriousIncidents - a.seriousIncidents || b.recalls - a.recalls);
  // Recent years haven't had time to accumulate complaints or recalls, so they can't be called "best" yet.
  const matureYear = new Date().getFullYear() - 2;
  // A year with zero complaints usually means missing records, not a perfect car, so it can't rank best.
  const best = [...ranked].filter((r) => r.year <= matureYear && r.complaints > 0).sort((a, b) => a.urgentRecalls - b.urgentRecalls || a.seriousIncidents - b.seriousIncidents || a.recalls - b.recalls);
  const k = Math.min(3, Math.floor(ranked.length / 2));
  return {
    make: make.toUpperCase(), model: model.toUpperCase(), from, to,
    years: rows.map((r) => ({ ...r, tooNewToRank: r.year > matureYear })),
    worstYears: worst.slice(0, k).map((r) => r.year),
    bestYears: best.slice(0, k).map((r) => r.year),
  };
}

export { pool };
