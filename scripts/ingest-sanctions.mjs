// Downloads the official sanctions lists and writes data/sanctions.json (one entry per line, stable order,
// so daily git diffs stay small). Run: node scripts/ingest-sanctions.mjs [--from-dir <dir with saved XML>]
import { XMLParser } from "fast-xml-parser";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const SOURCES = [
  { id: "OFAC_SDN", name: "OFAC Specially Designated Nationals (SDN) List", publisher: "U.S. Department of the Treasury",
    url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML", file: "sdn.xml" },
  { id: "OFAC_CONS", name: "OFAC Consolidated (Non-SDN) Sanctions List", publisher: "U.S. Department of the Treasury",
    url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONSOLIDATED.XML", file: "cons.xml" },
  { id: "UN", name: "UN Security Council Consolidated List", publisher: "United Nations Security Council",
    url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml", file: "un.xml" },
  { id: "EU", name: "EU Consolidated Financial Sanctions List", publisher: "European Commission",
    url: "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw", file: "eu.xml" },
  { id: "UK", name: "UK Sanctions List", publisher: "UK Foreign, Commonwealth & Development Office",
    url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml", file: "uk.xml" },
];

const fromDir = process.argv.includes("--from-dir") ? process.argv[process.argv.indexOf("--from-dir") + 1] : null;
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, parseTagValue: false, trimValues: true,
  isArray: (name) => ["sdnEntry", "aka", "address", "program", "id", "nationality", "citizenship", "dateOfBirthItem",
    "placeOfBirthItem", "INDIVIDUAL", "ENTITY", "INDIVIDUAL_ALIAS", "ENTITY_ALIAS", "INDIVIDUAL_ADDRESS", "ENTITY_ADDRESS",
    "INDIVIDUAL_DATE_OF_BIRTH", "INDIVIDUAL_PLACE_OF_BIRTH", "INDIVIDUAL_DOCUMENT", "VALUE", "sanctionEntity", "nameAlias",
    "birthdate", "identification", "regulation", "Designation", "Name", "DOB", "Nationality", "Address", "NonLatinName",
    "Passport", "NationalIdentifier"].includes(name),
});

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const txt = (v) => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v)).replace(/\s+/g, " ").trim();
const uniq = (a) => [...new Set(a.map((x) => txt(x)).filter(Boolean))];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// Normalizes the many date styles in the lists to YYYY, YYYY-MM, YYYY-MM-DD or a YYYY/YYYY range.
function normDate(raw) {
  const s = txt(raw).toLowerCase();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/)) && MONTHS[m[2]]) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  if ((m = s.match(/^([a-z]{3})[a-z]* (\d{4})$/)) && MONTHS[m[1]]) return `${m[2]}-${pad(MONTHS[m[1]])}`;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(?:dd|\d{2})\/(?:mm|\d{2})\/(\d{4})$/))) return m[1];
  if ((m = s.match(/(\d{4})\s*(?:to|-|–)\s*(\d{4})/))) return `${m[1]}/${m[2]}`;
  if ((m = s.match(/\b(1[89]\d{2}|20\d{2})\b/))) return m[1];
  return null;
}
const dates = (list) => uniq(list.map(normDate).filter(Boolean));
const typeOf = (t) => {
  const s = txt(t).toLowerCase();
  return s.startsWith("indiv") || s === "person" || s === "p" ? "individual" : s.startsWith("vessel") || s === "ship" ? "vessel" : s.startsWith("aircraft") ? "aircraft" : "entity";
};
const clip = (s, n = 400) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

function ofac(xml, source) {
  const doc = parser.parse(xml).sdnList;
  const published = normDate(doc.publshInformation?.Publish_Date?.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$1-$2"));
  const entries = arr(doc.sdnEntry).map((e) => {
    const full = (o) => [txt(o.firstName), txt(o.lastName)].filter(Boolean).join(" ");
    const ids = arr(e.idList?.id).filter((i) => !/secondary sanctions|gender|website|email|phone/i.test(txt(i.idType)));
    return {
      id: `${source.id.toLowerCase()}-${txt(e.uid)}`, source: source.id, type: typeOf(e.sdnType), name: full(e),
      aliases: uniq(arr(e.akaList?.aka).map(full)),
      dob: dates(arr(e.dateOfBirthList?.dateOfBirthItem).map((d) => d.dateOfBirth)),
      pob: uniq(arr(e.placeOfBirthList?.placeOfBirthItem).map((d) => d.placeOfBirth)),
      countries: uniq([...arr(e.nationalityList?.nationality).map((n) => n.country), ...arr(e.citizenshipList?.citizenship).map((n) => n.country)]),
      addressCountries: uniq(arr(e.addressList?.address).map((a) => a.country)),
      programs: uniq(arr(e.programList?.program)),
      ids: ids.slice(0, 10).map((i) => ({ type: txt(i.idType), number: txt(i.idNumber), country: txt(i.idCountry) || undefined })),
      remarks: clip(txt(e.remarks)),
    };
  });
  return { entries, published };
}

function un(xml) {
  const doc = parser.parse(xml).CONSOLIDATED_LIST;
  const published = normDate(doc.dateGenerated);
  const name = (e) => [e.FIRST_NAME, e.SECOND_NAME, e.THIRD_NAME, e.FOURTH_NAME].map(txt).filter(Boolean).join(" ");
  const mk = (e, type) => ({
    id: `un-${txt(e.REFERENCE_NUMBER) || txt(e.DATAID)}`, source: "UN", type, name: name(e),
    aliases: uniq([...arr(e.INDIVIDUAL_ALIAS ?? e.ENTITY_ALIAS).map((a) => a.ALIAS_NAME), e.NAME_ORIGINAL_SCRIPT]),
    dob: dates(arr(e.INDIVIDUAL_DATE_OF_BIRTH).flatMap((d) =>
      d.DATE ? [d.DATE] : d.YEAR ? [d.YEAR] : d.FROM_YEAR ? [`${txt(d.FROM_YEAR)} to ${txt(d.TO_YEAR) || txt(d.FROM_YEAR)}`] : [])),
    pob: uniq(arr(e.INDIVIDUAL_PLACE_OF_BIRTH).map((p) => [txt(p.CITY), txt(p.STATE_PROVINCE), txt(p.COUNTRY)].filter(Boolean).join(", "))),
    countries: uniq(arr(e.NATIONALITY?.VALUE)),
    addressCountries: uniq(arr(e.INDIVIDUAL_ADDRESS ?? e.ENTITY_ADDRESS).map((a) => a.COUNTRY)),
    programs: uniq([e.UN_LIST_TYPE]),
    ids: arr(e.INDIVIDUAL_DOCUMENT).filter((d) => txt(d.NUMBER)).slice(0, 10)
      .map((d) => ({ type: txt(d.TYPE_OF_DOCUMENT), number: txt(d.NUMBER), country: txt(d.ISSUING_COUNTRY) || undefined })),
    listedOn: normDate(e.LISTED_ON),
    remarks: clip(txt(e.COMMENTS1)),
  });
  const entries = [...arr(doc.INDIVIDUALS?.INDIVIDUAL).map((e) => mk(e, "individual")), ...arr(doc.ENTITIES?.ENTITY).map((e) => mk(e, "entity"))];
  return { entries, published };
}

function eu(xml) {
  const doc = parser.parse(xml).export;
  const published = normDate(doc.generationDate);
  const entries = arr(doc.sanctionEntity).map((e) => {
    const names = uniq(arr(e.nameAlias).map((n) => n.wholeName || [n.firstName, n.middleName, n.lastName].filter(Boolean).join(" ")));
    return {
      id: `eu-${e.logicalId}`, source: "EU", type: typeOf(e.subjectType?.code), name: names[0] || "", aliases: names.slice(1),
      dob: dates(arr(e.birthdate).map((b) => b.birthdate || b.year)),
      pob: uniq(arr(e.birthdate).map((b) => [b.city, b.place, b.countryDescription].filter((x) => x && x !== "UNKNOWN").join(", "))),
      countries: uniq(arr(e.citizenship).map((c) => c.countryDescription).filter((c) => c !== "UNKNOWN")),
      addressCountries: uniq(arr(e.address).map((a) => a.countryDescription).filter((c) => c && c !== "UNKNOWN")),
      programs: uniq(arr(e.regulation).map((r) => r.programme)),
      ids: arr(e.identification).filter((i) => i.number).slice(0, 10)
        .map((i) => ({ type: txt(i.identificationTypeDescription), number: txt(i.number), country: txt(i.countryDescription) || undefined })),
      listedOn: normDate(arr(e.regulation)[0]?.publicationDate),
      remarks: clip(txt(e.remark)),
      euReference: e.euReferenceNumber || undefined,
    };
  });
  return { entries, published };
}

function uk(xml) {
  const doc = parser.parse(xml).Designations;
  const published = normDate(doc.DateGenerated);
  const entries = arr(doc.Designation).map((d) => {
    const names = arr(d.Names?.Name).map((n) => ({
      full: [n.Name1, n.Name2, n.Name3, n.Name4, n.Name5, n.Name6].map(txt).filter(Boolean).join(" "),
      primary: /^primary name$/i.test(txt(n.NameType)),
    }));
    const primary = names.find((n) => n.primary)?.full || names[0]?.full || "";
    const ind = d.IndividualDetails?.Individual ?? {};
    return {
      id: `uk-${txt(d.UniqueID)}`, source: "UK", type: typeOf(d.IndividualEntityShip), name: primary,
      aliases: uniq([...names.map((n) => n.full), ...arr(d.NonLatinNames?.NonLatinName).map((n) => n.NameNonLatinScript)]).filter((n) => n !== primary),
      dob: dates(arr(ind.DOBs?.DOB)),
      pob: [],
      countries: uniq(arr(ind.Nationalities?.Nationality)),
      addressCountries: uniq(arr(d.Addresses?.Address).map((a) => a.AddressCountry)),
      programs: uniq([txt(d.RegimeName).replace(/\s*\(Sanctions\).*$/i, "").replace(/^The /, "")]),
      ids: arr(ind.PassportDetails?.Passport).filter((p) => txt(p.PassportNumber)).slice(0, 10)
        .map((p) => ({ type: "Passport", number: txt(p.PassportNumber) })),
      listedOn: normDate(d.DateDesignated),
      remarks: clip(txt(d.OtherInformation)),
    };
  });
  return { entries, published };
}

const PARSE = { OFAC_SDN: (x) => ofac(x, SOURCES[0]), OFAC_CONS: (x) => ofac(x, SOURCES[1]), UN: un, EU: eu, UK: uk };

async function load(src) {
  if (fromDir) return readFileSync(`${fromDir}/${src.file}`, "utf8").replace(/^﻿/, "");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(src.url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.text()).replace(/^﻿/, "");
    } catch (e) {
      if (attempt === 3) throw new Error(`${src.id}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}

const out = { generatedAt: new Date().toISOString(), sources: [], entries: [] };
for (const src of SOURCES) {
  const { entries, published } = PARSE[src.id](await load(src));
  const clean = entries.filter((e) => e.name).map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== "" && v !== null && !(Array.isArray(v) && !v.length))));
  // Refuse to publish a suspiciously small list: a broken download must never shrink the screening data.
  if (clean.length < 100) throw new Error(`${src.id}: only ${clean.length} entries parsed, aborting`);
  out.sources.push({ id: src.id, name: src.name, publisher: src.publisher, url: src.url.replace(/\?token=.*/, ""), publishedAt: published, count: clean.length });
  out.entries.push(...clean.sort((a, b) => a.id.localeCompare(b.id)));
  console.log(`${src.id}: ${clean.length} entries (published ${published})`);
}
mkdirSync("data", { recursive: true });
const entriesText = out.entries.map((e) => JSON.stringify(e)).join(",\n");
// Fingerprint of the records only (not timestamps): monitoring re-screens names only when this changes.
const contentHash = createHash("sha256").update(entriesText).digest("hex").slice(0, 32);
const body = `{"generatedAt":${JSON.stringify(out.generatedAt)},"contentHash":${JSON.stringify(contentHash)},\n"sources":${JSON.stringify(out.sources)},\n"entries":[\n${entriesText}\n]}\n`;
writeFileSync("data/sanctions.json", body);
console.log(`wrote data/sanctions.json: ${out.entries.length} entries, ${(body.length / 1e6).toFixed(1)} MB`);
