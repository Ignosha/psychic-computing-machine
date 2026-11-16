import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { openapi } from "@/lib/openapi";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Vehicle Recall & VIN API", description: "One API call for vehicle recalls, owner complaints, crash ratings and VIN decoding from live NHTSA data.", alternates: { canonical: "/developers" } };

const MARKET = process.env.NEXT_PUBLIC_API_MARKETPLACE_URL || "";

export default function Developers() {
  const base = `${SITE_URL}/api/v1`;
  return (
    <>
      <h1>{SITE_NAME} Vehicle Safety API</h1>
      <p className="muted">Recalls, owner complaints, NHTSA 5-Star crash ratings and VIN decoding, in <b>one call</b> instead of four government endpoints. Clean JSON with ISO dates, booleans and numbers. Live NHTSA data, refreshed every 6 hours.</p>
      {MARKET && <p><a href={MARKET}><button>Get an API key</button></a></p>}
      <h2>Only here</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Defect signals:</b> problems owners keep reporting that have <i>no recall yet</i>, ranked by severity with a 12-month trend.</li>
          <li><b>Model-year history:</b> best and worst years for any model, scored from recalls, urgent recalls and serious incidents.</li>
          <li><b>Fleet & inventory screening:</b> 50 VINs in one call, with do-not-drive and park-outside recalls flagged.</li>
          <li><b>Safety score & remedy type</b> on every report, with a published methodology you can audit.</li>
        </ul>
      </div>
      <h2>Plans</h2>
      <div className="plans">{PLANS.map((p) => (
        <div className="card" key={p.id}><b>{p.name}</b><div className="price">{p.price}</div><div className="small muted">{p.quota}</div>
          <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
      ))}</div>
      <p className="small muted">Billing, keys and quotas are handled by the API marketplace.</p>
      <h2>Endpoints</h2>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
          <tbody>{Object.entries(openapi.paths).map(([path, v]) => {
            const [method, op] = Object.entries(v)[0] as [string, { summary: string }];
            return <tr key={path}><td>{method.toUpperCase()}</td><td style={{ fontFamily: "ui-monospace,monospace" }}>{path}</td><td>{op.summary}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <h2>Example</h2>
      <pre className="card" style={{ overflowX: "auto", fontSize: 13 }}>{`curl "${base}/vin/1HGCV1F30JA000000" \\
  -H "X-RapidAPI-Key: YOUR_KEY"

curl -X POST "${base}/batch" \\
  -H "X-RapidAPI-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"vins":["1HGCV1F30JA000000","5YJ3E1EA7KF317000"]}'`}</pre>
      <p className="small muted">Every response is <code>{"{ data, meta }"}</code>. Errors are <code>{"{ error: { code, message } }"}</code> with HTTP 400, 401, 403 (plan upgrade needed), 404 or 502. A 502 means NHTSA is down: we never return an empty result in place of an outage.</p>
      <h2>Spec</h2>
      <p>OpenAPI 3 spec: <a href="/api/v1/openapi.json">/api/v1/openapi.json</a></p>
      <h2>Use cases</h2>
      <ul>
        <li>Used-car listings and dealer inventory: flag open recalls and do-not-drive vehicles.</li>
        <li>Repair shops: show recall work at vehicle check-in.</li>
        <li>Fleet and insurance tools: monitor recall and complaint risk by model.</li>
      </ul>
    </>
  );
}
