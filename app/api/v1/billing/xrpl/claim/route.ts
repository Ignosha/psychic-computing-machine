import { error, json, options } from "@/lib/api";
import { xrplBillingEnabled } from "@/lib/billing/accounts";
import { PaymentError } from "@/lib/billing/crypto";
import { verifyXrplPayment } from "@/lib/billing/xrpl";
import { rpc } from "@/lib/sanctions/store";
import { screenWallet } from "@/lib/sanctions/wallets";
import { XrplError } from "@/lib/xrpl/client";

export const maxDuration = 30;
export const OPTIONS = options;

// Body: {"txHash": "..."}. No key needed: the destination tag decides which account is credited.
export async function POST(req: Request) {
  if (!xrplBillingEnabled()) return error(503, "billing_unavailable", "XRP / RLUSD payments are not enabled on this deployment yet.");
  let body: { txHash?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"txHash": "..."}'); }
  const hash = String(body?.txHash ?? "").trim().toUpperCase();
  try {
    const p = await verifyXrplPayment(hash);
    const screen = screenWallet(p.from);
    if (screen.sanctioned) {
      console.error(`SANCTIONED PAYER: xrpl tx ${hash} from ${p.from} (${screen.matches.map((m) => m.name).join("; ")}). Not credited. Consult counsel about the received funds.`);
      return error(403, "sanctioned_payer", "Payments from this account cannot be accepted.");
    }
    if (p.credits <= 0n) return error(400, "amount_too_small", "That payment is smaller than the price of one credit.");
    const r = await rpc<{ account_id: string; credits: number }>("bill_claim_xrpl", {
      p_payment_id: `xrpl:${hash}`, p_tag: p.tag, p_tx: hash, p_from: p.from, p_usd_micros: p.usdMicros.toString(),
      p_credits: p.credits.toString(), p_currency: p.currency, p_amount_raw: p.amount,
    });
    return json({ data: {
      accountId: r.account_id, creditsAdded: Number(p.credits), creditsBalance: Number(r.credits),
      payment: { currency: p.currency, delivered: p.amount, usdValue: Number(p.usdMicros) / 1e6, xrpUsdPrice: p.xrpPrice, from: p.from, destinationTag: p.tag, ledgerIndex: p.ledgerIndex, explorer: `https://livenet.xrpl.org/transactions/${hash}` },
      note: "Credited from the amount actually delivered (meta.delivered_amount). XRP is valued at the XRP/RLUSD AMM pool price on the ledger.",
    } }, 200, { "Cache-Control": "no-store" });
  } catch (e) {
    if (e instanceof PaymentError) return error(e.status, e.code, e.message);
    if (e instanceof XrplError) return error(503, "xrpl_unavailable", e.message);
    const m = (e as Error).message;
    if (m === "already_claimed") return error(409, "already_claimed", "That transaction has already been claimed.");
    if (m === "unknown_tag") return error(404, "unknown_tag", "No account has that destination tag. Get yours from POST /api/v1/billing/xrpl/tag and contact support with this transaction hash.");
    console.error(e);
    return error(503, "billing_unavailable", "Billing is temporarily unavailable. Please retry.");
  }
}
