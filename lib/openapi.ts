import { SITE_NAME, SITE_URL } from "./site";

const err = { $ref: "#/components/schemas/Error" };
const resp = (schema: object, extra: Record<string, string> = {}) => ({
  "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: schema, meta: { $ref: "#/components/schemas/Meta" } } } } } },
  ...Object.fromEntries(Object.entries({ "401": "Missing or invalid credentials", "502": "NHTSA temporarily unavailable", ...extra })
    .map(([k, d]) => [k, { description: d, content: { "application/json": { schema: err } } }])),
});
const q = (name: string, description: string, example: string | number, type = "string") =>
  ({ name, in: "query", required: true, description, schema: { type }, example });

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: `${SITE_NAME} Vehicle Safety API`,
    version: "1.0.0",
    description: "Vehicle recalls, owner complaints, NHTSA 5-Star crash ratings and VIN decoding in one call, from live U.S. NHTSA data, normalized to clean JSON (ISO dates, booleans, numbers) and refreshed every 6 hours.",
  },
  servers: [{ url: `${SITE_URL}/api/v1` }],
  paths: {
    "/vin/{vin}": {
      get: {
        summary: "Full safety report for a VIN", operationId: "getVinReport", tags: ["Reports"],
        description: "Decodes the VIN, then returns recalls, complaint statistics and crash ratings for that year/make/model.",
        parameters: [{ name: "vin", in: "path", required: true, schema: { type: "string", pattern: "^[A-HJ-NPR-Z0-9]{17}$" }, example: "1HGCV1F30JA000000" }],
        responses: resp({ $ref: "#/components/schemas/VinReport" }, { "400": "Invalid VIN", "404": "VIN could not be decoded" }),
      },
    },
    "/vehicle": {
      get: {
        summary: "Full safety report for a year/make/model", operationId: "getVehicleReport", tags: ["Reports"],
        parameters: [q("year", "Model year", 2018, "integer"), q("make", "Make, e.g. HONDA", "HONDA"), q("model", "Model, e.g. ACCORD", "ACCORD")],
        responses: resp({ $ref: "#/components/schemas/VehicleReport" }, { "400": "Missing or invalid parameters" }),
      },
    },
    "/recalls/{campaign}": {
      get: {
        summary: "Recall campaign details and every affected vehicle", operationId: "getRecall", tags: ["Recalls"],
        parameters: [{ name: "campaign", in: "path", required: true, schema: { type: "string", pattern: "^[0-9]{2}[A-Z][0-9]{6}$" }, example: "20V314000" }],
        responses: resp({ allOf: [{ $ref: "#/components/schemas/Recall" }, { type: "object", properties: { affectedVehicles: { type: "array", items: { $ref: "#/components/schemas/Vehicle" } } } }] }, { "400": "Invalid campaign number", "404": "Not found" }),
      },
    },
    "/makes": {
      get: {
        summary: "Makes with recalls for a model year", operationId: "listMakes", tags: ["Lookup"],
        parameters: [q("year", "Model year", 2024, "integer")],
        responses: resp({ type: "object", properties: { year: { type: "integer" }, count: { type: "integer" }, makes: { type: "array", items: { type: "string" } } } }, { "400": "Invalid year" }),
      },
    },
    "/models": {
      get: {
        summary: "Models with recalls for a year and make", operationId: "listModels", tags: ["Lookup"],
        parameters: [q("year", "Model year", 2024, "integer"), q("make", "Make", "TOYOTA")],
        responses: resp({ type: "object", properties: { year: { type: "integer" }, make: { type: "string" }, count: { type: "integer" }, models: { type: "array", items: { type: "string" } } } }, { "400": "Invalid parameters" }),
      },
    },
  },
  components: {
    schemas: {
      Meta: { type: "object", properties: { source: { type: "string" }, generatedAt: { type: "string", format: "date-time" } } },
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } },
      Vehicle: { type: "object", properties: { year: { type: "integer" }, make: { type: "string" }, model: { type: "string" } } },
      Recall: {
        type: "object",
        properties: {
          campaignNumber: { type: "string" }, manufacturer: { type: "string" }, component: { type: "string" },
          summary: { type: "string" }, consequence: { type: "string" }, remedy: { type: "string" }, notes: { type: "string", nullable: true },
          reportDate: { type: "string", format: "date", nullable: true },
          doNotDrive: { type: "boolean", description: "NHTSA 'park it' advisory: do not drive until repaired" },
          parkOutside: { type: "boolean", description: "Fire risk: park outside and away from structures" },
          overTheAirFix: { type: "boolean" }, unitsAffected: { type: "integer", nullable: true },
        },
      },
      VehicleReport: {
        type: "object",
        properties: {
          vehicle: { $ref: "#/components/schemas/Vehicle" },
          recalls: { type: "object", properties: { count: { type: "integer" }, urgentCount: { type: "integer" }, items: { type: "array", items: { $ref: "#/components/schemas/Recall" } } } },
          complaints: {
            type: "object",
            properties: {
              total: { type: "integer" }, crashes: { type: "integer" }, fires: { type: "integer" }, injuries: { type: "integer" }, deaths: { type: "integer" },
              topComponents: { type: "array", items: { type: "object", properties: { component: { type: "string" }, count: { type: "integer" } } } },
              recent: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, components: { type: "string" }, summary: { type: "string" }, crash: { type: "boolean" }, fire: { type: "boolean" }, injuries: { type: "integer" }, deaths: { type: "integer" }, incidentDate: { type: "string", format: "date", nullable: true }, filedDate: { type: "string", format: "date", nullable: true } } } },
            },
          },
          safetyRatings: { type: "array", items: { type: "object", properties: { vehicle: { type: "string" }, overall: { type: "number", nullable: true }, frontal: { type: "number", nullable: true }, side: { type: "number", nullable: true }, rollover: { type: "number", nullable: true } } } },
        },
      },
      VinReport: {
        allOf: [
          { type: "object", properties: { vin: { type: "string" }, note: { type: "string" }, decoded: { type: "object", properties: { year: { type: "integer" }, make: { type: "string" }, model: { type: "string" }, trim: { type: "string", nullable: true }, bodyClass: { type: "string", nullable: true }, engine: { type: "string", nullable: true }, fuelType: { type: "string", nullable: true }, plant: { type: "string", nullable: true } } } } },
          { $ref: "#/components/schemas/VehicleReport" },
        ],
      },
    },
  },
};
