import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER, parseQuery, runScreen } from "@/lib/sanctions/api";

export const OPTIONS = options;
const run = (raw: Record<string, unknown>) => {
  const q = parseQuery(raw);
  if (typeof q === "string") return error(400, "invalid_params", q);
  return json({ ...envelope(runScreen(q)), disclaimer: DISCLAIMER });
};
export const GET = handler<unknown>(async (req) => run(Object.fromEntries(new URL(req.url).searchParams)));
export const POST = handler<unknown>(async (req) => {
  try { return run(await req.json()); } catch { return error(400, "invalid_json", 'Send JSON like {"name": "Jane Doe", "dob": "1980-01-31", "country": "France"}.'); }
});
