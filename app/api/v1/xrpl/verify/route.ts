import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { verifySettlement, type Expect } from "@/lib/xrpl/settlement";
import { isClassicAddress, XrplError } from "@/lib/xrpl/client";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 30;
export const OPTIONS = options;
const run = async (raw: Record<string, unknown>) => {
  const tx = String(raw.tx ?? raw.txHash ?? "").trim();
  const e: Expect = {};
  if (raw.expectTo) { if (!isClassicAddress(String(raw.expectTo))) return error(400, "invalid_params", "expectTo must be an XRPL address."); e.to = String(raw.expectTo); }
  if (raw.expectAmount) { if (!/^\d+(\.\d+)?$/.test(String(raw.expectAmount))) return error(400, "invalid_params", "expectAmount must be a number."); e.amount = String(raw.expectAmount); }
  if (raw.expectCurrency) e.currency = String(raw.expectCurrency).slice(0, 40);
  if (raw.expectIssuer) { if (!isClassicAddress(String(raw.expectIssuer))) return error(400, "invalid_params", "expectIssuer must be an XRPL address."); e.issuer = String(raw.expectIssuer); }
  if (raw.expectDestinationTag !== undefined && raw.expectDestinationTag !== "") {
    const t = Number(raw.expectDestinationTag);
    if (!Number.isInteger(t) || t < 0 || t > 4294967295) return error(400, "invalid_params", "expectDestinationTag must be an integer.");
    e.destinationTag = t;
  }
  try { return json({ ...envelope(await verifySettlement(tx, e), XRPL_SOURCE), disclaimer: DISCLAIMER }); }
  catch (err) {
    if (err instanceof XrplError) return err.code === "invalid_tx" ? error(400, "invalid_tx", err.message) : err.code === "tx_not_found" ? error(404, "tx_not_found", err.message) : error(502, "xrpl_unavailable", err.message);
    throw err;
  }
};
export const GET = handler<unknown>(async (req) => run(Object.fromEntries(new URL(req.url).searchParams)));
export const POST = handler<unknown>(async (req) => {
  try { return run(await req.json()); } catch { return error(400, "invalid_json", 'Send JSON like {"tx": "...", "expectTo": "r...", "expectAmount": "100", "expectCurrency": "RLUSD"}'); }
});
