import { callerPlan, chargeExtra, envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { pool } from "@/lib/util";
import { checkCounterparty } from "@/lib/xrpl/check";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 60;
export const OPTIONS = options;
const MAX = { BASIC: 0, PRO: 10, ULTRA: 25, MEGA: 25 } as const;

export const POST = handler<unknown>(async (req) => {
  let body: { addresses?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"addresses": ["r...", "r..."]}'); }
  const max = MAX[callerPlan(req)];
  if (!Array.isArray(body?.addresses) || !body.addresses.length) return error(400, "invalid_params", 'Send JSON: {"addresses": ["r...", "r..."]}');
  if (body.addresses.length > max) return error(400, "too_many_addresses", `Your plan allows up to ${max} addresses per batch call.`);
  await chargeExtra(req, body.addresses.length * 2 - 2);
  const results = await pool(body.addresses.map(String), 4, async (a) => {
    try { return { status: "ok", ...(await checkCounterparty(a.trim())) }; }
    catch (e) { return { address: a, status: "error", error: (e as Error).message }; }
  });
  const ok = results.filter((r): r is Extract<typeof r, { verdict: string }> => "verdict" in r);
  return json({ ...envelope({
    summary: { submitted: results.length, checked: ok.length, failed: results.length - ok.length,
      block: ok.filter((r) => r.verdict === "block").length, review: ok.filter((r) => r.verdict === "review").length, clear: ok.filter((r) => r.verdict === "clear").length },
    results,
  }, XRPL_SOURCE), disclaimer: DISCLAIMER }, 200, { "Cache-Control": "no-store" });
}, { minPlan: "PRO", planLabel: "Pro", cost: 2 });
