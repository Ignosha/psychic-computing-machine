import { envelope, error, handler, json, options } from "@/lib/api";
import { formatMonitor } from "@/lib/sanctions/monitor";
import { monitorGuard, storeError } from "@/lib/sanctions/route-helpers";
import { rpc, type MonitorRow } from "@/lib/sanctions/store";

export const OPTIONS = options;
type C = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = handler<C>(async (req, { params }) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  const id = (await params).id;
  if (!UUID.test(id)) return error(404, "not_found", "No monitor with that id.");
  try {
    const [row] = await rpc<MonitorRow[]>("mon_get", { p_owner: g.owner, p_id: id });
    return row ? json(envelope(formatMonitor(row))) : error(404, "not_found", "No monitor with that id.");
  } catch (e) { return storeError(e); }
});

export const DELETE = handler<C>(async (req, { params }) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  const id = (await params).id;
  if (!UUID.test(id)) return error(404, "not_found", "No monitor with that id.");
  try {
    return (await rpc<boolean>("mon_delete", { p_owner: g.owner, p_id: id }))
      ? json(envelope({ deleted: id })) : error(404, "not_found", "No monitor with that id.");
  } catch (e) { return storeError(e); }
});
