import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { SANCTIONS_PLANS } from "@/lib/plans";
import { sanctionsOpenapi } from "@/lib/sanctions/openapi";
import { listsInfo } from "@/lib/sanctions/api";

export const metadata: Metadata = {
  title: "Sanctions Screening API: OFAC, UN, EU & UK",
  description: "One API call screens names against OFAC SDN, OFAC Consolidated, UN, EU and UK sanctions lists, with fuzzy multilingual matching, DOB and country filters, and batch screening.",
  alternates: { canonical: "/sanctions/api" },
};
const MARKET = process.env.NEXT_PUBLIC_SANCTIONS_MARKETPLACE_URL || "";

export default function SanctionsApi() {
  const base = `${SITE_URL}/api/v1/sanctions`;
  const info = listsInfo();
  return (
    <>
      <h1>{sanctionsOpenapi.info.title}</h1>
      <p className="muted">Screen customers, vendors and payments against <b>{info.totalRecords.toLocaleString()} records</b> on five official lists (U.S. OFAC SDN & Consolidated, UN Security Council, EU and UK) in one call. Lists refresh from the official publishers every 6 hours.</p>
      {MARKET && <p><a href={MARKET}><button>Get an API key</button></a></p>}
      <h2>Why it’s different</h2>
      <div className="card"><ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Five lists, one call</b>, with each list’s official publication date returned so you can prove freshness.</li>
        <li><b>Fuzzy, multilingual matching:</b> misspellings, reordered names, hyphenation, legal suffixes (LLC, OOO, PJSC) and Cyrillic input. In our test of 400 real listed names: 100% found exact or reordered, 99.8% with a typo, 100% with first and last name only.</li>
        <li><b>Fewer false positives:</b> date-of-birth and country filters, plus a clear / potential / strong decision.</li>
        <li><b>Ongoing monitoring:</b> save your customers once; once a day they are re-screened against any list changes and you get a signed webhook alert for any new match or delisting.</li>
        <li><b>Audit-ready:</b> every screening returns a unique ID, timestamp and the list snapshot version.</li>
      </ul></div>
      <h2>Plans</h2>
      <div className="plans">{SANCTIONS_PLANS.map((p) => (
        <div className="card" key={p.id}><b>{p.name}</b><div className="price">{p.price}</div><div className="small muted">{p.quota}</div>
          <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
      ))}</div>
      <p className="small muted">Billing, keys and quotas are handled by the API marketplace.</p>
      <h2>Endpoints</h2>
      <div className="card tablewrap"><table>
        <thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
        <tbody>{Object.entries(sanctionsOpenapi.paths).flatMap(([path, ops]) => Object.entries(ops).map(([m, op]) => (
          <tr key={path + m}><td>{m.toUpperCase()}</td><td style={{ fontFamily: "ui-monospace,monospace" }}>{path}</td><td>{(op as { summary: string }).summary}</td></tr>)))}</tbody>
      </table></div>
      <h2>Example</h2>
      <pre className="card" style={{ overflowX: "auto", fontSize: 13 }}>{`curl "${base}/screen?name=Vladimir%20Poutine&dob=1952" \\
  -H "X-RapidAPI-Key: YOUR_KEY"`}</pre>
      <p>OpenAPI 3 spec: <a href="/api/v1/sanctions/openapi.json">/api/v1/sanctions/openapi.json</a></p>
      <p className="small muted">A match is a potential match requiring human review, not a determination. You remain responsible for compliance decisions; this is not legal advice.</p>
    </>
  );
}
