import type { Metadata } from "next";
import Findings, { ApiCta } from "@/components/Findings";
import { parsePreflight, preflight } from "@/lib/xrpl/preflight";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = {
  title: "XRPL Payment Pre-flight: Will My XRP Payment Fail?",
  description: "Check an XRP or token payment before you send it: missing destination tag, unactivated account, no trust line, frozen token, insufficient balance and sanctions. Free.",
  alternates: { canonical: "/xrpl/preflight" },
};
const LABEL: Record<string, string> = { will_fail: "This payment will fail or should not be sent", will_succeed_with_warnings: "Will succeed, with warnings", will_succeed: "Will succeed" };

export default async function Page({ searchParams }: P) {
  const sp = await searchParams;
  const submitted = !!sp.to;
  const parsed = submitted ? parsePreflight(sp) : null;
  let result: Awaited<ReturnType<typeof preflight>> | null = null, problem = typeof parsed === "string" ? parsed : null;
  if (parsed && typeof parsed !== "string") { try { result = await preflight(parsed); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><h1>Will this XRPL payment land?</h1>
        <p className="lead">Check before you sign. A missing destination tag, an unactivated account or a missing trust line costs fees, strands funds or loses an exchange deposit. Pre-flight predicts the exact ledger result, and screens both sides for sanctions.</p></section>
      <form className="panel picker" method="get" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <input name="to" defaultValue={sp.to ?? ""} placeholder="Recipient address (r...)" required aria-label="Recipient" />
        <input name="from" defaultValue={sp.from ?? ""} placeholder="Your address (optional)" aria-label="Sender" />
        <input name="amount" defaultValue={sp.amount ?? ""} placeholder="Amount" required aria-label="Amount" />
        <input name="destinationTag" defaultValue={sp.destinationTag ?? ""} placeholder="Destination tag (optional)" aria-label="Destination tag" />
        <input name="currency" defaultValue={sp.currency ?? "XRP"} placeholder="XRP or token code" aria-label="Currency" />
        <input name="issuer" defaultValue={sp.issuer ?? ""} placeholder="Token issuer (if not XRP)" aria-label="Issuer" />
        <button type="submit" style={{ gridColumn: "1/-1" }}>Check payment</button>
      </form>
      {problem && <div className="card danger">{problem}</div>}
      {result && <>
        <div className={`card ${result.verdict === "will_succeed" ? "ok" : result.verdict === "will_fail" ? "danger" : ""}`}><b>{LABEL[result.verdict]}</b>
          <p className="small muted" style={{ margin: "4px 0 0" }}>Validated ledger {result.validatedLedgerIndex} · reserve {result.network.baseReserveXrp} XRP + {result.network.ownerReserveXrp} XRP per owned object</p></div>
        <Findings items={result.checks} />
        <p className="small muted">{result.note}</p>
      </>}
      <ApiCta what="pre-flight" />
    </>
  );
}
