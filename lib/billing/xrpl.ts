// XRP / RLUSD payment verification on the XRP Ledger. Credits use meta.delivered_amount, never the
// transaction's stated Amount: a "partial payment" can succeed while delivering a tiny fraction of Amount.
import { isClassicAddress, rpc, RLUSD } from "../xrpl/client";
import { CREDIT_PRICE_MICROS, PaymentError } from "./crypto";

const raw = (process.env.XRPL_RECEIVING_ADDRESS || "").trim();
export const XRPL_RECEIVER = isClassicAddress(raw) ? raw : "";

// XRP/USD from the XRP/RLUSD automated market maker pool on the ledger itself (no outside price feed).
export async function xrpUsdPrice(): Promise<{ price: number; ledgerIndex: number }> {
  const r = await rpc<{ amm?: { amount: string; amount2: { value: string } }; ledger_index?: number }>("amm_info", {
    asset: { currency: "XRP" }, asset2: RLUSD, ledger_index: "validated",
  });
  if (!r.amm) throw new PaymentError("price_unavailable", "Could not read the XRP/RLUSD price from the ledger. Retry shortly.", 503);
  const xrp = Number(r.amm.amount) / 1e6, usd = Number(r.amm.amount2.value);
  if (!(xrp > 0 && usd > 0)) throw new PaymentError("price_unavailable", "The XRP/RLUSD pool returned no price.", 503);
  return { price: usd / xrp, ledgerIndex: r.ledger_index ?? 0 };
}

export type XrplPayment = { from: string; tag: number; currency: "XRP" | "RLUSD"; amount: string; usdMicros: bigint; credits: bigint; xrpPrice: number | null; ledgerIndex: number };

export async function verifyXrplPayment(hash: string): Promise<XrplPayment> {
  if (!/^[0-9A-Fa-f]{64}$/.test(hash)) throw new PaymentError("invalid_tx", "txHash must be a 64-character XRPL transaction hash.");
  const t = await rpc<{
    validated?: boolean; ledger_index?: number; Account?: string; Destination?: string; DestinationTag?: number; TransactionType?: string;
    tx_json?: Record<string, unknown>; meta?: { TransactionResult?: string; delivered_amount?: string | { currency: string; issuer: string; value: string } };
  }>("tx", { transaction: hash.toUpperCase(), binary: false });
  if (t.error === "txnNotFound") throw new PaymentError("tx_not_found", "Transaction not found on the XRP Ledger yet. Retry in a few seconds.", 404);
  if (t.error) throw new PaymentError("rpc_unavailable", `XRPL node error: ${t.error}`, 503);
  const tx = (t.tx_json ?? t) as { Account?: string; Destination?: string; DestinationTag?: number; TransactionType?: string };
  if (!t.validated) throw new PaymentError("not_confirmed", "Transaction is not in a validated ledger yet. Retry in a few seconds.", 409);
  if (t.meta?.TransactionResult !== "tesSUCCESS") throw new PaymentError("tx_failed", `Transaction did not succeed (${t.meta?.TransactionResult ?? "unknown"}).`);
  if (tx.TransactionType !== "Payment") throw new PaymentError("not_a_payment", "That transaction is not a Payment.");
  if (tx.Destination !== XRPL_RECEIVER) throw new PaymentError("wrong_destination", `That payment was not sent to ${XRPL_RECEIVER}.`);
  if (typeof tx.DestinationTag !== "number") throw new PaymentError("missing_tag", "That payment has no destination tag, so it can't be matched to an account. Contact support with the transaction hash.");

  const delivered = t.meta.delivered_amount;
  let currency: "XRP" | "RLUSD", amount: string, usdMicros: bigint, xrpPrice: number | null = null;
  if (typeof delivered === "string") {
    currency = "XRP";
    amount = (Number(delivered) / 1e6).toString();
    xrpPrice = (await xrpUsdPrice()).price;
    usdMicros = BigInt(Math.floor((Number(delivered) / 1e6) * xrpPrice * 1e6));
  } else if (delivered && delivered.currency === RLUSD.currency && delivered.issuer === RLUSD.issuer) {
    currency = "RLUSD";
    amount = delivered.value;
    usdMicros = BigInt(Math.floor(Number(delivered.value) * 1e6));
  } else {
    throw new PaymentError("unsupported_currency", "Only XRP and RLUSD (issued by Ripple, rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De) are accepted.");
  }
  return { from: tx.Account!, tag: tx.DestinationTag, currency, amount, usdMicros, credits: usdMicros / CREDIT_PRICE_MICROS, xrpPrice, ledgerIndex: t.ledger_index ?? 0 };
}
