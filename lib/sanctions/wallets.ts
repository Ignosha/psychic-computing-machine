import { randomUUID } from "node:crypto";
import { loadDb, type SanctionsEntry } from "./match";
import { formatEntry } from "./api";

// EVM hex and bech32 addresses are case-insensitive; base58 (Bitcoin legacy, Tron, Solana, Monero) is case-sensitive.
const stripScheme = (raw: string) => raw.trim().replace(/^(ethereum|bitcoin|tron):/i, "");

export function normalizeAddress(raw: string): string {
  const a = stripScheme(raw);
  if (/^0x[0-9a-f]{40}$/i.test(a)) return a.toLowerCase();
  if (/^(bc1|tb1|ltc1|bitcoincash:|q[pq][0-9a-z]{38,})/i.test(a)) return a.toLowerCase();
  return a;
}

export function addressFormat(a: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm"; // Ethereum, Base, Arbitrum, BSC, Polygon, ...
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return "bitcoin";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
  if (/^(ltc1|[LM])[a-zA-HJ-NP-Z0-9]{26,62}$/.test(a)) return "litecoin";
  if (/^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/.test(a)) return "monero";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "solana-or-base58";
  return "unknown";
}

let index: Map<string, { entry: SanctionsEntry; chain: string; address: string }[]> | null = null;
let indexFor = "";
function walletIndex() {
  const d = loadDb();
  if (index && indexFor === d.contentHash) return index;
  index = new Map();
  for (const e of d.entries) for (const w of e.wallets ?? []) {
    const k = normalizeAddress(w.address);
    index.set(k, [...(index.get(k) ?? []), { entry: e, chain: w.chain, address: w.address }]);
  }
  indexFor = d.contentHash;
  return index;
}

export const walletCount = () => { let n = 0; for (const l of walletIndex().values()) n += l.length; return n; };

export function validAddress(raw: unknown): string | null {
  const a = String(raw ?? "").trim();
  if (a.length < 20 || a.length > 120 || !/^[a-zA-Z0-9:]+$/.test(a)) return null;
  return a;
}

export function screenWallet(address: string) {
  const hits = walletIndex().get(normalizeAddress(address)) ?? [];
  const d = loadDb();
  return {
    screeningId: randomUUID(),
    screenedAt: new Date().toISOString(),
    address,
    addressFormat: addressFormat(stripScheme(address)),
    sanctioned: hits.length > 0,
    decision: hits.length ? "sanctioned" : "clear",
    matches: hits.map((h) => ({ listedChain: h.chain, listedAddress: h.address, ...formatEntry(h.entry, 10) })),
    listsVersion: d.generatedAt,
    coverage: "Exact match against every digital currency address published on the OFAC SDN list. Does not trace indirect exposure (funds that passed through a sanctioned wallet).",
  };
}
