import type { Metadata } from "next";
import AddressForm from "@/components/AddressForm";
import Findings, { ApiCta } from "@/components/Findings";
import { escrowCalendar } from "@/lib/xrpl/security";

type P = { searchParams: Promise<Record<string, string | undefined>> };
export const maxDuration = 30;
export const metadata: Metadata = { title: "XRPL Escrow Unlock Calendar: Upcoming XRP Releases", description: "See every escrow held by an XRP Ledger account, when each becomes releasable, and how much XRP unlocks each month. Free.", alternates: { canonical: "/xrpl/escrows" } };
const tone = (v: string) => (v === "clear" ? "ok" : v === "block" ? "danger" : "verdict");
const LABEL: Record<string, string> = { clear: "", review: "", block: "" };

export default async function Page({ searchParams }: P) {
  const address = ((await searchParams).address ?? "").trim();
  let r: Awaited<ReturnType<typeof escrowCalendar>> | null = null, problem: string | null = null;
  if (address) { try { r = await escrowCalendar(address); } catch (e) { problem = (e as Error).message; } }
  return (
    <>
      <section className="hero"><p className="eyebrow">08 / Escrow · supply unlocks</p><h1 dangerouslySetInnerHTML={{ __html: "When does the <em>supply</em> unlock?" }} /><p className="lead">Treasury and project accounts lock tokens in escrow. This calendar shows every escrow on an account, when it becomes releasable, and how much unlocks each month.</p></section>
      <AddressForm label="XRPL account" value={address} />
      {problem && <div className="card danger"><b>Could not complete the check</b><p className="small muted">{problem}</p></div>}
      {r && <>
        <div className="card verdict"><b>{r.summary.totalXrpLocked.toLocaleString()} XRP in {r.summary.escrows} escrow(s)</b><p className="small muted">{r.summary.nextRelease ? `Next releasable ${r.summary.nextRelease.date?.slice(0, 10)}: ${r.summary.nextRelease.amount.value.toLocaleString()} ${r.summary.nextRelease.amount.currency}` : "No upcoming releases"} · releasable now {r.summary.releasableNowXrp.toLocaleString()} XRP</p></div>
        {r.upcomingXrpByMonth.length > 0 && <><h2>Upcoming XRP by month</h2><div className="card tablewrap"><table><thead><tr><th>Month</th><th>XRP releasable</th></tr></thead><tbody>{r.upcomingXrpByMonth.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.xrp.toLocaleString()}</td></tr>)}</tbody></table></div></>}
        <p className="small muted">{r.note}</p>
      </>}
      <ApiCta what="this check" />
    </>
  );
}
