import type { Metadata } from "next";
import AddressForm from "@/components/AddressForm";
import Findings, { ApiCta } from "@/components/Findings";
import { inboxScan } from "@/lib/xrpl/security";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = { title: "XRPL Inbox Threat Scan: Address Poisoning & Phishing Memos", description: "Scan an XRP Ledger account for address-poisoning attempts, phishing links in memos, dust spam and payments from sanctioned senders. Free.", alternates: { canonical: "/xrpl/inbox" } };
const tone = (v: string) => (v === "clear" ? "ok" : v === "block" ? "danger" : "verdict");
const LABEL: Record<string, string> = { clear: "No threats found", review: "Threats found in your inbox", block: "Funds from sanctioned senders" };

export default async function Page({ searchParams }: P) {
  const address = ((await searchParams).address ?? "").trim();
  let r: Awaited<ReturnType<typeof inboxScan>> | null = null, problem: string | null = null;
  if (address) { try { r = await inboxScan(address); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><p className="eyebrow">06 / Inbox · before you copy an address</p><h1 dangerouslySetInnerHTML={{ __html: "Is someone <em>baiting</em> you?" }} /><p className="lead">Scammers send tiny payments from addresses that imitate ones you have paid, hoping you copy the wrong one from your history, or plant links in memos. This scan finds them.</p></section>
      <AddressForm label="Your XRPL account" value={address} />
      {problem && <div className="card danger"><b>Could not complete the check</b><p className="small muted">{problem}</p></div>}
      {r && <>
        <div className={`card ${tone(r.verdict)}`}><b>{LABEL[r.verdict]}</b><p className="small muted">{r.scanned.transactions} transactions · {r.scanned.incoming} incoming · {r.scanned.knownRecipients} addresses you have paid</p></div>
        {r.findings.length > 0 && <Findings items={r.findings} />}
        {r.addressPoisoning.length > 0 && <><h2>Address-poisoning attempts</h2><div className="card tablewrap"><table><thead><tr><th>Fake sender</th><th>Imitates</th><th>Date</th></tr></thead><tbody>{r.addressPoisoning.map((p, i) => <tr key={i}><td><code>{p.from}</code></td><td><code>{p.imitates}</code></td><td>{p.date?.slice(0, 10)}</td></tr>)}</tbody></table></div></>}
        {r.phishingMemos.length > 0 && <><h2>Links in memos</h2><div className="card tablewrap"><table><thead><tr><th>Link</th><th>From</th><th>Date</th></tr></thead><tbody>{r.phishingMemos.map((p, i) => <tr key={i}><td><code>{p.url}</code></td><td><code>{p.from}</code></td><td>{p.date?.slice(0, 10)}</td></tr>)}</tbody></table></div></>}
        <p className="small muted">{r.note}</p>
      </>}
      <ApiCta what="this check" listing="xrpl-security" />
    </>
  );
}
