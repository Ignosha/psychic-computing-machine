import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { openapi } from "@/lib/openapi";

export const metadata: Metadata = { title: "Vehicle Recall & VIN API", description: "One API call for vehicle recalls, owner complaints, crash ratings and VIN decoding from live NHTSA data.", alternates: { canonical: "/developers" } };

const MARKET = process.env.NEXT_PUBLIC_API_MARKETPLACE_URL || "";

export default function Developers() {
  const base = `${SITE_URL}/api/v1`;
  return (
    <>
      <h1>{SITE_NAME} Vehicle Safety API</h1>
      <p className="muted">Recalls, owner complaints, NHTSA 5-Star crash ratings and VIN decoding, in <b>one call</b> instead of four government endpoints. Clean JSON with ISO dates, booleans and numbers. Live NHTSA data, refreshed every 6 hours.</p>
      {MARKET && <p><a href={MARKET}><button>Get an API key</button></a></p>}
      <h2>Endpoints</h2>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
          <tbody>{Object.entries(openapi.paths).map(([path, v]) => (
            <tr key={path}><td>GET</td><td style={{ fontFamily: "ui-monospace,monospace" }}>{path}</td><td>{v.get.summary}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <h2>Example</h2>
      <pre className="card" style={{ overflowX: "auto", fontSize: 13 }}>{`curl "${base}/vin/1HGCV1F30JA000000" \\
  -H "X-RapidAPI-Key: YOUR_KEY"`}</pre>
      <p className="small muted">Every response is <code>{"{ data, meta }"}</code>. Errors are <code>{"{ error: { code, message } }"}</code> with HTTP 400, 401, 404 or 502. A 502 means NHTSA is down: we never return an empty result in place of an outage.</p>
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
