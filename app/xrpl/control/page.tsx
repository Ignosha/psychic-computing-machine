import type { Metadata } from "next";
import AddressForm from "@/components/AddressForm";
import Findings, { ApiCta } from "@/components/Findings";
import { controlAudit } from "@/lib/xrpl/security";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = { title: "XRPL Account Control Audit: Who Can Sign for This Account?", description: "See who can sign for any XRP Ledger account (master key, regular key, multi-signing) and whether control changed recently, a common account-takeover signal. Free.", alternates: { canonical: "/xrpl/control" } };
const tone = (v: string) => (v === "clear" ? "ok" : v === "block" ? "danger" : "verdict");
const LABEL: Record<string, string> = { clear: "No control warnings", review: "Review before sending large amounts", block: "Do not transact" };

export default async function Page({ searchParams }: P) {
  const address = ((await searchParams).address ?? "").trim();
  let r: Awaited<ReturnType<typeof controlAudit>> | null = null, problem: string | null = null;
  if (address) { try { r = await controlAudit(address); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><p className="eyebrow">05 / Control · before a large payment</p><h1 dangerouslySetInnerHTML={{ __html: "Who can <em>sign</em> for this account?" }} /><p className="lead">Keys, multi-signing and, most importantly, whether control changed recently. A fresh key change on an account you are about to pay is a classic takeover signal.</p></section>
      <AddressForm label="XRPL account" value={address} />
      {problem && <div className="card danger"><b>Could not complete the check</b><p className="small muted">{problem}</p></div>}
      {r && <>
        <div className={`card ${tone(r.verdict)}`}><b>{LABEL[r.verdict]}</b><p className="small muted">{r.address} · ledger {r.validatedLedgerIndex} · {r.historyScanned ?? 0} transactions scanned</p></div>
        {r.findings.length > 0 && <Findings items={r.findings} />}
        <h2>Control</h2>
        <div className="card small"><p style={{ margin: 0 }}>Master key: {r.control.masterKeyDisabled ? "disabled" : "enabled"} · Regular key: {r.control.regularKey ?? "none"} · Multi-signing: {r.control.signerList ? `quorum ${r.control.signerList.quorum} of ${r.control.signerList.signers.length} signers` : "none"}</p></div>
        <h2>Control changes</h2>
        <div className="card tablewrap">{r.controlChanges.length ? <table><thead><tr><th>Date</th><th>Change</th></tr></thead><tbody>{r.controlChanges.map((c, i) => <tr key={i}><td>{c.date?.slice(0, 10)}</td><td>{c.change}</td></tr>)}</tbody></table> : <p className="small muted" style={{ margin: 0 }}>No control changes in the scanned history.</p>}</div>
      </>}
      <ApiCta what="this check" />
    </>
  );
}
