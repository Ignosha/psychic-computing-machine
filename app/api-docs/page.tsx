import type { Metadata } from "next";
import { LISTING_LABELS, LISTING_URLS, PARENT_BRAND, SITE_NAME, SITE_URL } from "@/lib/site";
import { SANCTIONS_PLANS } from "@/lib/plans";
import { LISTING_IDS, sanctionsOpenapi } from "@/lib/sanctions/openapi";
import { listsInfo } from "@/lib/sanctions/api";
import { CHAINS, CREDIT_PRICE_MICROS } from "@/lib/billing/crypto";
import { billingEnabled } from "@/lib/billing/accounts";

export const metadata: Metadata = {
  title: "Crypto Compliance & XRPL Payment Safety API: Docs and Pricing",
  description: "One API for sanctions and crypto wallet screening, XRPL payment pre-flight, settlement verification with counterfeit-token detection, counterparty checks and token risk reports.",
  alternates: { canonical: "/api-docs" },
};
const MARKET = process.env.NEXT_PUBLIC_API_MARKETPLACE_URL || process.env.NEXT_PUBLIC_SANCTIONS_MARKETPLACE_URL || "";
const COSTS = [
  ["Sanctions name screen, wallet check, record lookup", 1], ["XRPL Payment Pre-flight", 1], ["XRPL Settlement Verify", 1],
  ["XRPL Counterparty Check", 2], ["XRPL Token Risk Report", 3], ["Account Control Audit", 2], ["Inbox Threat Scan", 2], ["Trust Line Audit", 2], ["Escrow Unlock Calendar", 1], ["Batch requests", "per item"], ["Monitored names", "1 each, daily re-screening included"],
  ["Lists, balance, monitor/alert/webhook management", 0],
] as const;

export default function ApiDocs() {
  const base = `${SITE_URL}/api/v1`;
  const info = listsInfo();
  const ops = Object.entries(sanctionsOpenapi.paths).flatMap(([path, o]) => Object.entries(o).map(([m, op]) => ({ path, m, summary: (op as { summary: string }).summary })));
  return (
    <>
      <p className="eyebrow">API &amp; pricing</p>
      <h1>One API for <em>every</em> check.</h1>
      <p className="muted">Crypto compliance and XRPL payment safety in one API: {info.totalRecords.toLocaleString()} official sanctions records and live XRP Ledger reads, with {PARENT_BRAND.name} issuer certificates built in. JSON over HTTPS; every response names its data source and ledger index.</p>
      {Object.values(LISTING_URLS).some(Boolean) ? (
        <p className="cta">{(Object.keys(LISTING_URLS) as (keyof typeof LISTING_URLS)[]).filter((k) => LISTING_URLS[k]).map((k) => (
          <a key={k} className="btn" href={LISTING_URLS[k]} rel="noopener">Subscribe: {LISTING_LABELS[k]} <span className="arrow">↗</span></a>
        ))}</p>
      ) : MARKET && <p><a href={MARKET}><button>Subscribe on the API marketplace</button></a></p>}

      <h2>Plans</h2>
      <div className="plans">{SANCTIONS_PLANS.map((p) => (
        <div className="card" key={p.id}><b>{p.name}</b><div className="price">{p.price}</div><div className="small muted">{p.quota}</div>
          <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
      ))}</div>
      <p className="small muted">Subscriptions are billed through the API marketplace. Quotas count credits; heavier checks use more credits (below).</p>

      <h2>Or pay with crypto, no subscription</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>Prepaid credits at <b>${(Number(CREDIT_PRICE_MICROS) / 1e6).toFixed(2)} each</b>, bought with <b>XRP or RLUSD</b> on the XRP Ledger (your own destination tag, credited automatically) or <b>USDC</b> on {Object.keys(CHAINS).map((c) => c[0].toUpperCase() + c.slice(1)).join(" or ")}. Credits never expire; failed calls are refunded. Instructions: <a href="/api/v1/billing/info"><code>/api/v1/billing/info</code></a>.</p>
        {!billingEnabled() && <p className="small muted" style={{ marginBottom: 0 }}>Crypto payments are being set up and will be available shortly.</p>}
      </div>

      <h2>Credits per call</h2>
      <div className="card tablewrap"><table><tbody>{COSTS.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></div>

      <h2>Endpoints</h2>
      <div className="card tablewrap"><table>
        <thead><tr><th>Method</th><th>Path</th><th>What it does</th></tr></thead>
        <tbody>{ops.map((o) => <tr key={o.path + o.m}><td>{o.m.toUpperCase()}</td><td style={{ fontFamily: "ui-monospace,monospace" }}>/api/v1{o.path}</td><td>{o.summary}</td></tr>)}</tbody>
      </table></div>

      <h2>Examples</h2>
      <pre className="card" style={{ overflowX: "auto", fontSize: 13 }}>{`# Will this payment land?
curl "${base}/xrpl/preflight?to=rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv&amount=25&currency=XRP" -H "X-API-Key: YOUR_KEY"

# Did I really get paid?
curl "${base}/xrpl/verify?tx=TX_HASH&expectTo=YOUR_ADDRESS&expectCurrency=RLUSD&expectAmount=100" -H "X-API-Key: YOUR_KEY"

# Grade a token
curl "${base}/xrpl/token?currency=RLUSD&issuer=rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" -H "X-API-Key: YOUR_KEY"

# Screen a name or a wallet
curl "${base}/sanctions/screen?name=Jane%20Doe&dob=1985" -H "X-API-Key: YOUR_KEY"
curl "${base}/sanctions/wallet?address=0x..." -H "X-API-Key: YOUR_KEY"`}</pre>

      <h2>OpenAPI specs</h2>
      <p>{LISTING_IDS.map((id, i) => <span key={id}>{i ? " · " : ""}<a href={`/api/v1/openapi/${id}.json`}>{id}.json</a></span>)}</p>
      <p>Code examples (JavaScript and Python, zero dependencies): <a href="https://github.com/Ignosha/noshguard-examples" rel="noopener">github.com/Ignosha/noshguard-examples ↗</a></p>
      <p className="small muted">Results are information for your own review, not legal or financial advice. A sanctions match is a potential match requiring human review.</p>
    </>
  );
}
