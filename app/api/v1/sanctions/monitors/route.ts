import { callerPlan, chargeExtra, envelope, error, handler, json, options , SANCTIONS_SOURCE } from "@/lib/api";
import { sanctionsMonitorLimit } from "@/lib/plans";
import { DISCLAIMER, parseQuery } from "@/lib/sanctions/api";
import { addMonitors, formatMonitor } from "@/lib/sanctions/monitor";
import { monitorGuard, storeError } from "@/lib/sanctions/route-helpers";
import { rpc, type MonitorRow } from "@/lib/sanctions/store";

export const maxDuration = 60;
export const OPTIONS = options;

export const GET = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  const p = new URL(req.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(p.get("limit")) || 100)), offset = Math.max(0, Number(p.get("offset")) || 0);
  try {
    const [rows, total] = await Promise.all([
      rpc<MonitorRow[]>("mon_list", { p_owner: g.owner, p_limit: limit, p_offset: offset }),
      rpc<number>("mon_count", { p_owner: g.owner }),
    ]);
    return json(envelope({ total, limit, offset, planLimit: sanctionsMonitorLimit(callerPlan(req)), monitors: rows.map(formatMonitor) }, SANCTIONS_SOURCE));
  } catch (e) { return storeError(e); }
}, { cost: 0 });

// Body: {"items": [{"name": "...", "externalId": "cust-123", "type": "individual", "dob": "1980", "country": "France"}]}
// Re-adding an item with the same externalId updates it.
export const POST = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  let body: { items?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"items": [{"name": "...", "externalId": "..."}]}'); }
  if (!Array.isArray(body?.items) || !body.items.length) return error(400, "invalid_params", 'Send JSON: {"items": [{"name": "...", "externalId": "..."}]}');
  if (body.items.length > 500) return error(400, "too_many_items", "At most 500 items per request.");
  const items = [];
  const seen = new Set<string>();
  for (const [i, raw] of body.items.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const q = parseQuery({ ...r, limit: undefined, sources: undefined });
    if (typeof q === "string") return error(400, "invalid_item", `items[${i}]: ${q}`);
    const externalId = r.externalId == null ? undefined : String(r.externalId).slice(0, 100);
    if (externalId && seen.has(externalId)) return error(400, "duplicate_external_id", `items[${i}]: externalId ${externalId} appears twice.`);
    if (externalId) seen.add(externalId);
    items.push({ name: q.name, type: q.type, dob: q.dob, country: q.country, threshold: q.threshold, externalId });
  }
  await chargeExtra(req, items.length - 1);
  try {
    const results = await addMonitors(g.owner, items, sanctionsMonitorLimit(callerPlan(req)));
    return json({ ...envelope({ added: results.length, results }, SANCTIONS_SOURCE), disclaimer: DISCLAIMER });
  } catch (e) { return storeError(e); }
});
