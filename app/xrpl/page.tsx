import { LISTING_URLS } from "@/lib/site";
import Link from "next/link";
import type { Metadata } from "next";
import { checkCounterparty } from "@/lib/xrpl/check";
import { XrplError } from "@/lib/xrpl/client";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;

export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "XRPL Counterparty Check: Sanctions & Issuer Risk",
    description: "Check any XRP Ledger address before you send or accept funds: OFAC sanctions (including funding source and recent counterparties), account settings, and NOSHASHI's issuer authority certificate.",
    alternates: { canonical: "/xrpl" },
    ...(sp.address ? { robots: { index: false, follow: true } } : {}),
  };
}

const LABEL = { block: "Do not transact", review: "Review before transacting", clear: "No issues found" } as const;
const SEV = { block: "tag red", review: "tag", info: "tag blue" } as const;

export default async function XrplPage({ searchParams }: P) {
  const sp = await searchParams;
  const address = (sp.address ?? "").trim();
  let result: Awaited<ReturnType<typeof checkCounterparty>> | null = null, problem: string | null = null;
  if (address) {
    try { result = await checkCounterparty(address); }
    catch (e) { problem = e instanceof XrplError ? e.message : "The check could not be completed. Please retry."; }
  }
  const cert = result?.issuer?.noshashiCertificate;
  return (
    <>
      <section className="hero">
        <p className="eyebrow">04 / Screen · who is on the other side</p>
        <h1>Who are you <em>dealing</em> with?</h1>
        <p className="lead">Before you send XRP or tokens to an address, or accept funds from one: one check across OFAC sanctions (the address, who funded it and who it recently dealt with), the account&apos;s ledger settings, and, for token issuers, NOSHASHI&apos;s issuer authority certificate.</p>
      </section>
      <form className="panel vinform" method="get">
        <div className="io-head" style={{ flexBasis: "100%" }}><span>Input / XRPL address</span><span>Read only</span></div>
        <label htmlFor="address" className="sr">XRPL address</label>
        <input id="address" name="address" defaultValue={address} placeholder="r... XRP Ledger address" required pattern="r[1-9A-HJ-NP-Za-km-z]{24,34}" autoComplete="off" spellCheck={false} style={{ textTransform: "none", letterSpacing: 0 }} />
        <button type="submit">Check</button>
      </form>
      {problem && <div className="card danger">{problem}</div>}
      {result && (
        <>
          <div className={`card ${result.verdict === "clear" ? "ok" : result.verdict === "block" ? "danger" : "verdict"}`}>
            <b>{LABEL[result.verdict as keyof typeof LABEL]}</b>
            <p className="small muted" style={{ margin: "4px 0 0" }}>{result.address} · validated ledger {result.ledger.validatedLedgerIndex ?? "n/a"} · {new Date(result.checkedAt).toUTCString()}</p>
          </div>
          {result.findings.length > 0 && <div className="card">{result.findings.map((f) => (
            <p key={f.code} style={{ margin: "6px 0" }}><span className={SEV[f.severity]}>{f.severity}</span> {f.message}</p>
          ))}</div>}
          <h2>Sanctions</h2>
          <div className="card small">
            <p style={{ marginTop: 0 }}><b>Address on OFAC list:</b> {result.sanctions.listed ? `Yes (${result.sanctions.matches.map((m) => m.name).join("; ")})` : "No"}</p>
            <p><b>Funded by:</b> {result.sanctions.fundedBy ? <><code>{result.sanctions.fundedBy.fundedBy}</code> on {result.sanctions.fundedBy.date?.slice(0, 10) ?? "?"} {result.sanctions.fundedBy.sanctioned ? "(SANCTIONED)" : "(not sanctioned)"}</> : "Not determined"}</p>
            <p style={{ marginBottom: 0 }}><b>Recent counterparties:</b> {result.sanctions.recentCounterparties.transactionsScanned == null ? "Could not be read" : `${result.sanctions.recentCounterparties.uniqueCounterparties} addresses across the last ${result.sanctions.recentCounterparties.transactionsScanned} transactions; ${result.sanctions.recentCounterparties.sanctioned.length} sanctioned`}</p>
          </div>
          <h2>Account</h2>
          <div className="card small">
            {result.ledger.exists ? <p style={{ margin: 0 }}>Balance {result.ledger.xrpBalance.toLocaleString()} XRP{result.ledger.domain ? ` · domain ${result.ledger.domain}` : ""}{result.ledger.regularKeySet ? " · regular key set" : ""}</p> : <p style={{ margin: 0 }}>Not activated on the ledger.</p>}
          </div>
          {result.issuer && (
            <>
              <h2>Token issuer: NOSHASHI authority certificate</h2>
              <div className="card small">
                <p style={{ marginTop: 0 }}>Issues {Object.keys(result.issuer.tokensIssued).join(", ")}.</p>
                {cert?.available ? (
                  <>
                    <p><b>Verdict: {cert.verdict.toUpperCase()}</b> at ledger {cert.ledgerIndex}</p>
                    <ul style={{ paddingLeft: 18 }}>{cert.checks.map((c) => <li key={c.id}>{c.passed ? "✓" : "✗"} {c.label}</li>)}</ul>
                    <p style={{ marginBottom: 0 }} className="muted">SHA-256 {cert.digest.slice(0, 24)}… · <a href={cert.verifyUrl} rel="noopener">Verify on NOSHASHI</a></p>
                  </>
                ) : <p style={{ marginBottom: 0 }} className="muted">{cert?.reason ?? "Certificate unavailable."}</p>}
              </div>
            </>
          )}
          <p className="small muted">{result.coverage} Not legal advice.</p>
        </>
      )}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Automate it</h2>
        <p style={{ marginBottom: 0 }}>The same check by API, one address or 25 per call, paid by subscription or with prepaid credits in <b>XRP, RLUSD</b> or USDC: <Link href="/api-docs">API docs and pricing</Link>, or <a href={LISTING_URLS["xrpl-payments"]} rel="noopener">start free on RapidAPI ↗</a>. Deeper XRPL liquidity and policy analysis: <a href="https://www.noshashi.app" rel="noopener">NOSHASHI</a>.</p>
      </div>
    </>
  );
}
