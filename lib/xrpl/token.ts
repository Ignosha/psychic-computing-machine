// Token Risk Report: everything a trader, wallet or listing desk should know about an XRPL token before
// touching it, as one graded report. Issuer powers (ledger), identity (xrp-ledger.toml), authority
// (NOSHASHI certificate), liquidity (AMM pool and order book), supply, and sanctions on the issuer and its funder.
import { randomUUID } from "node:crypto";
import { screenWallet } from "../sanctions/wallets";
import { isClassicAddress, rpc, XrplError } from "./client";
import { issuerPowers, looksLikeMajorAsset, readableCurrency, toCurrencyHex, verifyDomain } from "./issuer";

const NOSHASHI = (process.env.NOSHASHI_URL || "https://www.noshashi.app").replace(/\/$/, "");

export const TOKEN_METHODOLOGY =
  "Starts at 100. Issuer can claw back: -25 (-10 if the issuer's identity is verified). Issuer can freeze: -15 (-5 if verified). Identity fails xrp-ledger.toml verification: -20 (-40 if the code copies a major asset such as USD or RLUSD); if the issuer's site could not be reached, no penalty and the report says so. Transfer fee above 1%: -10. Liquidity: no XRP AMM pool and no order book: -25; under 10,000 XRP of AMM depth: -10. NOSHASHI verdict hold: -10, no-go: -25. Issuer or its funding account on the OFAC list: score 0. Grades: A>=85, B>=70, C>=55, D>=40, else F.";

async function noshashi(issuer: string) {
  try {
    const r = await fetch(`${NOSHASHI}/api/authority?issuer=${issuer}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!r.ok) return null;
    const c = (await r.json()) as { verdict: string; digest: string; ledgerIndex: number; checks: { id: string; label: string; passed: boolean }[] };
    return { verdict: c.verdict, digest: c.digest, ledgerIndex: c.ledgerIndex, failedChecks: c.checks.filter((x) => !x.passed).map((x) => x.label), verifyUrl: `${NOSHASHI}/certificate/?issuer=${issuer}` };
  } catch {
    return null;
  }
}

export async function tokenReport(currency: string, issuer: string) {
  if (!isClassicAddress(issuer)) throw new XrplError("issuer must be a valid XRPL classic address.", "invalid_address");
  let cur: string;
  try { cur = toCurrencyHex(currency); } catch { throw new XrplError("currency must be a 3-character code, a name up to 20 characters, or a 40-character hex code.", "invalid_currency"); }
  if (cur.toUpperCase() === "XRP") throw new XrplError("XRP is the native asset and has no issuer.", "invalid_currency");
  const asset2 = { currency: cur, issuer };
  const [powers, gw, amm, asks, bids, first, cert] = await Promise.all([
    issuerPowers(issuer),
    rpc<{ obligations?: Record<string, string> }>("gateway_balances", { account: issuer, ledger_index: "validated", strict: true }).catch(() => ({ obligations: undefined })),
    rpc<{ amm?: { amount: string; amount2: { value: string }; trading_fee: number; lp_token: { value: string } } }>("amm_info", { asset: { currency: "XRP" }, asset2, ledger_index: "validated" }).catch(() => ({ amm: undefined })),
    rpc<{ offers?: { TakerGets: unknown; TakerPays: unknown }[] }>("book_offers", { taker_gets: asset2, taker_pays: { currency: "XRP" }, limit: 50, ledger_index: "validated" }).catch(() => ({ offers: undefined })),
    rpc<{ offers?: { TakerGets: unknown; TakerPays: unknown }[] }>("book_offers", { taker_gets: { currency: "XRP" }, taker_pays: asset2, limit: 50, ledger_index: "validated" }).catch(() => ({ offers: undefined })),
    rpc<{ transactions?: { tx_json?: Record<string, unknown>; tx?: Record<string, unknown> }[] }>("account_tx", { account: issuer, ledger_index_min: -1, ledger_index_max: -1, forward: true, limit: 1 }).catch(() => ({ transactions: undefined })),
    noshashi(issuer),
  ]);
  if (!powers) throw new XrplError("The issuer account does not exist.", "not_found");
  const code = readableCurrency(cur);
  const supply = gw.obligations ? Object.entries(gw.obligations).find(([c]) => toCurrencyHex(c) === cur)?.[1] ?? null : null;
  const identity = await verifyDomain(issuer, powers.accountData.Domain);

  const ft = first.transactions?.[0] ? (first.transactions[0].tx_json ?? first.transactions[0].tx) as { TransactionType?: string; Destination?: string; Account?: string } : null;
  const funder = ft && ft.TransactionType === "Payment" && ft.Destination === issuer ? ft.Account ?? null : null;
  const issuerHit = screenWallet(issuer), funderHit = funder ? screenWallet(funder) : null;
  const sanctioned = issuerHit.sanctioned || !!funderHit?.sanctioned;

  const ammXrp = amm.amm ? Number(amm.amm.amount) / 1e6 : 0;
  const ammTok = amm.amm ? Number(amm.amm.amount2.value) : 0;
  const offerCount = (asks.offers?.length ?? 0) + (bids.offers?.length ?? 0);

  const factors: { factor: string; points: number; detail: string }[] = [];
  const f = (factor: string, points: number, detail: string) => factors.push({ factor, points, detail });
  // A verified, identifiable issuer keeping freeze/clawback (typical of regulated stablecoins) is a disclosed
  // compliance control; the same powers in anonymous hands are a much larger risk.
  if (powers.canClawback) f("clawback", identity.verified ? -10 : -25, identity.verified ? "The issuer (identity verified) can claw tokens back, typically as a regulatory control." : "An unverified issuer can claw tokens back from holders.");
  if (powers.canFreeze) f("freeze", identity.verified ? -5 : -15, identity.verified ? "The issuer (identity verified) keeps the right to freeze holders." : "An unverified issuer keeps the right to freeze holders.");
  if (identity.status === "unreachable") f("identity", 0, identity.reason);
  else if (!identity.verified) f("identity", looksLikeMajorAsset(code) ? -40 : -20, looksLikeMajorAsset(code) ? `Issuer fails identity verification while using the code of a major asset (${code}): likely an imitation. ${identity.reason}` : identity.reason);
  if (powers.transferFeePercent > 1) f("transfer_fee", -10, `${powers.transferFeePercent}% fee on every transfer.`);
  if (!amm.amm && offerCount === 0) f("liquidity", -25, "No XRP AMM pool and no XRP order book: there may be no way to sell.");
  else if (ammXrp < 10_000) f("liquidity", -10, `Thin liquidity: ${ammXrp.toLocaleString()} XRP in the AMM pool.`);
  if (cert?.verdict === "hold") f("noshashi", -10, `NOSHASHI verdict HOLD: ${cert.failedChecks.join("; ")}.`);
  if (cert?.verdict === "no-go" || cert?.verdict === "nogo") f("noshashi", -25, `NOSHASHI verdict NO-GO: ${cert.failedChecks.join("; ")}.`);
  let score = Math.max(0, 100 + factors.reduce((s, x) => s + x.points, 0));
  if (sanctioned) { score = 0; f("sanctions", -100, "The issuer or the account that funded it is on the OFAC sanctions list."); }
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

  return {
    reportId: randomUUID(), checkedAt: new Date().toISOString(), validatedLedgerIndex: powers.ledgerIndex,
    token: { currency: code, currencyHex: cur, issuer, circulatingSupply: supply },
    grade, score, factors,
    issuer: {
      blackholed: powers.blackholed, canFreeze: powers.canFreeze, globallyFrozen: powers.globallyFrozen, canClawback: powers.canClawback,
      requiresAuthorization: powers.requiresAuthorization, transferFeePercent: powers.transferFeePercent, regularKeySet: powers.regularKeySet, multiSign: powers.multiSign,
      identity: { domain: identity.domain, status: identity.status, verified: identity.verified, organization: identity.organization, note: identity.reason, declaredTokens: identity.tokens },
    },
    liquidity: {
      amm: amm.amm ? { xrp: ammXrp, tokens: ammTok, priceXrp: ammTok > 0 ? ammXrp / ammTok : null, tradingFeePercent: amm.amm.trading_fee / 1000 } : null,
      orderBook: { sellOffers: asks.offers?.length ?? null, buyOffers: bids.offers?.length ?? null },
    },
    noshashiCertificate: cert,
    sanctions: { issuerListed: issuerHit.sanctioned, fundedBy: funder, funderListed: !!funderHit?.sanctioned },
    methodology: TOKEN_METHODOLOGY,
  };
}
