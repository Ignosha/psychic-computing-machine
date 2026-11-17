import { envelope, handler, json, options , SANCTIONS_SOURCE } from "@/lib/api";
import { formatAlert } from "@/lib/sanctions/monitor";
import { monitorGuard, storeError } from "@/lib/sanctions/route-helpers";
import { rpc, type AlertRow } from "@/lib/sanctions/store";

export const OPTIONS = options;
// Poll with ?after=<last alert id you processed>. Alerts are also pushed to your webhook if one is set.
export const GET = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  const p = new URL(req.url).searchParams;
  const after = Math.max(0, Number(p.get("after")) || 0), limit = Math.min(500, Math.max(1, Number(p.get("limit")) || 100));
  try {
    const rows = await rpc<AlertRow[]>("alerts_list", { p_owner: g.owner, p_after: after, p_limit: limit });
    return json(envelope({ count: rows.length, nextAfter: rows.length ? rows[rows.length - 1].id : after, alerts: rows.map(formatAlert) }, SANCTIONS_SOURCE));
  } catch (e) { return storeError(e); }
}, { cost: 0 });
