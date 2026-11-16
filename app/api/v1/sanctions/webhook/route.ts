import { envelope, error, handler, json, options } from "@/lib/api";
import { monitorGuard, storeError } from "@/lib/sanctions/route-helpers";
import { rpc } from "@/lib/sanctions/store";
import { checkWebhookUrl, newSigningSecret } from "@/lib/sanctions/webhook";

export const OPTIONS = options;

export const GET = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  try {
    const [w] = await rpc<{ url: string; updated_at: string }[]>("webhook_get", { p_owner: g.owner });
    return json(envelope(w ? { url: w.url, updatedAt: w.updated_at } : { url: null }));
  } catch (e) { return storeError(e); }
});

// Body: {"url": "https://example.com/hooks/sanctions"}. Returns a new signing secret (shown once).
export const PUT = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  let body: { url?: unknown };
  try { body = await req.json(); } catch { return error(400, "invalid_json", 'Send JSON: {"url": "https://..."}'); }
  const url = String(body?.url ?? "");
  const bad = await checkWebhookUrl(url);
  if (bad) return error(400, "invalid_url", bad);
  const signingSecret = newSigningSecret();
  try {
    await rpc("webhook_set", { p_owner: g.owner, p_url: url, p_signing_secret: signingSecret });
    return json(envelope({
      url, signingSecret,
      verification: "Each delivery has X-Webhook-Timestamp and X-Webhook-Signature headers. Compute HMAC-SHA256 of `${timestamp}.${rawBody}` with signingSecret; the signature is 'sha256=' + hex digest. Reject timestamps older than 5 minutes.",
      note: "Store signingSecret now; it is not shown again. Setting the webhook again issues a new secret.",
    }));
  } catch (e) { return storeError(e); }
});

export const DELETE = handler<unknown>(async (req) => {
  const g = monitorGuard(req); if (g instanceof Response) return g;
  try { return json(envelope({ deleted: await rpc<boolean>("webhook_delete", { p_owner: g.owner }) })); } catch (e) { return storeError(e); }
});
