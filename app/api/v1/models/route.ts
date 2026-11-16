import { envelope, error, handler, json, options } from "@/lib/api";
import { getModels, validYear } from "@/lib/nhtsa";

export const OPTIONS = options;
export const GET = handler<unknown>(async (req) => {
  const p = new URL(req.url).searchParams;
  const year = validYear(p.get("year") || "");
  const make = (p.get("make") || "").trim().slice(0, 60);
  if (!year || !make) return error(400, "invalid_params", "Required query parameters: year, make.");
  const models = await getModels(year, make);
  return json(envelope({ year, make: make.toUpperCase(), count: models.length, models }));
});
