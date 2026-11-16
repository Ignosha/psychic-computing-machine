import { callerId, error } from "@/lib/api";
import { monitoringConfigured, StoreError } from "./store";

// Common guard for monitoring endpoints: storage configured and a trusted customer identity.
export function monitorGuard(req: Request): { owner: string } | Response {
  if (!monitoringConfigured()) return error(503, "monitoring_unavailable", "Monitoring is not enabled on this deployment yet.");
  const owner = callerId(req);
  if (!owner) return error(403, "identity_required", "Monitoring requires an API marketplace subscription.");
  return { owner };
}

export function storeError(e: unknown): Response {
  if (e instanceof StoreError) return e.code === "limit"
    ? error(403, "monitor_limit_reached", `${e.message}. Upgrade your plan or delete monitors.`)
    : error(503, "monitoring_unavailable", "Monitoring storage is temporarily unavailable. Please retry.");
  throw e;
}
