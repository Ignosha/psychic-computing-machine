import { envelope, error, handler, json, options } from "@/lib/api";
import { maxYear, MIN_YEAR } from "@/lib/nhtsa";
import { METHODOLOGY, modelHistory } from "@/lib/insights";

export const maxDuration = 60;
export const OPTIONS = options;
export const GET = handler<unknown>(async (req) => {
  const p = new URL(req.url).searchParams;
  const make = (p.get("make") || "").trim().slice(0, 60);
  const model = (p.get("model") || "").trim().slice(0, 80);
  const to = Math.min(Number(p.get("to")) || maxYear(), maxYear());
  const from = Math.max(Number(p.get("from")) || to - 9, MIN_YEAR);
  if (!make || !model) return error(400, "invalid_params", "Required query parameters: make, model. Optional: from, to (max 15 years).");
  if (from > to || to - from > 14) return error(400, "invalid_range", "Year range must be valid and at most 15 years.");
  return json(envelope({ ...(await modelHistory(make, model, from, to)), methodology: METHODOLOGY.modelHistory }));
}, { minPlan: "PRO" });
