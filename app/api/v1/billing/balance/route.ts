import { error, json, options } from "@/lib/api";
import { billingEnabled, hashKey } from "@/lib/billing/accounts";
import { rpc } from "@/lib/sanctions/store";

export const OPTIONS = options;
export async function GET(req: Request) {
  if (!billingEnabled()) return error(503, "billing_unavailable", "Prepaid crypto credits are not enabled on this deployment yet.");
  const key = req.headers.get("x-api-key") || "";
  if (!/^rr_live_[A-Za-z0-9_-]{32}$/.test(key)) return error(401, "invalid_key", "Send your API key in the X-API-Key header.");
  try {
    const b = await rpc<Record<string, unknown>>("bill_balance", { p_key_hash: hashKey(key) });
    return json({ data: { accountId: b.account_id, credits: Number(b.credits), creditsPurchased: Number(b.credits_purchased), createdAt: b.created_at, lastUsedAt: b.last_used_at, payments: b.payments } });
  } catch (e) {
    if ((e as Error).message === "invalid_key") return error(401, "invalid_key", "Invalid API key.");
    return error(503, "billing_unavailable", "Billing is temporarily unavailable. Please retry.");
  }
}
