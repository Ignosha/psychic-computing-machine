import type { Metadata } from "next";
import Findings, { ApiCta } from "@/components/Findings";
import { verifySettlement } from "@/lib/xrpl/settlement";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = {
  title: "XRPL Payment Verification: Partial Payments & Fake Tokens",
  description: "Paste an XRPL transaction hash to see what was really delivered. Catches partial payments, counterfeit USD/RLUSD/USDC tokens, wrong destination tags and sanctioned senders. Free.",
  alternates: { canonical: "/xrpl/verify" },
};
const LABEL: Record<string, string> = { settled: "Settled: safe to credit", settled_with_warnings: "Settled, with warnings", not_settled: "Do not credit this payment as stated" };

export default async function Page({ searchParams }: P) {
  const sp = await searchParams;
  let result: Awaited<ReturnType<typeof verifySettlement>> | null = null, problem: string | null = null;
  if (sp.tx) {
    try {
      result = await verifySettlement(sp.tx.trim(), {
        to: sp.expectTo || undefined, amount: sp.expectAmount || undefined, currency: sp.expectCurrency || undefined,
        destinationTag: sp.expectDestinationTag ? Number(sp.expectDestinationTag) : undefined,
      });
    } catch (e) { problem = (e as Error).message; }
  }
  const p = result?.payment;
  return (
    <>
      <section className="hero"><p className="eyebrow">02 / Verify · after you&apos;re paid</p><h1>Did you <em>really</em> get paid?</h1>
        <p className="lead">On the XRP Ledger a payment can say $1,000 and deliver cents (a partial payment), or arrive in a token that only looks like USD, RLUSD or USDC. Paste the transaction hash before you ship goods or credit a balance.</p></section>
      <form className="panel picker" method="get" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="io-head"><span>Input / Transaction</span><span>Read only</span></div>
        <input name="tx" defaultValue={sp.tx ?? ""} placeholder="Transaction hash" required aria-label="Transaction hash" style={{ gridColumn: "1/-1" }} />
        <input name="expectTo" defaultValue={sp.expectTo ?? ""} placeholder="Your receiving address (optional)" aria-label="Expected recipient" />
        <input name="expectDestinationTag" defaultValue={sp.expectDestinationTag ?? ""} placeholder="Expected destination tag (optional)" aria-label="Expected tag" />
        <input name="expectAmount" defaultValue={sp.expectAmount ?? ""} placeholder="Expected amount (optional)" aria-label="Expected amount" />
        <input name="expectCurrency" defaultValue={sp.expectCurrency ?? ""} placeholder="Expected currency, e.g. RLUSD" aria-label="Expected currency" />
        <button type="submit" style={{ gridColumn: "1/-1" }}>Verify payment</button>
      </form>
      {problem && <div className="card danger">{problem}</div>}
      {result && p && <>
        <div className={`card ${result.verdict === "settled" ? "ok" : result.verdict === "not_settled" ? "danger" : "verdict"}`}><b>{LABEL[result.verdict]}</b>
          <p className="small muted" style={{ margin: "4px 0 0" }}>Delivered <b>{p.deliveredAmount ? `${p.deliveredAmount.value} ${p.deliveredAmount.currency}` : "unknown"}</b>{p.statedAmount ? ` (stated ${p.statedAmount.value} ${p.statedAmount.currency})` : ""} · from {p.from} · ledger {p.ledgerIndex ?? "pending"}</p></div>
        <Findings items={result.findings} />
        <p className="small muted">{result.rule}</p>
      </>}
      <ApiCta what="settlement verification" listing="xrpl-payments" />
    </>
  );
}
