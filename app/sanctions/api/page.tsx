import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { SANCTIONS_PLANS } from "@/lib/plans";
import { sanctionsOpenapi } from "@/lib/sanctions/openapi";
import { listsInfo } from "@/lib/sanctions/api";
import { CHAINS, CREDIT_PRICE_MICROS } from "@/lib/billing/crypto";
import { billingEnabled } from "@/lib/billing/accounts";

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
        <li><b>XRPL Counterparty Check:</b> one verdict on any XRP Ledger address: sanctions (the address, who funded it, and who it recently dealt with), account settings, and for token issuers NOSHASHI&apos;s issuer authority certificate. <a href="/xrpl">Try it free</a>.</li>
        <li><b>Crypto wallet screening:</b> check any wallet against every sanctioned address OFAC publishes (Bitcoin, Ethereum and EVM chains, Tron, USDT, Monero and more), one at a time or 100 per call.</li>
        <li><b>Ongoing monitoring:</b> save your customers once; once a day they are re-screened against any list changes and you get a signed webhook alert for any new match or delisting.</li>
        <li><b>Audit-ready:</b> every screening returns a unique ID, timestamp and the list snapshot version.</li>
      </ul></div>
      <h2>Plans</h2>
      <div className="plans">{SANCTIONS_PLANS.map((p) => (
        <div className="card" key={p.id}><b>{p.name}</b><div className="price">{p.price}</div><div className="small muted">{p.quota}</div>
          <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
      ))}</div>
      <p className="small muted">Subscription billing, keys and quotas are handled by the API marketplace.</p>
      <h2>Or pay with crypto</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>No subscription, no card: buy prepaid credits with <b>XRP or RLUSD on the XRP Ledger</b> (your own destination tag, credited automatically) or <b>USDC on {Object.keys(CHAINS).map((c) => c[0].toUpperCase() + c.slice(1)).join(" or ")}</b> at <b>${(Number(CREDIT_PRICE_MICROS) / 1e6).toFixed(2)} per credit</b>. One credit = one screening, wallet check or report; batches cost one credit per item; failed calls are refunded. Credits never expire.</p>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Send USDC from your own wallet to the address in <a href="/api/v1/billing/info"><code>/api/v1/billing/info</code></a>.</li>
          <li>Sign the claim message with the same wallet and <code>POST /api/v1/billing/claim</code>. Payments are verified directly on-chain.</li>
          <li>Use the API key you receive in the <code>X-API-Key</code> header. Check your balance at <code>/api/v1/billing/balance</code>.</li>
        </ol>
        {!billingEnabled() && <p className="small muted" style={{ marginBottom: 0 }}>Crypto payments are being set up and will be available shortly.</p>}
      </div>
      <h2>Endpoints</h2>
      <div className="card tablewrap"><table>
        <thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
        <tbody>{Object.entries(sanctionsOpenapi.paths).flatMap(([path, ops]) => Object.entries(ops).map(([m, op]) => (
          <tr key={path + m}><td>{m.toUpperCase()}</td><td style={{ fontFamily: "ui-monospace,monospace" }}>{path}</td><td>{(op as { summary: string }).summary}</td></tr>)))}</tbody>
      </table></div>
      <h2>Example</h2>
      <pre className="card" style={{ overflowX: "auto", fontSize: 13 }}>{`curl "${base}/screen?name=Vladimir%20Poutine&dob=1952" \\
  -H "X-API-Key: YOUR_KEY"

curl "${base}/wallet?address=0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB" \\
  -H "X-API-Key: YOUR_KEY"`}</pre>
      <p>OpenAPI 3 spec: <a href="/api/v1/sanctions/openapi.json">/api/v1/sanctions/openapi.json</a></p>
      <p className="small muted">A match is a potential match requiring human review, not a determination. You remain responsible for compliance decisions; this is not legal advice.</p>
    </>
  );
}
