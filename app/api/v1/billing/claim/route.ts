import { error, json, options } from "@/lib/api";
import { authenticate, billingEnabled, hashKey, newApiKey } from "@/lib/billing/accounts";
import { CHAINS, claimMessage, creditsFor, isChain, PaymentError, verifyClaimSignature, verifyPayment } from "@/lib/billing/crypto";
import { rpc } from "@/lib/sanctions/store";
import { screenWallet } from "@/lib/sanctions/wallets";

export const maxDuration = 30;
export const OPTIONS = options;

// Body: {"chain": "base", "txHash": "0x...", "signature": "0x..."}; optional X-API-Key header to top up an existing account.
export async function POST(req: Request) {
  if (!billingEnabled()) return error(503, "billing_unavailable", "Prepaid crypto credits are not enabled on this deployment yet.");
  let body: { chain?: unknown; txHash?: unknown; signature?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"chain": "base", "txHash": "0x...", "signature": "0x..."}'); }
  const { chain, txHash, signature } = body ?? {};
  if (!isChain(chain)) return error(400, "invalid_chain", `chain must be one of: ${Object.keys(CHAINS).join(", ")}.`);
  if (typeof txHash !== "string" || typeof signature !== "string") return error(400, "invalid_params", "txHash and signature are required strings.");

  let accountId: string | null = null;
  const key = req.headers.get("x-api-key");
  if (key) {
    const auth = await authenticate(key, 0);
    if (!auth.ok) return auth.response;
    accountId = auth.accountId;
  }

  try {
    const pay = await verifyPayment(chain, txHash);
    // Never accept money from a sanctioned wallet.
    const screen = screenWallet(pay.from);
    if (screen.sanctioned) {
      console.error(`SANCTIONED PAYER: ${chain} tx ${txHash} from ${pay.from} (${screen.matches.map((m) => m.name).join("; ")}). Not credited. Consult counsel about the received funds.`);
      return error(403, "sanctioned_payer", "Payments from this wallet cannot be accepted.");
    }
    if (!(await verifyClaimSignature(chain, pay.from, claimMessage(chain, txHash, accountId), signature)))
      return error(403, "invalid_signature", `Signature must be made by the paying wallet (${pay.from}) over: ${JSON.stringify(claimMessage(chain, txHash, accountId))}`);
    const credits = creditsFor(pay.amountMicros);
    if (credits <= 0n) return error(400, "amount_too_small", "That payment is smaller than the price of one credit.");

    const apiKey = accountId ? null : newApiKey();
    const r = await rpc<{ account_id: string; credits: number; created: boolean }>("bill_claim", {
      p_payment_id: `${chain}:${txHash.toLowerCase()}`, p_chain: chain, p_tx: txHash.toLowerCase(), p_from: pay.from,
      p_amount: pay.amountMicros.toString(), p_credits: credits.toString(), p_account: accountId, p_new_key_hash: apiKey ? hashKey(apiKey) : null,
    });
    return json({
      data: {
        ...(apiKey ? { apiKey, apiKeyNote: "Store this key now; it is not shown again. Send it as the X-API-Key header." } : {}),
        accountId: r.account_id,
        creditsAdded: Number(credits),
        creditsBalance: Number(r.credits),
        payment: { chain, txHash: txHash.toLowerCase(), from: pay.from, amountUsdc: Number(pay.amountMicros) / 1e6, confirmations: pay.confirmations, explorer: CHAINS[chain].explorer + txHash },
      },
    });
  } catch (e) {
    if (e instanceof PaymentError) return error(e.status, e.code, e.message);
    if ((e as Error).message === "already_claimed") return error(409, "already_claimed", "That transaction has already been claimed.");
    console.error(e);
    return error(503, "billing_unavailable", "Billing is temporarily unavailable. Please retry.");
  }
}
