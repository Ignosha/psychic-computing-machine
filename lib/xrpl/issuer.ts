// Issuer identity and powers. Identity uses the XRP Ledger's two-way domain verification: the account's Domain
// field names a website, and that website's /.well-known/xrp-ledger.toml lists the account. Both must agree.
import { parse } from "smol-toml";
import { checkWebhookUrl } from "../sanctions/webhook";
import { rpc } from "./client";

export const toCurrencyHex = (code: string) => {
  const c = code.trim();
  if (/^[0-9A-Fa-f]{40}$/.test(c)) return c.toUpperCase();
  if (c.length === 3) return c; // standard 3-character code
  if (c.length > 3 && c.length <= 20) return Buffer.from(c, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
  throw new Error("invalid currency code");
};
export const readableCurrency = (c: string) => (/^[0-9A-F]{40}$/i.test(c) ? Buffer.from(c, "hex").toString("utf8").replace(/\0+$/, "") || c : c);
const sameCurrency = (a: string, b: string) => toCurrencyHex(a) === toCurrencyHex(b);

const tomlCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof fetchToml>> }>();

async function fetchToml(domain: string) {
  const url = `https://${domain}/.well-known/xrp-ledger.toml`;
  const bad = await checkWebhookUrl(url); // public HTTPS hosts only
  if (bad) return { url, ok: false as const, reason: `Domain not reachable safely: ${bad}` };
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store", headers: { Accept: "application/toml, text/plain" } });
    if (!res.ok) return { url, ok: false as const, reason: `${url} returned HTTP ${res.status}` };
    const text = (await res.text()).slice(0, 512_000);
    return { url, ok: true as const, data: parse(text) as Record<string, unknown> };
  } catch (e) {
    return { url, ok: false as const, reason: `${url} could not be read or parsed (${(e as Error).message.slice(0, 120)})` };
  }
}

export async function verifyDomain(address: string, domainHex: unknown) {
  const raw = typeof domainHex === "string" ? Buffer.from(domainHex, "hex").toString("utf8").trim() : "";
  const domain = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  // status: verified | not_listed | no_domain (definitive) or unreachable (could not check; never treat as fraud).
  const none = [] as { currency: string; name?: string; assetClass?: string }[];
  if (!domain) return { domain: null, status: "no_domain" as const, verified: false, reason: "The account sets no Domain, so it makes no identity claim.", organization: null, tokens: none };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { domain, status: "no_domain" as const, verified: false, reason: "The account's Domain field is not a valid domain name.", organization: null, tokens: none };
  const cached = tomlCache.get(domain);
  const t = cached && Date.now() - cached.at < 3600_000 ? cached.value : await fetchToml(domain);
  tomlCache.set(domain, { at: Date.now(), value: t });
  if (!t.ok) {
    tomlCache.delete(domain); // don't cache failures
    return { domain, status: "unreachable" as const, verified: false, reason: `Could not check ${domain} right now (${t.reason}). Retry later.`, organization: null, tokens: none };
  }
  return { domain, ...evaluateToml(address, domain, t.data, t.url) };
}

// Pure check of a parsed xrp-ledger.toml against an address (exported for testing).
export function evaluateToml(address: string, domain: string, data: Record<string, unknown>, url: string) {
  const listOf = (k: string) => (Array.isArray(data[k]) ? (data[k] as Record<string, unknown>[]) : []);
  const listed = [...listOf("ISSUERS"), ...listOf("ACCOUNTS")].some((a) => a.address === address);
  const org = (data.ORGANIZATION as Record<string, unknown> | undefined)?.name;
  const tokens = listOf("TOKENS").filter((x) => x.issuer === address)
    .map((x) => ({ currency: String(x.currency ?? ""), name: x.name ? String(x.name) : undefined, assetClass: x.asset_class ? String(x.asset_class) : undefined }));
  return {
    tomlUrl: url, status: listed ? ("verified" as const) : ("not_listed" as const), verified: listed, organization: typeof org === "string" ? org : null, tokens,
    reason: listed ? `${domain} lists this account in its xrp-ledger.toml, and the account names ${domain}.` : `The account names ${domain}, but ${domain}'s xrp-ledger.toml does not list this account. Treat its identity claim as unverified.`,
  };
}

// What the issuer can still do to holders, read from the ledger.
export async function issuerPowers(address: string) {
  const [info, objs] = await Promise.all([
    rpc<{ account_data?: Record<string, unknown>; account_flags?: Record<string, boolean>; ledger_index?: number }>("account_info", { account: address, ledger_index: "validated", signer_lists: true }),
    rpc<{ account_objects?: { LedgerEntryType: string }[] }>("account_objects", { account: address, ledger_index: "validated", type: "signer_list" }).catch(() => ({ account_objects: undefined })),
  ]);
  if (info.error === "actNotFound" || !info.account_data) return null;
  const f = info.account_flags ?? {};
  const ad = info.account_data;
  const hasSigners = (objs.account_objects?.length ?? 0) > 0 || Array.isArray((ad as { signer_lists?: unknown[] }).signer_lists) && ((ad as { signer_lists?: unknown[] }).signer_lists!.length > 0);
  // "Blackholed": master key disabled, no regular key, no signer list. Nobody can ever sign for it again.
  const blackholed = Boolean(f.disableMasterKey) && typeof ad.RegularKey !== "string" && !hasSigners;
  const transferRate = typeof ad.TransferRate === "number" && ad.TransferRate > 1e9 ? (ad.TransferRate - 1e9) / 1e7 : 0; // percent
  return {
    ledgerIndex: info.ledger_index ?? null,
    accountData: ad,
    flags: f,
    blackholed,
    canFreeze: !f.noFreeze,
    globallyFrozen: Boolean(f.globalFreeze),
    canClawback: Boolean(f.allowTrustLineClawback),
    requiresAuthorization: Boolean(f.requireAuthorization),
    transferFeePercent: transferRate,
    regularKeySet: typeof ad.RegularKey === "string",
    multiSign: hasSigners,
  };
}

// Well-known asset codes that impostors copy. A token using one of these from an unverified issuer is a counterfeit risk.
export const IMPERSONATED_CODES = ["USD", "USDT", "USDC", "RLUSD", "EUR", "EURC", "GBP", "BTC", "ETH", "XRP", "SOLO", "CSC", "XAU", "GOLD"];
export const looksLikeMajorAsset = (code: string) => IMPERSONATED_CODES.some((k) => sameCurrency(code, k) || readableCurrency(code).toUpperCase() === k);
