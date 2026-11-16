import { envelope, error, handler, json, options } from "@/lib/api";
import { getMakes, validYear } from "@/lib/nhtsa";

export const OPTIONS = options;
export const GET = handler<unknown>(async (req) => {
  const year = validYear(new URL(req.url).searchParams.get("year") || "");
  if (!year) return error(400, "invalid_params", "Required query parameter: year (1995 or later).");
  const makes = await getMakes(year);
  return json(envelope({ year, count: makes.length, makes }));
});
