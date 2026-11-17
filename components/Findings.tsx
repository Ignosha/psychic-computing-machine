// Shared result list for the XRPL tools.
const CLS: Record<string, string> = { fail: "tag red", block: "tag red", warn: "tag", review: "tag", info: "tag blue", pass: "tag blue" };
export default function Findings({ items }: { items: { id: string; status?: string; severity?: string; message: string; ledgerResult?: string }[] }) {
  return (
    <div className="card">{items.map((f) => {
      const s = f.status ?? f.severity ?? "info";
      return <p key={f.id} style={{ margin: "6px 0" }}><span className={CLS[s] ?? "tag"}>{s}</span> {f.message}{f.ledgerResult ? <span className="muted small"> ({f.ledgerResult})</span> : null}</p>;
    })}</div>
  );
}
export function ApiCta({ what }: { what: string }) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Automate it</h2>
      <p style={{ marginBottom: 0 }}>Run {what} on every transaction with the API. Free tier, then pay by subscription or with prepaid credits in XRP, RLUSD or USDC. <a href="/api-docs">API docs and pricing →</a></p>
    </div>
  );
}
