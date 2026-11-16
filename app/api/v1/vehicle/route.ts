import { envelope, error, handler, json, options, vehicleReport } from "@/lib/api";
import { validYear } from "@/lib/nhtsa";

export const OPTIONS = options;
export const GET = handler<unknown>(async (req) => {
  const p = new URL(req.url).searchParams;
  const year = validYear(p.get("year") || "");
  const make = (p.get("make") || "").trim().slice(0, 60);
  const model = (p.get("model") || "").trim().slice(0, 80);
  if (!year || !make || !model) return error(400, "invalid_params", "Required query parameters: year (1995 or later), make, model.");
  return json(envelope(await vehicleReport(year, make, model)));
});
