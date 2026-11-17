import type { Metadata } from "next";
import { ApiCta } from "@/components/Findings";
import { tokenReport } from "@/lib/xrpl/token";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = {
  title: "XRPL Token Risk Report: Is This Token Safe?",
  description: "Grade any XRP Ledger token: can the issuer freeze or claw back, is its identity verified, how deep is liquidity, NOSHASHI's authority certificate, and sanctions. Free.",
  alternates: { canonical: "/xrpl/token" },
};

export default async function Page({ searchParams }: P) {
  const sp = await searchParams;
  let r: Awaited<ReturnType<typeof tokenReport>> | null = null, problem: string | null = null;
  if (sp.currency && sp.issuer) { try { r = await tokenReport(sp.currency, sp.issuer.trim()); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><p className="eyebrow">03 / Assess · before you trade or list</p><h1>Is this token <em>sound?</em></h1>
        <p className="lead">Before you buy, list or accept a token: what its issuer can still do to you, whether the issuer is who it claims to be, whether there is real liquidity to exit, and NOSHASHI&apos;s authority certificate, graded A to F.</p></section>
      <form className="panel picker" method="get" style={{ gridTemplateColumns: "1fr 2fr auto" }}>
        <div className="io-head"><span>Input / Token</span><span>Read only</span></div>
        <input name="currency" defaultValue={sp.currency ?? ""} placeholder="Code, e.g. RLUSD" required aria-label="Currency" />
        <input name="issuer" defaultValue={sp.issuer ?? ""} placeholder="Issuer address (r...)" required aria-label="Issuer" />
        <button type="submit">Grade token</button>
      </form>
      {problem && <div className="card danger">{problem}</div>}
      {r && <>
        <div className="scorebox card"><div className={`grade g${r.grade}`}>{r.grade}</div>
          <div><b>{r.token.currency} · score {r.score}/100</b><p className="small muted" style={{ margin: "4px 0 0" }}>Issuer {r.token.issuer} · ledger {r.validatedLedgerIndex}{r.token.circulatingSupply ? ` · supply ${Number(r.token.circulatingSupply).toLocaleString()}` : ""}</p></div></div>
        <div className="card">{r.factors.length ? r.factors.map((f) => <p key={f.factor} style={{ margin: "6px 0" }}><span className={f.points < 0 ? "tag red" : "tag"}>{f.points}</span> {f.detail}</p>) : <p style={{ margin: 0 }}>No risk factors found.</p>}</div>
        <h2>Issuer</h2>
        <div className="card small">
          <p style={{ marginTop: 0 }}><b>Identity:</b> {r.issuer.identity.status === "verified" ? `Verified: ${r.issuer.identity.organization ?? r.issuer.identity.domain}` : r.issuer.identity.note}</p>
          <p style={{ marginBottom: 0 }}>Can freeze: {r.issuer.canFreeze ? "yes" : "no"} · Can claw back: {r.issuer.canClawback ? "yes" : "no"} · Transfer fee: {r.issuer.transferFeePercent}% · Blackholed: {r.issuer.blackholed ? "yes (settings can never change)" : "no"}</p>
        </div>
        <h2>Liquidity</h2>
        <div className="card small"><p style={{ margin: 0 }}>{r.liquidity.amm ? `AMM pool: ${Math.round(r.liquidity.amm.xrp).toLocaleString()} XRP and ${Math.round(r.liquidity.amm.tokens).toLocaleString()} ${r.token.currency} (price ${r.liquidity.amm.priceXrp?.toPrecision(4)} XRP)` : "No XRP AMM pool."} · Order book: {r.liquidity.orderBook.sellOffers ?? "?"} sell / {r.liquidity.orderBook.buyOffers ?? "?"} buy offers (first 50 each side).</p></div>
        {r.noshashiCertificate && <><h2>NOSHASHI authority certificate</h2>
          <div className="card small"><p style={{ marginTop: 0 }}><b>Verdict: {r.noshashiCertificate.verdict.toUpperCase()}</b> at ledger {r.noshashiCertificate.ledgerIndex}{r.noshashiCertificate.failedChecks.length ? ` · ${r.noshashiCertificate.failedChecks.join("; ")}` : ""}</p>
            <p style={{ marginBottom: 0 }} className="muted">SHA-256 {r.noshashiCertificate.digest.slice(0, 24)}… · <a href={r.noshashiCertificate.verifyUrl} rel="noopener">Verify on NOSHASHI</a></p></div></>}
        <p className="small muted">{r.methodology}</p>
      </>}
      <ApiCta what="token risk reports" />
    </>
  );
}
