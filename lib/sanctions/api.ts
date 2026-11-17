import { randomUUID } from "node:crypto";
import { DEFAULT_THRESHOLD, loadDb, screen, type SanctionsEntry, type ScreenQuery } from "./match";

export const DISCLAIMER =
  "Automated screening against official government sanctions lists. A match is a potential match requiring human review, not a determination. You remain responsible for your compliance decisions; this is not legal advice.";

const TYPES = new Set(["individual", "entity", "vessel", "aircraft"]);
const SOURCE_IDS = () => loadDb().sources.map((s) => s.id);

// Validates user input into a ScreenQuery, or returns an error message.
export function parseQuery(raw: Record<string, unknown>): ScreenQuery | string {
  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 200) return "name is required (2-200 characters).";
  const type = raw.type ? String(raw.type).toLowerCase() : undefined;
  if (type && !TYPES.has(type)) return "type must be one of individual, entity, vessel, aircraft.";
  const dob = raw.dob ? String(raw.dob) : undefined;
  if (dob && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(dob)) return "dob must be YYYY, YYYY-MM or YYYY-MM-DD.";
  const sources = raw.sources == null ? undefined
    : (Array.isArray(raw.sources) ? raw.sources : String(raw.sources).split(",")).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  const bad = sources?.find((s) => !SOURCE_IDS().includes(s));
  if (bad) return `Unknown source ${bad}. Valid: ${SOURCE_IDS().join(", ")}.`;
  const threshold = raw.threshold == null || raw.threshold === "" ? undefined : Number(raw.threshold);
  if (threshold !== undefined && !(threshold >= 0.5 && threshold <= 1)) return "threshold must be between 0.5 and 1.";
  const limit = raw.limit == null || raw.limit === "" ? undefined : Number(raw.limit);
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= 50)) return "limit must be an integer from 1 to 50.";
  const country = raw.country ? String(raw.country).slice(0, 80) : undefined;
  return { name, type: type as ScreenQuery["type"], dob, country, sources, threshold, limit };
}

export function formatEntry(e: SanctionsEntry, aliasLimit = 25) {
  const src = loadDb().sources.find((s) => s.id === e.source);
  return {
    id: e.id, source: e.source, sourceName: src?.name, type: e.type, name: e.name,
    aliases: (e.aliases ?? []).slice(0, aliasLimit), aliasCount: e.aliases?.length ?? 0,
    datesOfBirth: e.dob ?? [], placesOfBirth: e.pob ?? [], nationalities: e.countries ?? [], addressCountries: e.addressCountries ?? [],
    programs: e.programs ?? [], identifiers: e.ids ?? [], walletAddresses: e.wallets ?? [], listedOn: e.listedOn ?? null, remarks: e.remarks ?? null,
    euReference: e.euReference ?? undefined, sourceUrl: src?.url,
  };
}

export function runScreen(q: ScreenQuery) {
  const { matches } = screen(q);
  const top = matches[0];
  // Strong: near-identical name and nothing contradicting it. Potential: needs review. Clear: nothing above threshold.
  const decision = !top ? "clear" : top.score >= 0.97 && top.dobMatch !== false && top.countryMatch !== false ? "strong_match" : "potential_match";
  return {
    screeningId: randomUUID(),
    screenedAt: new Date().toISOString(),
    query: { ...q, threshold: q.threshold ?? DEFAULT_THRESHOLD },
    decision,
    matchCount: matches.length,
    matches: matches.map((m) => ({
      score: m.score, nameScore: m.nameScore, matchedName: m.matchedName, dobMatch: m.dobMatch, countryMatch: m.countryMatch,
      ...formatEntry(m.entry, 10),
    })),
    listsVersion: loadDb().generatedAt,
  };
}

export const listsInfo = () => {
  const d = loadDb();
  return { dataGeneratedAt: d.generatedAt, totalRecords: d.entries.length, sources: d.sources };
};
