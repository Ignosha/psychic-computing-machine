import { callerPlan, chargeExtra, envelope, error, handler, json, options , SANCTIONS_SOURCE } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { sanctionsBatchLimit } from "@/lib/plans";
import { screenWallet, validAddress } from "@/lib/sanctions/wallets";

export const OPTIONS = options;
export const POST = handler<unknown>(async (req) => {
  let body: { addresses?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"addresses": ["0x...", "bc1..."]}'); }
  const max = sanctionsBatchLimit(callerPlan(req));
  if (!Array.isArray(body?.addresses) || !body.addresses.length) return error(400, "invalid_params", 'Send JSON: {"addresses": ["0x...", "bc1..."]}');
  if (body.addresses.length > max) return error(400, "too_many_addresses", `Your plan allows up to ${max} addresses per batch call.`);
  await chargeExtra(req, body.addresses.length - 1);
  const results = body.addresses.map((raw, i) => {
    const a = validAddress(raw);
    return a ? { index: i, status: "ok", ...screenWallet(a) } : { index: i, status: "error", error: "Invalid address" };
  });
  const ok = results.filter((r): r is Extract<typeof r, { sanctioned: boolean }> => "sanctioned" in r);
  return json({ ...envelope({
    summary: { submitted: results.length, screened: ok.length, failed: results.length - ok.length, sanctioned: ok.filter((r) => r.sanctioned).length },
    results,
  }, SANCTIONS_SOURCE), disclaimer: DISCLAIMER });
}, { minPlan: "PRO", planLabel: "Growth" });
