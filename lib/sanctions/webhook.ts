import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const newSigningSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

// Signature customers verify: HMAC-SHA256 over "<timestamp>.<raw body>" with their signing secret.
export const sign = (secret: string, timestamp: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

// Webhooks must be public HTTPS endpoints, so the service can't be used to reach internal networks.
export async function checkWebhookUrl(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return "url must be a valid URL."; }
  if (u.protocol !== "https:") return "url must use https.";
  if (u.username || u.password) return "url must not contain credentials.";
  if (raw.length > 500) return "url is too long.";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return "url must be a public host.";
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return "url must resolve to a public IP address.";
  } catch {
    return "url host could not be resolved.";
  }
  return null;
}

export async function deliver(url: string, secret: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const bad = await checkWebhookUrl(url); // re-checked at send time in case DNS changed
  if (bad) return { ok: false, error: bad };
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  try {
    const res = await fetch(url, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000), cache: "no-store",
      headers: { "Content-Type": "application/json", "User-Agent": "sanctions-monitor-webhooks/1", "X-Webhook-Timestamp": ts, "X-Webhook-Signature": sign(secret, ts, body) },
      body,
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}
