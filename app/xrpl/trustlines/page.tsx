import type { Metadata } from "next";
import AddressForm from "@/components/AddressForm";
import Findings, { ApiCta } from "@/components/Findings";
import { trustlineAudit } from "@/lib/xrpl/security";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = { title: "XRPL Trust Line Audit: Recover Locked XRP Reserve", description: "Find empty trust lines you can remove to release locked XRP reserve, plus look-alike, frozen and risky token holdings on any XRP Ledger account. Free.", alternates: { canonical: "/xrpl/trustlines" } };
const tone = (v: string) => (v === "clear" ? "ok" : v === "block" ? "danger" : "verdict");
const LABEL: Record<string, string> = { clear: "No risky holdings", review: "Holdings need attention", block: "Holds sanctioned tokens" };

export default async function Page({ searchParams }: P) {
  const address = ((await searchParams).address ?? "").trim();
  let r: Awaited<ReturnType<typeof trustlineAudit>> | null = null, problem: string | null = null;
  if (address) { try { r = await trustlineAudit(address); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><p className="eyebrow">07 / Trust lines · reclaim and clean up</p><h1 dangerouslySetInnerHTML={{ __html: "Get your <em>locked</em> XRP back." }} /><p className="lead">Every trust line locks XRP as reserve. Empty lines can be removed to release it. This audit also flags tokens named like USD or RLUSD from impostor issuers, frozen holdings and risky issuers.</p></section>
      <AddressForm label="XRPL account" value={address} />
      {problem && <div className="card danger"><b>Could not complete the check</b><p className="small muted">{problem}</p></div>}
      {r && <>
        <div className={`card ${tone(r.verdict)}`}><b>{LABEL[r.verdict]}</b><p className="small muted">{r.summary.trustLines} trust lines · {r.summary.holdingsWithBalance} with a balance · ledger {r.validatedLedgerIndex}</p></div>
        <div className="scorebox card"><div className="grade gB" style={{ fontSize: 26 }}>{r.summary.reserveRecoverableXrp.toLocaleString()}</div><div><b>XRP recoverable</b><p className="small muted" style={{ margin: "4px 0 0" }}>from {r.summary.removableEmptyLines} empty trust line(s)</p></div></div>
        {r.findings.length > 0 && <Findings items={r.findings} />}
        <h2>Holdings</h2>
        <div className="card tablewrap"><table><thead><tr><th>Token</th><th>Balance</th><th>Issuer</th><th>Flags</th></tr></thead><tbody>{r.holdings.slice(0, 25).map((h, i) => <tr key={i}><td>{h.currency}</td><td>{Number(h.balance).toLocaleString()}</td><td>{h.issuerName ?? <code>{h.issuer.slice(0, 10)}…</code>}{h.issuerVerified ? " ✓" : ""}</td><td>{h.flags.map((f) => <span key={f} className={f === "issuer_can_claw_back" ? "tag" : "tag red"}>{f.replace(/_/g, " ")}</span>)}</td></tr>)}</tbody></table></div>
        <p className="small muted">{r.note}</p>
      </>}
      <ApiCta what="this check" listing="xrpl-security" />
    </>
  );
}
