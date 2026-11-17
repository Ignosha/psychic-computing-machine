// Latest validated ledger for the Ledger Desk bar. Real reads only: on failure the bar says unavailable.
export async function validatedLedger(): Promise<number | null> {
  const nodes = (process.env.XRPL_RPC_URLS || "https://xrplcluster.com/,https://s2.ripple.com:51234/").split(",").map((s) => s.trim()).filter(Boolean);
  for (const node of nodes) {
    try {
      const r = await fetch(node, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "ledger", params: [{ ledger_index: "validated" }] }),
        next: { revalidate: 30 }, signal: AbortSignal.timeout(4000),
      });
      const j = (await r.json()) as { result?: { ledger_index?: number; ledger?: { ledger_index?: string | number } } };
      const n = Number(j.result?.ledger_index ?? j.result?.ledger?.ledger_index);
      if (n > 0) return n;
    } catch { /* next node */ }
  }
  return null;
}
