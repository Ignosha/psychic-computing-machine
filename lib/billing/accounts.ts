// Prepaid credit accounts (supabase/migrations/0002_crypto_billing.sql). Keys are stored only as SHA-256 hashes.
import { createHash, randomBytes } from "node:crypto";
import { monitoringConfigured, rpc, StoreError } from "../sanctions/store";
import { RECEIVER } from "./crypto";
import { XRPL_RECEIVER } from "./xrpl";

export const evmBillingEnabled = () => monitoringConfigured() && Boolean(RECEIVER);
export const xrplBillingEnabled = () => monitoringConfigured() && Boolean(XRPL_RECEIVER);
export const billingEnabled = () => evmBillingEnabled() || xrplBillingEnabled();
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const newApiKey = () => `rr_live_${randomBytes(24).toString("base64url")}`;
const KEY_RE = /^rr_live_[A-Za-z0-9_-]{32}$/;

const fail = (status: number, code: string, message: string) => ({
  ok: false as const,
  response: Response.json({ error: { code, message } }, { status, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }),
});

export async function authenticate(key: string, cost: number) {
  if (!billingEnabled()) return fail(503, "billing_unavailable", "Prepaid crypto credits are not enabled on this deployment yet.");
  if (!KEY_RE.test(key)) return fail(401, "invalid_key", "Invalid API key.");
  try {
    const r = await rpc<{ account_id: string; credits: number }>("bill_auth", { p_key_hash: hashKey(key), p_cost: cost });
    return { ok: true as const, accountId: r.account_id, credits: Number(r.credits) };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "insufficient_credits") return fail(402, "insufficient_credits", "Not enough credits. Top up with USDC: GET /api/v1/billing/info.");
    if (msg === "invalid_key") return fail(401, "invalid_key", "Invalid API key.");
    if (e instanceof StoreError) return fail(503, "billing_unavailable", "Billing is temporarily unavailable. Please retry.");
    throw e;
  }
}

export async function adjust(accountId: string, delta: number): Promise<number> {
  return Number(await rpc<number>("bill_adjust", { p_account: accountId, p_cost: delta }));
}
