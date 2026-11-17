import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { checkCounterparty } from "@/lib/xrpl/check";
import { XrplError } from "@/lib/xrpl/client";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 30;
export const OPTIONS = options;
const run = async (raw: unknown) => {
  try {
    return json({ ...envelope(await checkCounterparty(String(raw ?? "").trim()), XRPL_SOURCE), disclaimer: DISCLAIMER }, 200, { "Cache-Control": "no-store" });
  } catch (e) {
    if (e instanceof XrplError) return e.code === "invalid_address" ? error(400, "invalid_address", e.message) : error(502, "xrpl_unavailable", e.message);
    throw e;
  }
};
// XRPL Counterparty Check costs 2 credits: it reads several ledger views plus the issuer certificate.
export const GET = handler<unknown>(async (req) => run(new URL(req.url).searchParams.get("address")), { cost: 2 });
export const POST = handler<unknown>(async (req) => {
  let b: { address?: unknown };
  try { b = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"address": "r..."}'); }
  return run(b?.address);
}, { cost: 2 });
