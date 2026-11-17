import { readFileSync } from "node:fs";
import path from "node:path";
import { normalize, skeleton, tokens } from "./normalize";

export type SanctionsEntry = {
  id: string; source: string; type: "individual" | "entity" | "vessel" | "aircraft"; name: string; aliases?: string[];
  dob?: string[]; pob?: string[]; countries?: string[]; addressCountries?: string[]; programs?: string[];
  ids?: { type: string; number: string; country?: string }[]; wallets?: { chain: string; address: string }[]; listedOn?: string; remarks?: string; euReference?: string;
};
export type SourceInfo = { id: string; name: string; publisher: string; url: string; publishedAt: string | null; count: number };

type NameRec = { entry: number; raw: string; toks: string[]; compact: string; primary: boolean };
type Db = { generatedAt: string; contentHash: string; sources: SourceInfo[]; entries: SanctionsEntry[]; names: NameRec[]; index: Map<string, number[]>; byId: Map<string, SanctionsEntry> };

let db: Db | null = null;

// Keys a token is indexed under: 3-letter prefix and phonetic skeleton prefix, so typos in either still retrieve.
const keysFor = (t: string) => (t.length < 2 ? [] : [`p:${t.slice(0, 3)}`, `s:${skeleton(t).slice(0, 4)}`]);

export function loadDb(): Db {
  if (db) return db;
  const file = path.join(process.cwd(), "data", "sanctions.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as { generatedAt: string; contentHash: string; sources: SourceInfo[]; entries: SanctionsEntry[] };
  const names: NameRec[] = [];
  const index = new Map<string, number[]>();
  data.entries.forEach((e, i) => {
    if (e.ids) e.ids = [...new Map(e.ids.map((x) => [`${x.type}|${x.number}`, x])).values()];
    const seen = new Set<string>();
    [e.name, ...(e.aliases ?? [])].forEach((raw, k) => {
      const toks = tokens(raw);
      const key = [...toks].sort().join(" ");
      if (!toks.length || seen.has(key)) return;
      seen.add(key);
      const id = names.push({ entry: i, raw, toks, compact: toks.join(""), primary: k === 0 }) - 1;
      for (const k2 of new Set(toks.flatMap(keysFor))) {
        const list = index.get(k2);
        if (list) list.push(id); else index.set(k2, [id]);
      }
    });
  });
  db = { generatedAt: data.generatedAt, contentHash: data.contentHash, sources: data.sources, entries: data.entries, names, index, byId: new Map(data.entries.map((e) => [e.id, e])) };
  return db;
}

// Jaro-Winkler similarity in [0, 1].
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array(la).fill(false), mb = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(lb, i + range + 1); j++) {
      if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < la; i++) if (ma[i]) { while (!mb[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < Math.min(4, la, lb) && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

function tokenSim(q: string, c: string): number {
  if (q === c) return 1;
  if (q.length === 1 || c.length === 1) return q[0] === c[0] ? 0.85 : 0; // initials
  let s = jaroWinkler(q, c);
  if (Math.min(q.length, c.length) <= 3) s *= 0.8; // short tokens ("al" vs "ali") look alike too easily
  // A name that merely starts another (Vladimir vs Vladimirovna, a patronymic) is a different name.
  if (Math.abs(q.length - c.length) >= 3 && (q.startsWith(c) || c.startsWith(q))) s *= 0.85;
  // Keep close spellings (Kadirov/Kadyrov) strong; push looser resemblances (Miller/Mayer) down.
  return s >= 0.92 ? s : s - (0.92 - s) * 0.6;
}

// Directional coverage: how well each token of `from` is matched by some token of `to`, weighted by token length.
function coverage(from: string[], to: string[]): number {
  let sum = 0, w = 0;
  for (const f of from) {
    let best = 0;
    for (const t of to) { const s = tokenSim(f, t); if (s > best) best = s; if (best === 1) break; }
    const weight = Math.min(f.length, 8);
    sum += (best >= 0.75 ? best : best * 0.5) * weight;
    w += weight;
  }
  return w ? sum / w : 0;
}

export function nameScore(q: string[], qCompact: string, c: NameRec): number {
  // Every query token must be found; extra candidate tokens (middle names, patronymics) cost only a little.
  const qCov = coverage(q, c.toks);
  const tokenScore = qCov * (0.85 + 0.15 * coverage(c.toks, q));
  // Only when token counts differ, compare names with spaces removed to catch "al zumar" vs "alzumar".
  const compactScore = q.length !== c.toks.length && Math.abs(qCompact.length - c.compact.length) <= 2
    ? jaroWinkler(qCompact, c.compact) * 0.97 : 0;
  return Math.max(tokenScore, compactScore);
}

const years = (d: string) => {
  if (d.includes("/")) { const [a, b] = d.split("/").map(Number); return { from: a, to: b }; }
  const y = Number(d.slice(0, 4));
  return { from: y, to: y };
};
const cnorm = (s: string) => normalize(s).replace(/^the /, "");
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states", us: "united states", "united states of america": "united states", uk: "united kingdom", gb: "united kingdom",
  "great britain": "united kingdom", "russian federation": "russia", "iran islamic republic of": "iran", "korea north": "north korea",
  dprk: "north korea", "democratic people s republic of korea": "north korea", "syrian arab republic": "syria", uae: "united arab emirates",
};
const canonCountry = (s: string) => { const n = cnorm(s); return COUNTRY_ALIASES[n] ?? n; };

export const DEFAULT_THRESHOLD = 0.88;

export type ScreenQuery = {
  name: string; type?: SanctionsEntry["type"]; dob?: string; country?: string; sources?: string[]; threshold?: number; limit?: number;
};

export function screen(q: ScreenQuery) {
  const d = loadDb();
  const qt = tokens(q.name);
  if (!qt.length) return { matches: [], tokens: qt };
  const qCompact = qt.join("");
  const threshold = Math.min(1, Math.max(0.5, q.threshold ?? DEFAULT_THRESHOLD));
  const sources = q.sources?.length ? new Set(q.sources.map((s) => s.toUpperCase())) : null;

  // Candidate retrieval through the token index; very common keys are skipped when rarer ones exist.
  const keyLists = [...new Set(qt.flatMap(keysFor))].map((k) => d.index.get(k) ?? []).filter((l) => l.length);
  const rare = keyLists.filter((l) => l.length <= 4000);
  const cand = new Set<number>();
  for (const l of rare.length ? rare : keyLists) for (const id of l) cand.add(id);

  const best = new Map<number, { score: number; name: NameRec }>();
  for (const id of cand) {
    const n = d.names[id];
    const e = d.entries[n.entry];
    if (q.type && e.type !== q.type) continue;
    if (sources && !sources.has(e.source)) continue;
    const s = nameScore(qt, qCompact, n);
    const cur = best.get(n.entry);
    if (!cur || s > cur.score) best.set(n.entry, { score: s, name: n });
  }

  const qYear = q.dob ? Number(q.dob.slice(0, 4)) : null;
  const qCountry = q.country ? canonCountry(q.country) : null;
  const matches = [];
  for (const [i, { score, name }] of best) {
    if (score < threshold - 0.1) continue;
    const e = d.entries[i];
    let final = score;
    let dobMatch: boolean | null = null, countryMatch: boolean | null = null;
    if (qYear && e.dob?.length) {
      dobMatch = e.dob.some((x) => { const r = years(x); return qYear >= r.from - 1 && qYear <= r.to + 1; });
      final = dobMatch ? Math.min(1, final + 0.03) : final * 0.8;
    }
    const ec = [...(e.countries ?? []), ...(e.addressCountries ?? [])].map(canonCountry);
    if (qCountry && ec.length) {
      countryMatch = ec.includes(qCountry);
      final = countryMatch ? Math.min(1, final + 0.02) : final * 0.95;
    }
    if (final < threshold) continue;
    matches.push({ entry: e, score: Math.round(final * 1000) / 1000, nameScore: Math.round(score * 1000) / 1000, matchedName: name.raw, matchedPrimaryName: name.primary, dobMatch, countryMatch });
  }
  matches.sort((a, b) => b.score - a.score || (a.matchedPrimaryName === b.matchedPrimaryName ? 0 : a.matchedPrimaryName ? -1 : 1));
  return { matches: matches.slice(0, Math.min(50, Math.max(1, q.limit ?? 10))), tokens: qt, candidatesScanned: cand.size };
}
