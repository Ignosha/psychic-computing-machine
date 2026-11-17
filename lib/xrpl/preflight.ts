// Payment Pre-flight: predicts whether an XRPL payment will succeed, before it is signed, and which ledger
// result code it would fail with. Prevents failed fees, stuck funds and payments to sanctioned parties.
import { randomUUID } from "node:crypto";
import { screenWallet } from "../sanctions/wallets";
import { isClassicAddress, rpc, XrplError } from "./client";
import { issuerPowers, readableCurrency, toCurrencyHex } from "./issuer";

export type PreflightInput = { to: string; amount: string; currency: string; issuer?: string; destinationTag?: number; from?: string };
type Check = { id: string; status: "pass" | "fail" | "warn"; message: string; ledgerResult?: string };
type Line = { account: string; balance: string; currency: string; limit: string; freeze?: boolean; freeze_peer?: boolean; authorized?: boolean; peer_authorized?: boolean };

const FEE_XRP = 0.00001;

// account_lines filtered by peer still pages through the whole owner directory: a page can be empty with a
// marker while the line exists further on. Follow markers before concluding "no trust line".
async function linesWith(account: string, peer: string): Promise<{ lines: Line[] }> {
  const lines: Line[] = [];
  let marker: unknown;
  for (let page = 0; page < 25; page++) {
    const r = await rpc<{ lines?: Line[]; marker?: unknown }>("account_lines", { account, peer, ledger_index: "validated", limit: 400, ...(marker ? { marker } : {}) });
    if (r.error === "actNotFound") break;
    lines.push(...(r.lines ?? []));
    if (!r.marker || lines.length) break;
    marker = r.marker;
  }
  return { lines };
}

export function parsePreflight(raw: Record<string, unknown>): PreflightInput | string {
  const to = String(raw.to ?? "").trim();
  if (!isClassicAddress(to)) return "to must be a valid XRPL classic address.";
  const from = raw.from == null || raw.from === "" ? undefined : String(raw.from).trim();
  if (from && !isClassicAddress(from)) return "from must be a valid XRPL classic address.";
  const amount = String(raw.amount ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) return "amount must be a positive number (in XRP for XRP, in token units for tokens).";
  const currency = String(raw.currency ?? "XRP").trim();
  const issuer = raw.issuer == null || raw.issuer === "" ? undefined : String(raw.issuer).trim();
  if (currency.toUpperCase() !== "XRP") {
    if (!issuer || !isClassicAddress(issuer)) return "issuer (a valid XRPL address) is required for token payments.";
    try { toCurrencyHex(currency); } catch { return "currency must be XRP, a 3-character code, a token name up to 20 characters, or a 40-character hex code."; }
  }
  const tag = raw.destinationTag == null || raw.destinationTag === "" ? undefined : Number(raw.destinationTag);
  if (tag !== undefined && !(Number.isInteger(tag) && tag >= 0 && tag <= 4294967295)) return "destinationTag must be an integer from 0 to 4294967295.";
  return { to, from, amount, currency: currency.toUpperCase() === "XRP" ? "XRP" : currency, issuer, destinationTag: tag };
}

export async function preflight(p: PreflightInput) {
  const isXrp = p.currency === "XRP";
  const cur = isXrp ? "XRP" : toCurrencyHex(p.currency);
  const amount = Number(p.amount);
  const [dest, state, destLines, powers, src, srcLines] = await Promise.all([
    rpc<{ account_data?: Record<string, unknown>; account_flags?: Record<string, boolean> }>("account_info", { account: p.to, ledger_index: "validated" }),
    rpc<{ state?: { validated_ledger?: { reserve_base: number; reserve_inc: number; seq: number } } }>("server_state", {}),
    isXrp ? null : linesWith(p.to, p.issuer!),
    isXrp ? null : issuerPowers(p.issuer!),
    p.from ? rpc<{ account_data?: Record<string, unknown> }>("account_info", { account: p.from, ledger_index: "validated" }) : null,
    p.from && !isXrp && p.from !== p.issuer ? linesWith(p.from, p.issuer!) : null,
  ]);
  const v = state.state?.validated_ledger;
  if (!v) throw new XrplError("Could not read network reserves from the XRPL nodes.");
  const base = v.reserve_base / 1e6, inc = v.reserve_inc / 1e6;
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const flags = dest.account_flags ?? {};
  const destExists = !!dest.account_data;

  // Sanctions first: a clean technical result is irrelevant if the counterparty is sanctioned.
  for (const [role, addr] of [["recipient", p.to], ["sender", p.from]] as const) {
    if (!addr) continue;
    const s = screenWallet(addr);
    add(s.sanctioned
      ? { id: `SANCTIONS_${role.toUpperCase()}`, status: "fail", message: `The ${role} is on the OFAC sanctions list (${s.matches.map((m) => m.name).join("; ")}). Do not send.` }
      : { id: `SANCTIONS_${role.toUpperCase()}`, status: "pass", message: `The ${role} is not on the OFAC sanctioned address list.` });
  }

  // Recipient account.
  if (!destExists) {
    if (!isXrp) add({ id: "DESTINATION_EXISTS", status: "fail", ledgerResult: "tecNO_DST", message: "The recipient account does not exist, so it cannot hold tokens." });
    else if (amount < base) add({ id: "DESTINATION_EXISTS", status: "fail", ledgerResult: "tecNO_DST_INSUF_XRP", message: `The recipient account does not exist. A payment that creates it must be at least ${base} XRP (the base reserve).` });
    else add({ id: "DESTINATION_EXISTS", status: "warn", message: `This payment will create a new account. ${base} XRP of it stays locked as the reserve.` });
  } else add({ id: "DESTINATION_EXISTS", status: "pass", message: "The recipient account exists." });

  if (flags.requireDestinationTag) add(p.destinationTag === undefined
    ? { id: "DESTINATION_TAG", status: "fail", ledgerResult: "tecDST_TAG_NEEDED", message: "The recipient requires a destination tag (typical for exchanges). Without it the payment is rejected, or worse, unattributable." }
    : { id: "DESTINATION_TAG", status: "pass", message: `Destination tag ${p.destinationTag} provided, as the recipient requires.` });

  if (flags.depositAuth) {
    if (!p.from) add({ id: "DEPOSIT_AUTH", status: "warn", message: "The recipient only accepts payments from preauthorized senders. Provide from to check." });
    else {
      const da = await rpc<{ deposit_authorized?: boolean }>("deposit_authorized", { source_account: p.from, destination_account: p.to, ledger_index: "validated" });
      add(da.deposit_authorized
        ? { id: "DEPOSIT_AUTH", status: "pass", message: "The sender is preauthorized by the recipient." }
        : { id: "DEPOSIT_AUTH", status: "fail", ledgerResult: "tecNO_PERMISSION", message: "The recipient only accepts payments from preauthorized senders, and this sender is not one." });
    }
  }
  if (isXrp && flags.disallowIncomingXRP) add({ id: "XRP_DISALLOWED", status: "warn", message: "The recipient has asked not to receive XRP. The ledger still allows it, but it may not be credited or returned." });

  // Tokens: trust line, limit, freezes, authorization, transfer fee.
  if (!isXrp && powers) {
    const line = destLines?.lines?.find((l) => toCurrencyHex(l.currency) === toCurrencyHex(cur));
    if (powers.globallyFrozen) add({ id: "ISSUER_GLOBAL_FREEZE", status: "fail", ledgerResult: "tecPATH_DRY", message: "The issuer has frozen all of this token right now. It cannot move." });
    if (p.to !== p.issuer) {
      if (!line) add({ id: "TRUST_LINE", status: "fail", ledgerResult: "tecPATH_DRY", message: `The recipient has no trust line for ${readableCurrency(cur)} from this issuer, so it cannot receive it.` });
      else {
        const headroom = Number(line.limit) - Number(line.balance);
        add(headroom >= amount
          ? { id: "TRUST_LINE", status: "pass", message: `The recipient trusts this token with room for ${headroom.toLocaleString()} more.` }
          : { id: "TRUST_LINE", status: "fail", ledgerResult: "tecPATH_PARTIAL", message: `The recipient's trust line only has room for ${headroom.toLocaleString()}; this payment is ${amount.toLocaleString()}.` });
        if (line.freeze_peer) add({ id: "LINE_FROZEN", status: "fail", ledgerResult: "tecPATH_DRY", message: "The issuer has frozen the recipient's trust line for this token." });
        if (powers.requiresAuthorization && !line.peer_authorized) add({ id: "LINE_AUTHORIZED", status: "fail", ledgerResult: "tecPATH_DRY", message: "This token requires issuer authorization, and the recipient's line is not authorized." });
      }
    }
    if (powers.transferFeePercent > 0) add({ id: "TRANSFER_FEE", status: "warn", message: `The issuer charges a ${powers.transferFeePercent}% transfer fee. Set SendMax at least ${(amount * (1 + powers.transferFeePercent / 100)).toLocaleString()} or the recipient gets less.` });
    if (powers.canClawback) add({ id: "CLAWBACK", status: "warn", message: "The issuer can claw this token back from holders after it is received." });
  } else if (!isXrp && !powers) add({ id: "ISSUER_EXISTS", status: "fail", ledgerResult: "tecNO_ISSUER", message: "The issuer account does not exist." });

  // Sender balance.
  if (p.from) {
    if (!src?.account_data) add({ id: "SENDER_EXISTS", status: "fail", ledgerResult: "terNO_ACCOUNT", message: "The sender account does not exist." });
    else {
      const bal = Number(src.account_data.Balance) / 1e6, owners = Number(src.account_data.OwnerCount ?? 0);
      const spendable = bal - base - inc * owners - FEE_XRP;
      if (isXrp) add(spendable >= amount
        ? { id: "SENDER_BALANCE", status: "pass", message: `The sender can spend ${spendable.toLocaleString()} XRP after reserves.` }
        : { id: "SENDER_BALANCE", status: "fail", ledgerResult: "tecUNFUNDED_PAYMENT", message: `The sender can only spend ${Math.max(0, spendable).toLocaleString()} XRP after its ${(base + inc * owners).toLocaleString()} XRP reserve.` });
      else if (p.from !== p.issuer) {
        const sl = srcLines?.lines?.find((l) => toCurrencyHex(l.currency) === toCurrencyHex(cur));
        const have = sl ? Number(sl.balance) : 0;
        add(have >= amount
          ? { id: "SENDER_BALANCE", status: "pass", message: `The sender holds ${have.toLocaleString()} ${readableCurrency(cur)}.` }
          : { id: "SENDER_BALANCE", status: "fail", ledgerResult: "tecPATH_PARTIAL", message: `The sender holds ${have.toLocaleString()} ${readableCurrency(cur)}; this payment is ${amount.toLocaleString()}.` });
        if (sl?.freeze_peer) add({ id: "SENDER_LINE_FROZEN", status: "fail", ledgerResult: "tecPATH_DRY", message: "The issuer has frozen the sender's trust line for this token." });
        if (spendable < 0) add({ id: "SENDER_FEE", status: "fail", ledgerResult: "terINSUF_FEE_B", message: "The sender has no XRP above its reserve to pay the transaction fee." });
      }
    }
  }

  const verdict = checks.some((c) => c.status === "fail") ? "will_fail" : checks.some((c) => c.status === "warn") ? "will_succeed_with_warnings" : "will_succeed";
  return {
    preflightId: randomUUID(), checkedAt: new Date().toISOString(), validatedLedgerIndex: v.seq,
    payment: { to: p.to, from: p.from ?? null, amount: p.amount, currency: isXrp ? "XRP" : readableCurrency(cur), issuer: p.issuer ?? null, destinationTag: p.destinationTag ?? null },
    verdict, checks,
    network: { baseReserveXrp: base, ownerReserveXrp: inc },
    note: "Prediction from the validated ledger at the stated index; state can change before you submit. Sanctions check covers direct OFAC listings; use /xrpl/check for funding source and counterparty exposure.",
  };
}
