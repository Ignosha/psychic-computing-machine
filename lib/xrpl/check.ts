// XRPL Counterparty Check: one verdict on whether to send to, or accept funds from, an XRP Ledger account.
// Combines OFAC sanctions (this project), live ledger state (public XRPL nodes) and, for token issuers,
// NOSHASHI's issuer authority certificate. Read-only; every fact names the ledger it was read at.
import { randomUUID } from "node:crypto";
import { loadDb } from "../sanctions/match";
import { screenWallet } from "../sanctions/wallets";
import { decodeCurrency, isClassicAddress, rpc, XrplError } from "./client";

const NOSHASHI = (process.env.NOSHASHI_URL || "https://www.noshashi.app").replace(/\/$/, "");
const RECENT_TX = 200;

type Tx = { tx_json?: Record<string, unknown>; tx?: Record<string, unknown>; meta?: { TransactionResult?: string }; close_time_iso?: string; hash?: string; validated?: boolean };
const txOf = (t: Tx) => (t.tx_json ?? t.tx ?? {}) as Record<string, unknown> & { Account?: string; Destination?: string; TransactionType?: string; date?: number };
const RIPPLE_EPOCH = 946684800;
const isoDate = (t: Tx) => t.close_time_iso ?? (typeof txOf(t).date === "number" ? new Date((Number(txOf(t).date) + RIPPLE_EPOCH) * 1000).toISOString() : null);

// Busy accounts can time out on a large page; retry smaller before giving up.
async function recentTransactions(address: string): Promise<{ transactions?: Tx[]; error?: string }> {
  for (const limit of [RECENT_TX, 50]) {
    try {
      const r = await rpc<{ transactions?: Tx[] }>("account_tx", { account: address, ledger_index_min: -1, ledger_index_max: -1, forward: false, limit });
      if (Array.isArray(r.transactions)) return r;
      if (r.error === "actNotFound") return { transactions: [] };
    } catch { /* try smaller */ }
  }
  return { transactions: undefined, error: "unavailable" };
}

export type Finding = { code: string; severity: "block" | "review" | "info"; message: string };

async function noshashiCertificate(issuer: string) {
  try {
    const res = await fetch(`${NOSHASHI}/api/authority?issuer=${issuer}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) return { available: false as const, reason: `NOSHASHI returned HTTP ${res.status}` };
    const c = (await res.json()) as { verdict: string; checks: { id: string; label: string; severity: string; passed: boolean; detail: string }[]; digest: string; ledgerIndex: number; evaluatedAt: string; rulesVersion: number };
    return {
      available: true as const, verdict: c.verdict, digest: c.digest, ledgerIndex: c.ledgerIndex, evaluatedAt: c.evaluatedAt, rulesVersion: c.rulesVersion,
      checks: c.checks.map(({ id, label, severity, passed, detail }) => ({ id, label, severity, passed, detail })),
      verifyUrl: `${NOSHASHI}/certificate/?issuer=${issuer}`,
    };
  } catch (e) {
    return { available: false as const, reason: `NOSHASHI unreachable: ${(e as Error).message}` };
  }
}

const sanctionedHit = (addr: string) => {
  const r = screenWallet(addr);
  return r.sanctioned ? r.matches.map((m) => ({ address: addr, name: m.name, source: m.source, programs: m.programs })) : [];
};

export async function checkCounterparty(address: string) {
  if (!isClassicAddress(address)) throw new XrplError("address must be a valid XRPL classic address (starts with r, checksum must match).", "invalid_address");

  const [info, firstTx, recent, gateway] = await Promise.all([
    rpc<{ account_data?: Record<string, unknown>; account_flags?: Record<string, boolean>; ledger_index?: number }>("account_info", { account: address, ledger_index: "validated" }),
    rpc<{ transactions?: Tx[] }>("account_tx", { account: address, ledger_index_min: -1, ledger_index_max: -1, forward: true, limit: 1 }).catch(() => ({ transactions: undefined, error: "unavailable" })),
    recentTransactions(address),
    rpc<{ obligations?: Record<string, string> }>("gateway_balances", { account: address, ledger_index: "validated", strict: true }).catch(() => ({ obligations: undefined, error: "unavailable" })),
  ]);

  const findings: Finding[] = [];
  const exists = !info.error && !!info.account_data;
  if (info.error && info.error !== "actNotFound") throw new XrplError(`XRPL node error: ${info.error}`);

  // 1. Direct OFAC listing.
  const direct = sanctionedHit(address);
  if (direct.length) findings.push({ code: "SANCTIONED_ADDRESS", severity: "block", message: `This address is on the OFAC sanctions list (${direct.map((d) => d.name).join("; ")}).` });

  // 2. Who funded (activated) the account.
  const first = firstTx.transactions?.[0];
  const ft = first ? txOf(first) : null;
  const funding = ft && ft.TransactionType === "Payment" && ft.Destination === address && ft.Account
    ? { fundedBy: ft.Account, txHash: first!.hash ?? (ft.hash as string) ?? null, date: isoDate(first!) } : null;
  const fundingHits = funding ? sanctionedHit(funding.fundedBy) : [];
  if (fundingHits.length) findings.push({ code: "FUNDED_BY_SANCTIONED", severity: "block", message: `This account was activated by a sanctioned address (${fundingHits[0].name}).` });

  // 3. Direct exposure: counterparties in the most recent transactions.
  const counterparties = new Set<string>();
  for (const t of recent.transactions ?? []) {
    const x = txOf(t);
    for (const a of [x.Account, x.Destination]) if (typeof a === "string" && a !== address) counterparties.add(a);
  }
  const exposure = [...counterparties].flatMap(sanctionedHit);
  // Never report "clear" for a check that could not run.
  if (!recent.transactions) findings.push({ code: "EXPOSURE_NOT_CHECKED", severity: "review", message: "Recent transactions could not be read from the public XRPL nodes, so direct counterparty exposure was not checked. Retry shortly." });
  if (exists && !firstTx.transactions) findings.push({ code: "FUNDING_NOT_CHECKED", severity: "review", message: "The account's funding transaction could not be read, so its funding source was not screened. Retry shortly." });
  if (exposure.length) findings.push({ code: "TRANSACTED_WITH_SANCTIONED", severity: "block", message: `Among the last ${recent.transactions?.length ?? 0} transactions, this account dealt directly with ${exposure.length} sanctioned address(es).` });

  // 4. Ledger state that affects sending to or holding from this account.
  const flags = info.account_flags ?? {};
  const ad = info.account_data ?? {};
  if (!exists) findings.push({ code: "ACCOUNT_NOT_ACTIVATED", severity: "review", message: "No account exists at this address yet. A first payment must meet the XRP reserve or it fails." });
  if (flags.requireDestinationTag) findings.push({ code: "DESTINATION_TAG_REQUIRED", severity: "info", message: "Payments to this account must include a destination tag (typical for exchanges)." });
  if (flags.depositAuth) findings.push({ code: "DEPOSIT_AUTH", severity: "info", message: "This account only accepts payments from senders it has preauthorized." });
  if (flags.disallowIncomingXRP) findings.push({ code: "XRP_DISALLOWED", severity: "info", message: "This account asks not to receive XRP." });
  if (flags.globalFreeze) findings.push({ code: "GLOBAL_FREEZE", severity: "review", message: "This issuer has frozen all of its issued tokens right now." });

  // 5. Token issuers: NOSHASHI's authority certificate.
  const obligations = gateway.obligations && Object.keys(gateway.obligations).length
    ? Object.fromEntries(Object.entries(gateway.obligations).map(([c, v]) => [decodeCurrency(c), v])) : null;
  const certificate = obligations ? await noshashiCertificate(address) : null;
  if (obligations) {
    if (flags.allowTrustLineClawback) findings.push({ code: "CLAWBACK_ENABLED", severity: "review", message: "This issuer can claw back its tokens from holders." });
    if (certificate?.available && certificate.verdict !== "go")
      findings.push({ code: "ISSUER_AUTHORITY", severity: "review", message: `NOSHASHI issuer authority verdict: ${certificate.verdict.toUpperCase()} (${certificate.checks.filter((c) => !c.passed).map((c) => c.label).join("; ") || "see checks"}).` });
  }

  const verdict = findings.some((f) => f.severity === "block") ? "block" : findings.some((f) => f.severity === "review") ? "review" : "clear";
  return {
    checkId: randomUUID(),
    checkedAt: new Date().toISOString(),
    address,
    verdict,
    findings,
    sanctions: {
      listed: direct.length > 0, matches: direct,
      fundedBy: funding ? { ...funding, sanctioned: fundingHits.length > 0, matches: fundingHits } : null,
      recentCounterparties: { transactionsScanned: recent.transactions?.length ?? null, uniqueCounterparties: counterparties.size, sanctioned: exposure },
      listsVersion: loadDb().generatedAt,
    },
    ledger: {
      exists,
      validatedLedgerIndex: info.ledger_index ?? null,
      xrpBalance: exists ? Number(ad.Balance) / 1e6 : 0,
      domain: typeof ad.Domain === "string" ? Buffer.from(ad.Domain, "hex").toString("utf8") : null,
      regularKeySet: typeof ad.RegularKey === "string",
      flags,
    },
    issuer: obligations ? { tokensIssued: obligations, noshashiCertificate: certificate } : null,
    coverage: "Sanctions: exact match of this address, its funding account and its direct counterparties in the most recent transactions against every XRP address on the OFAC SDN list. Not multi-hop tracing. Ledger facts read from public XRPL nodes at the stated validated ledger. Issuer authority by NOSHASHI.",
  };
}
