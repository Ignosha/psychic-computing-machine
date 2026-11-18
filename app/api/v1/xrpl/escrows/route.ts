import { envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { escrowCalendar } from "@/lib/xrpl/security";
import { XrplError } from "@/lib/xrpl/client";
import { XRPL_SOURCE } from "@/lib/xrpl/route-source";

export const maxDuration = 30;
export const OPTIONS = options;
// Escrow Unlock Calendar: upcoming escrow releases for an account.
export const GET = handler<unknown>(async (req) => {
  const address = (new URL(req.url).searchParams.get("address") || "").trim();
  try { return json({ ...envelope(await escrowCalendar(address), XRPL_SOURCE), disclaimer: DISCLAIMER }); }
  catch (e) {
    if (e instanceof XrplError) return e.code === "invalid_address" ? error(400, "invalid_address", e.message) : e.code === "not_found" ? error(404, "not_found", e.message) : error(502, "xrpl_unavailable", e.message);
    throw e;
  }
}, { cost: 1 });
