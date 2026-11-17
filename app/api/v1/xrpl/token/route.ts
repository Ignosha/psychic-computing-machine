import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { tokenReport } from "@/lib/xrpl/token";
import { XrplError } from "@/lib/xrpl/client";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 30;
export const OPTIONS = options;
// Token Risk Report costs 3 credits: issuer, identity, NOSHASHI, AMM, order books, supply and sanctions in one call.
export const GET = handler<unknown>(async (req) => {
  const p = new URL(req.url).searchParams;
  const currency = (p.get("currency") || "").trim(), issuer = (p.get("issuer") || "").trim();
  if (!currency || !issuer) return error(400, "invalid_params", "currency and issuer are required, e.g. ?currency=RLUSD&issuer=rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De");
  try { return json({ ...envelope(await tokenReport(currency, issuer), XRPL_SOURCE), disclaimer: DISCLAIMER }); }
  catch (e) {
    if (e instanceof XrplError) return ["invalid_address", "invalid_currency"].includes(e.code) ? error(400, e.code, e.message) : e.code === "not_found" ? error(404, "not_found", e.message) : error(502, "xrpl_unavailable", e.message);
    throw e;
  }
}, { cost: 3 });
