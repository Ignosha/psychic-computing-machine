import { callerPlan, envelope, error, handler, json, options } from "@/lib/api";
import { DISCLAIMER, parseQuery, runScreen } from "@/lib/sanctions/api";
import { sanctionsBatchLimit } from "@/lib/plans";

export const OPTIONS = options;
export const POST = handler<unknown>(async (req) => {
  let body: { queries?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"queries": [{"name": "..."}, ...]}'); }
  const max = sanctionsBatchLimit(callerPlan(req));
  if (!Array.isArray(body?.queries) || !body.queries.length) return error(400, "invalid_params", 'Send JSON: {"queries": [{"name": "..."}, ...]}');
  if (body.queries.length > max) return error(400, "too_many_queries", `Your plan allows up to ${max} names per batch call.`);
  const results = body.queries.map((raw, i) => {
    const q = parseQuery((raw && typeof raw === "object" ? raw : { name: raw }) as Record<string, unknown>);
    return typeof q === "string" ? { index: i, status: "error", error: q } : { index: i, status: "ok", ...runScreen(q) };
  });
  const ok = results.filter((r) => r.status === "ok") as Extract<(typeof results)[number], { decision: string }>[];
  return json({
    ...envelope({
      summary: {
        submitted: results.length, screened: ok.length, failed: results.length - ok.length,
        clear: ok.filter((r) => r.decision === "clear").length,
        potentialMatches: ok.filter((r) => r.decision === "potential_match").length,
        strongMatches: ok.filter((r) => r.decision === "strong_match").length,
      },
      results,
    }),
    disclaimer: DISCLAIMER,
  });
}, { minPlan: "PRO", planLabel: "Growth" });
