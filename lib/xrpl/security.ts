// Account security tools on live XRPL data (read-only):
//  - controlAudit: who can sign for an account, and whether that changed recently (takeover signal)
//  - inboxScan: address poisoning, phishing memos, dust spam and sanctioned senders in recent incoming payments
//  - trustlineAudit: reserve locked in removable trust lines, look-alike and risky token holdings
//  - escrowCalendar: upcoming escrow releases (supply unlocks) for an account
import { randomUUID } from "node:crypto";
import { screenWallet } from "../sanctions/wallets";
import { isClassicAddress, rpc, XrplError } from "./client";
import { issuerPowers, looksLikeMajorAsset, readableCurrency, verifyDomain } from "./issuer";

const RIPPLE_EPOCH = 946684800;
const rippleTime = (t?: number) => (typeof t === "number" ? new Date((t + RIPPLE_EPOCH) * 1000).toISOString() : null);
type Tx = { tx_json?: Record<string, unknown>; tx?: Record<string, unknown>; meta?: Record<string, unknown>; hash?: string; close_time_iso?: string; validated?: boolean };
const txOf = (t: Tx) => (t.tx_json ?? t.tx ?? {}) as Record<string, unknown> & { TransactionType?: string; Account?: string; Destination?: string; date?: number; Flags?: number; Memos?: { Memo: { MemoData?: string; MemoType?: string } }[] };
const when = (t: Tx) => t.close_time_iso ?? rippleTime(txOf(t).date as number | undefined);
const sanctioned = (a: unknown) => (typeof a === "string" && screenWallet(a).sanctioned ? screenWallet(a).matches.map((m) => m.name) : null);

export type Finding = { id: string; severity: "block" | "review" | "info"; message: string };
const verdictOf = (f: Finding[]) => (f.some((x) => x.severity === "block") ? "block" : f.some((x) => x.severity === "review") ? "review" : "clear");

function requireAddress(a: string) {
  if (!isClassicAddress(a)) throw new XrplError("address must be a valid XRPL classic address.", "invalid_address");
}

async function recentTx(address: string, limit = 400): Promise<Tx[] | null> {
  for (const l of [limit, 100]) {
    try {
      const r = await rpc<{ transactions?: Tx[] }>("account_tx", { account: address, ledger_index_min: -1, ledger_index_max: -1, forward: false, limit: l });
      if (Array.isArray(r.transactions)) return r.transactions;
      if (r.error === "actNotFound") return [];
    } catch { /* retry smaller */ }
  }
  return null;
}

// ---------- 1. Account Control Audit ----------
export async function controlAudit(address: string, recentDays = 30) {
  requireAddress(address);
  const [info, txs] = await Promise.all([
    rpc<{ account_data?: Record<string, unknown> & { signer_lists?: { SignerQuorum: number; SignerEntries: { SignerEntry: { Account: string; SignerWeight: number } }[] }[] }; account_flags?: Record<string, boolean>; signer_lists?: unknown[]; ledger_index?: number }>(
      "account_info", { account: address, ledger_index: "validated", signer_lists: true }),
    recentTx(address),
  ]);
  if (info.error === "actNotFound" || !info.account_data) throw new XrplError("No account exists at this address.", "not_found");
  const ad = info.account_data;
  const flags = info.account_flags ?? {};
  const lists = (ad.signer_lists ?? (info.signer_lists as typeof ad.signer_lists) ?? []);
  const signerList = lists[0] ? {
    quorum: lists[0].SignerQuorum,
    signers: lists[0].SignerEntries.map((e) => ({ account: e.SignerEntry.Account, weight: e.SignerEntry.SignerWeight })),
  } : null;
  const regularKey = typeof ad.RegularKey === "string" ? ad.RegularKey : null;
  const masterDisabled = Boolean(flags.disableMasterKey);

  const CONTROL_TYPES = new Set(["SetRegularKey", "SignerListSet"]);
  const changes = (txs ?? []).filter((t) => {
    const x = txOf(t);
    if (x.Account !== address) return false;
    if (CONTROL_TYPES.has(String(x.TransactionType))) return true;
    return x.TransactionType === "AccountSet" && (x.SetFlag === 4 || x.ClearFlag === 4); // asfDisableMaster
  }).map((t) => {
    const x = txOf(t);
    const what = x.TransactionType === "SetRegularKey" ? (x.RegularKey ? `Regular key set to ${x.RegularKey}` : "Regular key removed")
      : x.TransactionType === "SignerListSet" ? (Number(x.SignerQuorum) > 0 ? `Multi-signing set: quorum ${x.SignerQuorum} across ${(x.SignerEntries as unknown[] | undefined)?.length ?? 0} signers` : "Multi-signing removed")
      : x.SetFlag === 4 ? "Master key disabled" : "Master key re-enabled";
    return { type: x.TransactionType, change: what, date: when(t), tx: t.hash ?? (x.hash as string | undefined) ?? null };
  });

  const findings: Finding[] = [];
  const cutoff = Date.now() - recentDays * 864e5;
  const recent = changes.filter((c) => c.date && Date.parse(c.date) >= cutoff);
  if (recent.length) findings.push({ id: "RECENT_CONTROL_CHANGE", severity: "review", message: `Who controls this account changed ${recent.length} time(s) in the last ${recentDays} days (${recent.map((c) => c.change).join("; ")}). A recent key change is a common account-takeover signal: confirm with the owner through a separate channel before sending large amounts.` });
  if (txs === null) findings.push({ id: "HISTORY_NOT_CHECKED", severity: "review", message: "Recent transactions could not be read, so recent control changes were not checked. Retry shortly." });
  for (const a of [regularKey, ...(signerList?.signers.map((s) => s.account) ?? [])]) {
    const hit = sanctioned(a);
    if (hit) findings.push({ id: "SANCTIONED_SIGNER", severity: "block", message: `A key that can sign for this account (${a}) belongs to a sanctioned party (${hit.join("; ")}).` });
  }
  const blackholed = masterDisabled && !regularKey && !signerList;
  if (blackholed) findings.push({ id: "BLACKHOLED", severity: "info", message: "Nobody can sign for this account any more (master key disabled, no regular key, no signers). Anything sent here can never be moved out." });
  else if (!masterDisabled && regularKey) findings.push({ id: "TWO_KEYS", severity: "info", message: "Both the master key and a regular key can sign: two separate keys can move funds." });
  else if (!masterDisabled && !regularKey && !signerList) findings.push({ id: "SINGLE_KEY", severity: "info", message: "A single master key controls this account." });
  if (signerList) {
    const total = signerList.signers.reduce((s, x) => s + x.weight, 0);
    const maxOne = Math.max(...signerList.signers.map((x) => x.weight));
    if (maxOne >= signerList.quorum) findings.push({ id: "MULTISIG_SINGLE_SIGNER", severity: "info", message: `Multi-signing is set, but one signer alone (weight ${maxOne}) meets the quorum of ${signerList.quorum}.` });
    else findings.push({ id: "MULTISIG", severity: "info", message: `Multi-signing requires weight ${signerList.quorum} of ${total} across ${signerList.signers.length} signers.` });
  }
  return {
    auditId: randomUUID(), checkedAt: new Date().toISOString(), address, validatedLedgerIndex: info.ledger_index ?? null,
    verdict: verdictOf(findings), findings,
    control: { masterKeyDisabled: masterDisabled, regularKey, signerList, blackholed },
    controlChanges: changes, historyScanned: txs?.length ?? null,
    note: `Control changes are read from the account's most recent ${txs?.length ?? 0} transactions.`,
  };
}

// ---------- 2. Inbox Threat Scan ----------
const urlIn = (hex?: string) => {
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) return null;
  const text = Buffer.from(hex, "hex").toString("utf8");
  const m = text.match(/\b((?:https?:\/\/|www\.)[^\s"'<>]+|[a-z0-9-]+\.(?:com|io|net|org|xyz|app|finance|site|online|live|link|top|claim|gift)\b[^\s"'<>]*)/i);
  return m ? { url: m[1].slice(0, 120), text: text.slice(0, 160) } : null;
};
const lookalike = (a: string, b: string) => a !== b && a.slice(1, 5) === b.slice(1, 5) && a.slice(-4) === b.slice(-4);

export async function inboxScan(address: string) {
  requireAddress(address);
  const txs = await recentTx(address);
  if (txs === null) throw new XrplError("Recent transactions could not be read from the public XRPL nodes. Retry shortly.");
  const paidTo = new Set<string>();
  for (const t of txs) { const x = txOf(t); if (x.TransactionType === "Payment" && x.Account === address && typeof x.Destination === "string") paidTo.add(x.Destination); }

  const poisoning: { from: string; imitates: string; tx: string | null; date: string | null }[] = [];
  const phishing: { from: string; url: string; memo: string; tx: string | null; date: string | null }[] = [];
  const dust: { from: string; amount: string; tx: string | null }[] = [];
  const sanctionedSenders: { from: string; names: string[]; tx: string | null }[] = [];
  let incoming = 0;
  for (const t of txs) {
    const x = txOf(t);
    if (x.Destination !== address || x.Account === address) continue;
    incoming++;
    const from = String(x.Account), hash = t.hash ?? (x.hash as string | undefined) ?? null;
    const twin = [...paidTo].find((p) => lookalike(from, p));
    if (twin) poisoning.push({ from, imitates: twin, tx: hash, date: when(t) });
    for (const m of x.Memos ?? []) { const u = urlIn(m.Memo?.MemoData); if (u) { phishing.push({ from, url: u.url, memo: u.text, tx: hash, date: when(t) }); break; } }
    const d = (t.meta as { delivered_amount?: unknown } | undefined)?.delivered_amount;
    if (x.TransactionType === "Payment" && typeof d === "string" && Number(d) <= 10_000) dust.push({ from, amount: `${Number(d) / 1e6} XRP`, tx: hash });
    const hit = sanctioned(from);
    if (hit) sanctionedSenders.push({ from, names: hit, tx: hash });
  }
  const findings: Finding[] = [];
  if (sanctionedSenders.length) findings.push({ id: "SANCTIONED_SENDER", severity: "block", message: `${sanctionedSenders.length} incoming transaction(s) came from OFAC-listed addresses. Seek legal advice before using those funds.` });
  if (poisoning.length) findings.push({ id: "ADDRESS_POISONING", severity: "review", message: `${poisoning.length} incoming transaction(s) came from addresses that imitate ones you have paid (same first and last characters). Never copy a recipient from your history: these are address-poisoning attempts.` });
  if (phishing.length) findings.push({ id: "PHISHING_MEMO", severity: "review", message: `${phishing.length} incoming transaction(s) carry links in their memo (${[...new Set(phishing.map((p) => p.url))].slice(0, 3).join(", ")}). Unsolicited links in memos are a common phishing lure: do not visit them or connect a wallet.` });
  if (dust.length >= 3) findings.push({ id: "DUST_SPAM", severity: "info", message: `${dust.length} tiny incoming XRP payments (0.01 XRP or less): usually spam or the delivery vehicle for poisoning and phishing.` });
  return {
    scanId: randomUUID(), checkedAt: new Date().toISOString(), address,
    verdict: verdictOf(findings), findings,
    scanned: { transactions: txs.length, incoming, knownRecipients: paidTo.size },
    addressPoisoning: poisoning.slice(0, 50), phishingMemos: phishing.slice(0, 50), dust: dust.slice(0, 50), sanctionedSenders,
    note: `Scans the most recent ${txs.length} transactions. A look-alike is an address sharing the first four and last four characters (after the leading r) with an address this account has paid.`,
  };
}

// ---------- 3. Trust Line Audit & Reserve Recovery ----------
type Line = { account: string; balance: string; currency: string; limit: string; limit_peer: string; freeze?: boolean; freeze_peer?: boolean; no_ripple?: boolean };

export async function trustlineAudit(address: string) {
  requireAddress(address);
  const lines: Line[] = [];
  let marker: unknown, truncated = false;
  for (let page = 0; page < 10; page++) {
    const r = await rpc<{ lines?: Line[]; marker?: unknown }>("account_lines", { account: address, ledger_index: "validated", limit: 400, ...(marker ? { marker } : {}) });
    if (r.error === "actNotFound") throw new XrplError("No account exists at this address.", "not_found");
    lines.push(...(r.lines ?? []));
    marker = r.marker;
    if (!marker) break;
    if (page === 9) truncated = true;
  }
  const [state, info] = await Promise.all([
    rpc<{ state?: { validated_ledger?: { reserve_inc: number; seq: number } } }>("server_state", {}),
    rpc<{ account_data?: { Balance: string; OwnerCount: number } }>("account_info", { account: address, ledger_index: "validated" }),
  ]);
  const inc = (state.state?.validated_ledger?.reserve_inc ?? 200_000) / 1e6;
  // A zero-balance line this account trusts can be removed (set the limit to 0) to release its owner reserve.
  const removable = lines.filter((l) => Number(l.balance) === 0 && Number(l.limit) > 0);
  const held = lines.filter((l) => Number(l.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance));
  const toCheck = [...new Set(held.map((l) => l.account))].slice(0, 12);
  const issuers = new Map(await Promise.all(toCheck.map(async (iss) => {
    const p = await issuerPowers(iss).catch(() => null);
    const id = p ? await verifyDomain(iss, p.accountData.Domain) : null;
    return [iss, { canClawback: p?.canClawback ?? null, globallyFrozen: p?.globallyFrozen ?? null, identity: id?.status ?? "unknown", organization: id?.organization ?? null, sanctioned: sanctioned(iss) }] as const;
  })));
  const holdings = held.map((l) => {
    const i = issuers.get(l.account);
    const code = readableCurrency(l.currency);
    const flags: string[] = [];
    if (i?.sanctioned) flags.push("issuer_sanctioned");
    if (l.freeze_peer || i?.globallyFrozen) flags.push("frozen");
    if (i && (i.identity === "not_listed" || i.identity === "no_domain") && looksLikeMajorAsset(code)) flags.push("lookalike_of_major_asset");
    if (i?.canClawback) flags.push("issuer_can_claw_back");
    return { currency: code, issuer: l.account, balance: l.balance, issuerVerified: i ? i.identity === "verified" : null, issuerName: i?.organization ?? null, flags };
  });
  const findings: Finding[] = [];
  const bad = holdings.filter((h) => h.flags.includes("issuer_sanctioned"));
  if (bad.length) findings.push({ id: "SANCTIONED_ISSUER", severity: "block", message: `Holds tokens from ${bad.length} OFAC-listed issuer(s).` });
  const fakes = holdings.filter((h) => h.flags.includes("lookalike_of_major_asset"));
  if (fakes.length) findings.push({ id: "LOOKALIKE_TOKENS", severity: "review", message: `Holds ${fakes.length} token(s) named like a major asset (${fakes.map((f) => f.currency).join(", ")}) from issuers that fail identity verification. They are very likely not the real thing.` });
  const frozen = holdings.filter((h) => h.flags.includes("frozen"));
  if (frozen.length) findings.push({ id: "FROZEN_HOLDINGS", severity: "review", message: `${frozen.length} holding(s) are frozen by their issuer and cannot move.` });
  if (removable.length) findings.push({ id: "RESERVE_RECOVERABLE", severity: "info", message: `${removable.length} empty trust line(s) can be removed to release up to ${(removable.length * inc).toLocaleString()} XRP of reserve.` });
  return {
    auditId: randomUUID(), checkedAt: new Date().toISOString(), address, validatedLedgerIndex: state.state?.validated_ledger?.seq ?? null,
    verdict: verdictOf(findings), findings,
    summary: { trustLines: lines.length, truncated, holdingsWithBalance: held.length, removableEmptyLines: removable.length, reserveRecoverableXrp: removable.length * inc, ownerCount: info.account_data?.OwnerCount ?? null, xrpBalance: info.account_data ? Number(info.account_data.Balance) / 1e6 : null },
    holdings: holdings.slice(0, 100),
    removable: removable.slice(0, 200).map((l) => ({ currency: readableCurrency(l.currency), issuer: l.account, limit: l.limit })),
    note: `Issuer checks cover the ${toCheck.length} issuers of your largest holdings. Removing a line means sending a TrustSet with limit 0; the reserve is released once the line returns to its default state.`,
  };
}

// ---------- 4. Escrow Unlock Calendar ----------
type Escrow = { Account: string; Destination: string; Amount: string | { currency: string; issuer: string; value: string }; FinishAfter?: number; CancelAfter?: number; Condition?: string; index?: string };

export async function escrowCalendar(address: string) {
  requireAddress(address);
  const objs: Escrow[] = [];
  let marker: unknown;
  for (let page = 0; page < 10; page++) {
    const r = await rpc<{ account_objects?: Escrow[]; marker?: unknown; ledger_index?: number }>("account_objects", { account: address, type: "escrow", ledger_index: "validated", limit: 400, ...(marker ? { marker } : {}) });
    if (r.error === "actNotFound") throw new XrplError("No account exists at this address.", "not_found");
    objs.push(...(r.account_objects ?? []));
    marker = r.marker;
    if (!marker) break;
  }
  const now = Date.now();
  const rows = objs.map((o) => {
    const amt = typeof o.Amount === "string" ? { currency: "XRP", value: Number(o.Amount) / 1e6, issuer: null } : { currency: readableCurrency(o.Amount.currency), value: Number(o.Amount.value), issuer: o.Amount.issuer };
    const finish = rippleTime(o.FinishAfter), cancel = rippleTime(o.CancelAfter);
    return {
      role: o.Account === address ? "source" : "destination", from: o.Account, to: o.Destination, amount: amt,
      releasableFrom: finish, expiresAt: cancel, conditional: Boolean(o.Condition),
      releasableNow: !o.Condition && (!finish || Date.parse(finish) <= now) && (!cancel || Date.parse(cancel) > now),
    };
  }).sort((a, b) => (a.releasableFrom ?? "").localeCompare(b.releasableFrom ?? ""));
  const xrp = rows.filter((r) => r.amount.currency === "XRP");
  const byMonth: Record<string, number> = {};
  for (const r of xrp) if (r.releasableFrom && Date.parse(r.releasableFrom) > now) {
    const m = r.releasableFrom.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + r.amount.value;
  }
  const next = rows.find((r) => r.releasableFrom && Date.parse(r.releasableFrom) > now) ?? null;
  return {
    calendarId: randomUUID(), checkedAt: new Date().toISOString(), address,
    summary: {
      escrows: rows.length, totalXrpLocked: xrp.reduce((s, r) => s + r.amount.value, 0),
      releasableNowXrp: xrp.filter((r) => r.releasableNow).reduce((s, r) => s + r.amount.value, 0),
      nextRelease: next ? { date: next.releasableFrom, amount: next.amount } : null,
    },
    upcomingXrpByMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(0, 24).map(([month, xrp]) => ({ month, xrp })),
    escrows: rows.slice(0, 500),
    note: "Releasable means the ledger would accept an EscrowFinish now (time-based escrows only); whether and when the owner releases it is up to them. Conditional escrows need a crypto-condition fulfillment.",
  };
}
