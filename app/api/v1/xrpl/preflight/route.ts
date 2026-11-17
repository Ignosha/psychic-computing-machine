import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { parsePreflight, preflight } from "@/lib/xrpl/preflight";
import { XrplError } from "@/lib/xrpl/client";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 30;
export const OPTIONS = options;
const run = async (raw: Record<string, unknown>) => {
  const p = parsePreflight(raw);
  if (typeof p === "string") return error(400, "invalid_params", p);
  try { return json({ ...envelope(await preflight(p), XRPL_SOURCE), disclaimer: DISCLAIMER }); }
  catch (e) { if (e instanceof XrplError) return error(502, "xrpl_unavailable", e.message); throw e; }
};
export const GET = handler<unknown>(async (req) => run(Object.fromEntries(new URL(req.url).searchParams)));
export const POST = handler<unknown>(async (req) => {
  try { return run(await req.json()); } catch { return error(400, "invalid_json", 'Send JSON like {"to": "r...", "amount": "25", "currency": "XRP", "destinationTag": 123}'); }
});
