import { SITE_URL } from "../site";

const SANCTIONS_NAME = process.env.NEXT_PUBLIC_SANCTIONS_NAME || "Sanctions Screening API";
const err = { $ref: "#/components/schemas/Error" };
const errors = (extra: Record<string, string>) => Object.fromEntries(
  Object.entries({ "401": "Missing or invalid credentials", ...extra }).map(([k, d]) => [k, { description: d, content: { "application/json": { schema: err } } }]));
const ok = (schema: object) => ({ "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: schema, meta: { type: "object" }, disclaimer: { type: "string" } } } } } } });
const qp = (name: string, description: string, schema: object, example?: unknown, required = false) => ({ name, in: "query", required, description, schema, ...(example !== undefined ? { example } : {}) });

const Query = {
  type: "object", required: ["name"],
  properties: {
    name: { type: "string", minLength: 2, maxLength: 200, example: "Vladimir Putin" },
    type: { type: "string", enum: ["individual", "entity", "vessel", "aircraft"] },
    dob: { type: "string", description: "YYYY, YYYY-MM or YYYY-MM-DD. Mismatches reduce the score.", example: "1952-10-07" },
    country: { type: "string", description: "Nationality or address country. Mismatches reduce the score.", example: "Russia" },
    sources: { type: "array", items: { type: "string", enum: ["OFAC_SDN", "OFAC_CONS", "UN", "EU", "UK"] } },
    threshold: { type: "number", minimum: 0.5, maximum: 1, default: 0.88 },
    limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  },
};

export const sanctionsOpenapi = {
  openapi: "3.0.3",
  info: {
    title: SANCTIONS_NAME, version: "1.0.0",
    description: "Screen people, companies, vessels and aircraft against the official OFAC (SDN + Consolidated), UN Security Council, EU and UK sanctions lists in one call. Fuzzy, transliteration-aware matching (Latin and Cyrillic), alias coverage, DOB and country filters, and clear/potential/strong decisions. Lists refresh from the official publishers every 6 hours.",
  },
  servers: [{ url: `${SITE_URL}/api/v1/sanctions` }],
  paths: {
    "/screen": {
      get: {
        summary: "Screen one name", operationId: "screenGet", tags: ["Screening"],
        parameters: [qp("name", "Name to screen", { type: "string" }, "Vladimir Putin", true), qp("type", "Restrict to a record type", Query.properties.type),
          qp("dob", "Date of birth", { type: "string" }), qp("country", "Nationality or country", { type: "string" }),
          qp("sources", "Comma-separated list IDs", { type: "string" }, "OFAC_SDN,UN"), qp("threshold", "Minimum score", { type: "number" }), qp("limit", "Max matches", { type: "integer" })],
        responses: { ...ok({ $ref: "#/components/schemas/ScreenResult" }), ...errors({ "400": "Invalid parameters" }) },
      },
      post: {
        summary: "Screen one name (JSON body)", operationId: "screenPost", tags: ["Screening"],
        requestBody: { required: true, content: { "application/json": { schema: Query } } },
        responses: { ...ok({ $ref: "#/components/schemas/ScreenResult" }), ...errors({ "400": "Invalid body" }) },
      },
    },
    "/batch": {
      post: {
        summary: "Screen many names in one call (Growth plan: 25, Business+: 100)", operationId: "screenBatch", tags: ["Screening"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["queries"], properties: { queries: { type: "array", maxItems: 100, items: Query } } },
          example: { queries: [{ name: "Vladimir Putin" }, { name: "Jane Doe", dob: "1990-01-01", country: "Canada" }] } } } },
        responses: { ...ok({ type: "object", properties: {
          summary: { type: "object", properties: { submitted: { type: "integer" }, screened: { type: "integer" }, failed: { type: "integer" }, clear: { type: "integer" }, potentialMatches: { type: "integer" }, strongMatches: { type: "integer" } } },
          results: { type: "array", items: { allOf: [{ type: "object", properties: { index: { type: "integer" }, status: { type: "string", enum: ["ok", "error"] }, error: { type: "string" } } }, { $ref: "#/components/schemas/ScreenResult" }] } },
        } }), ...errors({ "400": "Invalid body or too many queries for your plan", "403": "Plan upgrade required" }) },
      },
    },
    "/entities/{id}": {
      get: {
        summary: "Full sanctions record, including every alias", operationId: "getEntity", tags: ["Records"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "ofac_sdn-35096" }],
        responses: { ...ok({ $ref: "#/components/schemas/Record" }), ...errors({ "404": "Not found" }) },
      },
    },
    "/lists": {
      get: {
        summary: "Lists covered, record counts and publication dates", operationId: "getLists", tags: ["Records"],
        responses: { ...ok({ type: "object", properties: { dataGeneratedAt: { type: "string", format: "date-time" }, totalRecords: { type: "integer" },
          sources: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, publisher: { type: "string" }, url: { type: "string" }, publishedAt: { type: "string" }, count: { type: "integer" } } } } } }), ...errors({}) },
      },
    },
  },
  components: {
    schemas: {
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } },
      Record: { type: "object", properties: {
        id: { type: "string" }, source: { type: "string" }, sourceName: { type: "string" }, type: { type: "string" }, name: { type: "string" },
        aliases: { type: "array", items: { type: "string" } }, aliasCount: { type: "integer" }, datesOfBirth: { type: "array", items: { type: "string" } },
        placesOfBirth: { type: "array", items: { type: "string" } }, nationalities: { type: "array", items: { type: "string" } },
        addressCountries: { type: "array", items: { type: "string" } }, programs: { type: "array", items: { type: "string" } },
        identifiers: { type: "array", items: { type: "object", properties: { type: { type: "string" }, number: { type: "string" }, country: { type: "string" } } } },
        listedOn: { type: "string", nullable: true }, remarks: { type: "string", nullable: true }, sourceUrl: { type: "string" },
      } },
      ScreenResult: { type: "object", properties: {
        screeningId: { type: "string", format: "uuid", description: "Store this for your audit trail" }, screenedAt: { type: "string", format: "date-time" },
        query: Query, decision: { type: "string", enum: ["clear", "potential_match", "strong_match"] }, matchCount: { type: "integer" },
        listsVersion: { type: "string", format: "date-time", description: "When the list snapshot used for this screening was fetched" },
        matches: { type: "array", items: { allOf: [{ type: "object", properties: { score: { type: "number" }, nameScore: { type: "number" }, matchedName: { type: "string" }, dobMatch: { type: "boolean", nullable: true }, countryMatch: { type: "boolean", nullable: true } } }, { $ref: "#/components/schemas/Record" }] } },
      } },
    },
  },
};
