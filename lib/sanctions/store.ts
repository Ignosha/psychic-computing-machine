// Monitoring storage via Supabase RPC functions (supabase/migrations/0001_sanctions_monitoring.sql).
// The publishable key only reaches those functions, and every function checks MONITORING_DB_SECRET.
const URL_ = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SECRET = process.env.MONITORING_DB_SECRET || "";

export const monitoringConfigured = () => Boolean(URL_ && KEY && SECRET);

export class StoreError extends Error {
  constructor(message: string, public code: "limit" | "unavailable") { super(message); }
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!monitoringConfigured()) throw new StoreError("Monitoring storage is not configured.", "unavailable");
  let res: Response;
  try {
    res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: SECRET, ...args }),
      cache: "no-store",
    });
  } catch (e) {
    throw new StoreError(`Monitoring storage unreachable: ${(e as Error).message}`, "unavailable");
  }
  if (!res.ok) {
    const text = await res.text();
    const m = text.match(/monitor_limit: ([^"]+)/);
    if (m) throw new StoreError(m[1], "limit");
    const known = text.match(/(insufficient_credits|invalid_key|already_claimed|unknown_tag)/);
    throw new StoreError(known ? known[1] : `Storage error (HTTP ${res.status})`, "unavailable");
  }
  return (await res.json()) as T;
}

export type MonitorRow = {
  id: string; owner: string; external_id: string | null; name: string; type: string | null; dob: string | null; country: string | null;
  threshold: number | null; created_at: string; last_screened_at: string | null; last_hash: string | null; last_decision: string | null;
  last_match_ids: string[];
};
export type AlertRow = {
  id: number; owner: string; monitor_id: string | null; external_id: string | null; monitored_name: string | null;
  kind: "new_match" | "match_removed"; match: Record<string, unknown>; lists_version: string | null; created_at: string;
  delivered_at: string | null; attempts: number;
};
