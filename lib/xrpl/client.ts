// Minimal XRPL JSON-RPC client over free public nodes, with failover. Read-only: nothing here signs or submits.
import { createHash } from "node:crypto";

const NODES = (process.env.XRPL_RPC_URLS || "https://xrplcluster.com/,https://s2.ripple.com:51234/,https://s1.ripple.com:51234/")
  .split(",").map((s) => s.trim()).filter(Boolean);

export class XrplError extends Error {
  constructor(message: string, public code = "xrpl_unavailable") { super(message); }
}

// Returns the result object; rippled reports "actNotFound" etc. as result.error, which callers may handle.
export async function rpc<T = Record<string, unknown>>(method: string, params: Record<string, unknown>): Promise<T & { error?: string }> {
  let last = "";
  for (const node of NODES) {
    try {
      const res = await fetch(node, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ method, params: [params] }), signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) { last = `HTTP ${res.status} from ${new URL(node).host}`; continue; }
      const j = (await res.json()) as { result?: T & { error?: string; status?: string } };
      if (!j.result) { last = "empty result"; continue; }
      if (j.result.error && ["tooBusy", "noNetwork", "noCurrent", "slowDown", "notSynced"].includes(j.result.error)) { last = j.result.error; continue; }
      return j.result;
    } catch (e) {
      last = (e as Error).message;
    }
  }
  throw new XrplError(`No public XRPL node answered (${last}).`);
}

// Classic address check: Ripple base58 alphabet, version byte 0x00, double-SHA256 checksum.
const ALPHABET = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
export function isClassicAddress(a: string): boolean {
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) return false;
  let n = 0n;
  for (const ch of a) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return false;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let bytes = Buffer.from(hex, "hex");
  const leading = a.match(/^r*/)![0].length; // 'r' encodes a zero byte
  bytes = Buffer.concat([Buffer.alloc(leading), bytes]);
  if (bytes.length !== 25 || bytes[0] !== 0) return false;
  const sum = createHash("sha256").update(createHash("sha256").update(bytes.subarray(0, 21)).digest()).digest();
  return sum.subarray(0, 4).equals(bytes.subarray(21));
}

export const RLUSD = { currency: "524C555344000000000000000000000000000000", issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" };
export const decodeCurrency = (c: string) =>
  c.length === 40 ? Buffer.from(c, "hex").toString("utf8").replace(/\0+$/, "") || c : c;
