import { loadDb } from "./match";
import { runScreen } from "./api";
import { rpc, type AlertRow, type MonitorRow } from "./store";
import { deliver } from "./webhook";

type Q = { name: string; type?: string; dob?: string; country?: string; threshold?: number };
const screenRow = (r: Q) =>
  runScreen({ name: r.name, type: (r.type || undefined) as never, dob: r.dob || undefined, country: r.country || undefined, threshold: r.threshold ?? undefined, limit: 50 });

export const formatMonitor = (m: MonitorRow) => ({
  id: m.id, externalId: m.external_id, name: m.name, type: m.type, dob: m.dob, country: m.country, threshold: m.threshold,
  createdAt: m.created_at, lastScreenedAt: m.last_screened_at, lastDecision: m.last_decision, currentMatchIds: m.last_match_ids,
  upToDate: m.last_hash === loadDb().contentHash,
});
export const formatAlert = (a: AlertRow) => ({
  id: a.id, kind: a.kind, monitorId: a.monitor_id, externalId: a.external_id, monitoredName: a.monitored_name, match: a.match,
  listsVersion: a.lists_version, createdAt: a.created_at, webhookDelivered: !!a.delivered_at,
});

// Screens each item now and stores it with its current matches as the baseline for future alerts.
export async function addMonitors(owner: string, items: (Q & { externalId?: string })[], limit: number) {
  const hash = loadDb().contentHash;
  const screened = items.map((it) => ({ it, r: screenRow(it) }));
  const rows = await rpc<MonitorRow[]>("mon_add", {
    p_owner: owner, p_limit: limit,
    p_rows: screened.map(({ it, r }) => ({
      external_id: it.externalId ?? null, name: it.name, type: it.type ?? null, dob: it.dob ?? null, country: it.country ?? null,
      threshold: it.threshold ?? null, last_hash: hash, last_decision: r.decision, last_match_ids: r.matches.map((m) => m.id),
    })),
  });
  return rows.map((row, i) => ({
    monitor: formatMonitor(row),
    currentScreening: { decision: screened[i].r.decision, matchCount: screened[i].r.matchCount, screeningId: screened[i].r.screeningId,
      matches: screened[i].r.matches.slice(0, 5) },
  }));
}

// Re-screens monitors not yet checked against the current list snapshot and records new/removed matches as alerts.
export async function rescreenDue(deadline: number) {
  const { contentHash: hash, generatedAt } = loadDb();
  let screened = 0, alerts = 0;
  while (Date.now() < deadline) {
    const due = await rpc<MonitorRow[]>("mon_due", { p_hash: hash, p_limit: 500 });
    if (!due.length) break;
    const updates: unknown[] = [], newAlerts: unknown[] = [];
    for (const m of due) {
      const r = screenRow({ name: m.name, type: m.type ?? undefined, dob: m.dob ?? undefined, country: m.country ?? undefined, threshold: m.threshold ?? undefined });
      const now = r.matches.map((x) => x.id), prev = new Set(m.last_match_ids);
      for (const x of r.matches) if (!prev.has(x.id))
        newAlerts.push({ owner: m.owner, monitor_id: m.id, external_id: m.external_id, monitored_name: m.name, kind: "new_match", match: x, lists_version: generatedAt });
      for (const id of m.last_match_ids) if (!now.includes(id))
        newAlerts.push({ owner: m.owner, monitor_id: m.id, external_id: m.external_id, monitored_name: m.name, kind: "match_removed", match: { id }, lists_version: generatedAt });
      updates.push({ id: m.id, last_hash: hash, last_decision: r.decision, last_match_ids: now });
      if (Date.now() > deadline) break;
    }
    alerts += await rpc<number>("mon_record", { p_updates: updates, p_alerts: newAlerts });
    screened += updates.length;
  }
  return { screened, alerts, listsVersion: generatedAt };
}

// Sends undelivered alerts to each owner's webhook, batched per owner.
export async function deliverPending(deadline: number) {
  type P = { id: number; owner: string; url: string; signing_secret: string; payload: unknown };
  const pending = await rpc<P[]>("alerts_pending", { p_limit: 1000 });
  const byOwner = new Map<string, P[]>();
  for (const p of pending) byOwner.set(p.owner, [...(byOwner.get(p.owner) ?? []), p]);
  let delivered = 0, failed = 0;
  for (const list of byOwner.values()) {
    if (Date.now() > deadline) break;
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const res = await deliver(chunk[0].url, chunk[0].signing_secret, { type: "sanctions.alerts", alerts: chunk.map((c) => c.payload) });
      await rpc("alerts_mark", { p_ids: chunk.map((c) => c.id), p_ok: res.ok, p_error: res.error ?? null });
      if (res.ok) delivered += chunk.length; else failed += chunk.length;
    }
  }
  return { delivered, failed };
}
