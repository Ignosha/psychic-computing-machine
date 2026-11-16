import { decodeVin, defectReport, envelope, error, handler, json, options } from "@/lib/api";
import { validYear, VIN_RE } from "@/lib/nhtsa";

export const maxDuration = 60;
export const OPTIONS = options;
export const GET = handler<unknown>(async (req) => {
  const p = new URL(req.url).searchParams;
  let year: number | string | null = validYear(p.get("year") || "");
  let make = (p.get("make") || "").trim().slice(0, 60);
  let model = (p.get("model") || "").trim().slice(0, 80);
  const vin = (p.get("vin") || "").toUpperCase();
  if (vin) {
    if (!VIN_RE.test(vin)) return error(400, "invalid_vin", "VIN must be 17 characters (letters and digits, excluding I, O and Q).");
    const v = await decodeVin(vin);
    if (!v?.make || !v.model || !v.year) return error(404, "vin_not_decoded", v?.error || "NHTSA could not decode this VIN.");
    ({ year, make, model } = v);
  }
  if (!year || !make || !model) return error(400, "invalid_params", "Provide vin, or year + make + model.");
  return json(envelope(await defectReport(year, make, model)));
}, { minPlan: "PRO" });
