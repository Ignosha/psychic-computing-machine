// Settlement Verify: "did I really get paid?" for merchants and exchanges accepting XRP or tokens.
// Catches partial payments (stated Amount far above what was delivered), counterfeit tokens (a well-known
// code from an unverified issuer), failed or unvalidated transactions, wrong destination or tag, and sanctioned senders.
import { randomUUID } from "node:crypto";
import { screenWallet } from "../sanctions/wallets";
import { rpc, XrplError } from "./client";
import { issuerPowers, looksLikeMajorAsset, readableCurrency, toCurrencyHex, verifyDomain } from "./issuer";

type Amt = string | { currency: string; issuer: string; value: string };
export type Expect = { to?: string; amount?: string; currency?: string; issuer?: string; destinationTag?: number };
type Finding = { id: string; severity: "fail" | "warn" | "pass"; message: string };

const TF_PARTIAL_PAYMENT = 0x00020000;
const fmt = (a: Amt) => (typeof a === "string" ? { currency: "XRP", issuer: null, value: (Number(a) / 1e6).toString() } : { currency: readableCurrency(a.currency), issuer: a.issuer, value: a.value });

export async function verifySettlement(hash: string, expect: Expect) {
  if (!/^[0-9A-Fa-f]{64}$/.test(hash)) throw new XrplError("tx must be a 64-character XRPL transaction hash.", "invalid_tx");
  const t = await rpc<Record<string, unknown> & { validated?: boolean; ledger_index?: number; tx_json?: Record<string, unknown>; meta?: { TransactionResult?: string; delivered_amount?: Amt } }>(
    "tx", { transaction: hash.toUpperCase(), binary: false });
  if (t.error === "txnNotFound") throw new XrplError("Transaction not found on the XRP Ledger.", "tx_not_found");
  if (t.error) throw new XrplError(`XRPL node error: ${t.error}`);
  const tx = (t.tx_json ?? t) as { Account?: string; Destination?: string; DestinationTag?: number; TransactionType?: string; Flags?: number; Amount?: Amt; DeliverMax?: Amt };
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  if (!t.validated) add({ id: "VALIDATED", severity: "fail", message: "Not in a validated ledger yet. It is not final and can still fail. Do not release goods." });
  else add({ id: "VALIDATED", severity: "pass", message: `Final: in validated ledger ${t.ledger_index}.` });
  const result = t.meta?.TransactionResult;
  if (result !== "tesSUCCESS") add({ id: "RESULT", severity: "fail", message: `The transaction did not succeed (${result ?? "unknown"}). Nothing was delivered.` });
  if (tx.TransactionType !== "Payment") add({ id: "TYPE", severity: "fail", message: `This is a ${tx.TransactionType}, not a Payment.` });

  const stated = tx.DeliverMax ?? tx.Amount;
  const delivered = t.meta?.delivered_amount;
  const d = delivered && delivered !== "unavailable" ? fmt(delivered) : null;
  const s = stated ? fmt(stated) : null;
  if (!d) add({ id: "DELIVERED", severity: "fail", message: "The ledger does not report the delivered amount for this transaction." });
  else if (s && (tx.Flags ?? 0) & TF_PARTIAL_PAYMENT) {
    const ratio = Number(d.value) / Number(s.value);
    add(ratio < 0.999
      ? { id: "PARTIAL_PAYMENT", severity: "fail", message: `Partial payment: the transaction states ${s.value} ${s.currency} but only ${d.value} ${d.currency} (${(ratio * 100).toFixed(4)}%) was delivered. Credit only the delivered amount.` }
      : { id: "PARTIAL_PAYMENT", severity: "warn", message: "Partial-payment flag set, but the full stated amount was delivered." });
  }

  // Expectations from the merchant.
  if (expect.to) add(tx.Destination === expect.to ? { id: "DESTINATION", severity: "pass", message: "Sent to the expected address." } : { id: "DESTINATION", severity: "fail", message: `Sent to ${tx.Destination}, not ${expect.to}.` });
  if (expect.destinationTag !== undefined) add(tx.DestinationTag === expect.destinationTag ? { id: "DESTINATION_TAG", severity: "pass", message: `Destination tag ${tx.DestinationTag} matches.` } : { id: "DESTINATION_TAG", severity: "fail", message: `Destination tag is ${tx.DestinationTag ?? "missing"}, expected ${expect.destinationTag}.` });
  if (d && expect.currency) {
    const wantXrp = expect.currency.toUpperCase() === "XRP";
    const curOk = wantXrp ? d.currency === "XRP" : d.currency !== "XRP" && toCurrencyHex(expect.currency) === toCurrencyHex(typeof delivered === "object" ? delivered.currency : "XRP");
    const issuerOk = wantXrp || !expect.issuer || d.issuer === expect.issuer;
    add(curOk && issuerOk ? { id: "ASSET", severity: "pass", message: `Paid in the expected asset (${d.currency}${d.issuer ? ` from ${d.issuer}` : ""}).` }
      : { id: "ASSET", severity: "fail", message: `Paid in ${d.currency}${d.issuer ? ` issued by ${d.issuer}` : ""}, not the expected ${expect.currency}${expect.issuer ? ` from ${expect.issuer}` : ""}.` });
  }
  if (d && expect.amount) add(Number(d.value) >= Number(expect.amount) ? { id: "AMOUNT", severity: "pass", message: `Delivered ${d.value} ${d.currency}, at least the expected ${expect.amount}.` } : { id: "AMOUNT", severity: "fail", message: `Delivered ${d.value} ${d.currency}, less than the expected ${expect.amount}.` });

  // Token authenticity: who issued what was actually delivered.
  let issuer = null;
  if (d?.issuer) {
    const powers = await issuerPowers(d.issuer);
    const identity = await verifyDomain(d.issuer, powers?.accountData?.Domain);
    issuer = { address: d.issuer, domain: identity.domain, identityStatus: identity.status, domainVerified: identity.verified, organization: identity.organization, identityNote: identity.reason, canClawback: powers?.canClawback ?? null, canFreeze: powers?.canFreeze ?? null };
    if (identity.status === "unreachable")
      add({ id: "ISSUER_UNCHECKED", severity: "warn", message: `Could not verify the issuer of ${d.currency} right now: ${identity.reason}` });
    else if (!identity.verified && looksLikeMajorAsset(d.currency))
      add({ id: "COUNTERFEIT_RISK", severity: "fail", message: `Delivered "${d.currency}" from an issuer that fails identity verification (${identity.reason}) Copies of well-known tokens are a common scam; treat this as not the real ${d.currency}.` });
    else if (!identity.verified) add({ id: "ISSUER_UNVERIFIED", severity: "warn", message: `The issuer of ${d.currency} is not identity-verified: ${identity.reason}` });
    else add({ id: "ISSUER_VERIFIED", severity: "pass", message: `${d.currency} issued by ${identity.organization ?? identity.domain}, verified through ${identity.domain}.` });
    if (powers?.canClawback) add({ id: "CLAWBACK", severity: "warn", message: "The issuer can claw this token back from you after receipt." });
  }

  // Sender sanctions.
  if (tx.Account) {
    const sc = screenWallet(tx.Account);
    if (sc.sanctioned) add({ id: "SANCTIONED_SENDER", severity: "fail", message: `The sender is on the OFAC sanctions list (${sc.matches.map((m) => m.name).join("; ")}). Do not credit; seek legal advice.` });
  }

  const verdict = findings.some((f) => f.severity === "fail") ? "not_settled" : findings.some((f) => f.severity === "warn") ? "settled_with_warnings" : "settled";
  return {
    verificationId: randomUUID(), checkedAt: new Date().toISOString(), tx: hash.toUpperCase(),
    verdict, findings,
    payment: { from: tx.Account ?? null, to: tx.Destination ?? null, destinationTag: tx.DestinationTag ?? null, statedAmount: s, deliveredAmount: d, ledgerIndex: t.ledger_index ?? null, validated: !!t.validated, result: result ?? null },
    issuer,
    rule: "Credit only deliveredAmount, never statedAmount. A verdict of settled requires a validated, successful payment with every expectation met.",
  };
}
