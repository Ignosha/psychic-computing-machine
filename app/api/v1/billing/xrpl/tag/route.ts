import { error, json, options } from "@/lib/api";
import { authenticate, hashKey, newApiKey, xrplBillingEnabled } from "@/lib/billing/accounts";
import { XRPL_RECEIVER } from "@/lib/billing/xrpl";
import { rpc } from "@/lib/sanctions/store";

export const OPTIONS = options;

// Get your XRPL destination tag. Without X-API-Key, creates a new account (key shown once) with 0 credits.
export async function POST(req: Request) {
  if (!xrplBillingEnabled()) return error(503, "billing_unavailable", "XRP / RLUSD payments are not enabled on this deployment yet.");
  const key = req.headers.get("x-api-key");
  let apiKey: string | null = null;
  try {
    let r: { account_id: string; tag: number; credits: number };
    if (key) {
      const auth = await authenticate(key, 0);
      if (!auth.ok) return auth.response;
      r = await rpc("bill_xrpl_tag", { p_key_hash: hashKey(key), p_create: false });
    } else {
      apiKey = newApiKey();
      r = await rpc("bill_xrpl_tag", { p_key_hash: hashKey(apiKey), p_create: true });
    }
    return json({ data: {
      ...(apiKey ? { apiKey, apiKeyNote: "Store this key now; it is not shown again. Send it as the X-API-Key header." } : {}),
      accountId: r.account_id, credits: Number(r.credits),
      payTo: { address: XRPL_RECEIVER, destinationTag: Number(r.tag), accepted: ["XRP", "RLUSD (issuer rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De)"] },
      next: "Send XRP or RLUSD to payTo.address with payTo.destinationTag, then POST /api/v1/billing/xrpl/claim with {\"txHash\": \"...\"}. A payment without this tag cannot be credited automatically.",
    } }, 200, { "Cache-Control": "no-store" });
  } catch {
    return error(503, "billing_unavailable", "Billing is temporarily unavailable. Please retry.");
  }
}
