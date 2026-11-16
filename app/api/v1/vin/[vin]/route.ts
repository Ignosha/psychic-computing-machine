import { decodeVin, envelope, error, handler, json, options, vehicleReport } from "@/lib/api";
import { VIN_RE } from "@/lib/nhtsa";

export const OPTIONS = options;
export const GET = handler<{ params: Promise<{ vin: string }> }>(async (req, { params }) => {
  const vin = (await params).vin.toUpperCase();
  if (!VIN_RE.test(vin)) return error(400, "invalid_vin", "VIN must be 17 characters (letters and digits, excluding I, O and Q).");
  const v = await decodeVin(vin);
  if (!v || !v.make || !v.model || !v.year) return error(404, "vin_not_decoded", v?.error || "NHTSA could not decode this VIN.");
  const report = await vehicleReport(v.year, v.make, v.model);
  return json(envelope({
    vin,
    decoded: { year: Number(v.year), make: v.make, model: v.model, trim: v.trim || null, bodyClass: v.body || null, engine: v.engine || null, fuelType: v.fuel || null, plant: v.plant || null },
    ...report,
    note: "Recalls cover the model line. Whether this specific VIN has an unrepaired recall must be confirmed with the manufacturer or nhtsa.gov/recalls.",
  }));
});
