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
    "/defects": {
      get: {
        summary: "Defect signals: unrecalled complaint clusters with trends (Pro plan)", operationId: "getDefectSignals", tags: ["Premium"],
        description: "Finds components that owners repeatedly report problems with but that have no recall for this vehicle, ranked by severity, with a 12-month trend. Pass vin, or year + make + model.",
        parameters: [
          { name: "vin", in: "query", required: false, schema: { type: "string" }, example: "1HGCV1F30JA000000" },
          { name: "year", in: "query", required: false, schema: { type: "integer" } },
          { name: "make", in: "query", required: false, schema: { type: "string" } },
          { name: "model", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: resp({ $ref: "#/components/schemas/DefectReport" }, { "400": "Invalid parameters", "404": "VIN could not be decoded" }),
      },
    },
    "/history": {
      get: {
        summary: "Model-year history with best and worst years (Pro plan)", operationId: "getModelHistory", tags: ["Premium"],
        parameters: [q("make", "Make", "HONDA"), q("model", "Model", "ACCORD"),
          { name: "from", in: "query", required: false, schema: { type: "integer" }, example: 2015 },
          { name: "to", in: "query", required: false, schema: { type: "integer" }, example: 2024 }],
        responses: resp({ $ref: "#/components/schemas/ModelHistory" }, { "400": "Invalid parameters" }),
      },
    },
    "/batch": {
      post: {
        summary: "Fleet & inventory screening for up to 50 VINs (Business plan)", operationId: "batchScreen", tags: ["Premium"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["vins"], properties: { vins: { type: "array", maxItems: 50, items: { type: "string" } } } }, example: { vins: ["1HGCV1F30JA000000", "5YJ3E1EA7KF317000"] } } } },
        responses: resp({ $ref: "#/components/schemas/BatchResult" }, { "400": "Invalid body" }),
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
          remedyType: { type: "string", enum: ["over_the_air", "software", "replace", "inspect", "repair", "refund", "other"] },
          remedyPhased: { type: "boolean", description: "Manufacturer announced a staged rollout of the fix" },
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
          safetyScore: { $ref: "#/components/schemas/SafetyScore" },
          safetyRatings: { type: "array", items: { type: "object", properties: { vehicle: { type: "string" }, overall: { type: "number", nullable: true }, frontal: { type: "number", nullable: true }, side: { type: "number", nullable: true }, rollover: { type: "number", nullable: true } } } },
        },
      },
      SafetyScore: { type: "object", properties: { score: { type: "integer" }, grade: { type: "string", enum: ["A", "B", "C", "D", "F"] }, breakdown: { type: "array", items: { type: "object", properties: { factor: { type: "string" }, value: { type: "number", nullable: true }, points: { type: "integer" } } } }, methodology: { type: "string" } } },
      DefectReport: { type: "object", properties: {
        vehicle: { $ref: "#/components/schemas/Vehicle" }, complaintsTotal: { type: "integer" }, complaintsLast12Months: { type: "integer" },
        recalledComponents: { type: "array", items: { type: "string" } }, methodology: { type: "string" },
        signals: { type: "array", items: { type: "object", properties: { component: { type: "string" }, complaints: { type: "integer" }, last12Months: { type: "integer" }, prior12Months: { type: "integer" }, trend: { type: "string", enum: ["rising", "steady", "falling"] }, crashes: { type: "integer" }, fires: { type: "integer" }, injuries: { type: "integer" }, deaths: { type: "integer" }, severity: { type: "integer" } } } },
      } },
      ModelHistory: { type: "object", properties: {
        make: { type: "string" }, model: { type: "string" }, from: { type: "integer" }, to: { type: "integer" }, methodology: { type: "string" },
        worstYears: { type: "array", items: { type: "integer" } }, bestYears: { type: "array", items: { type: "integer" } },
        years: { type: "array", items: { type: "object", properties: { year: { type: "integer" }, hasData: { type: "boolean" }, tooNewToRank: { type: "boolean" }, recalls: { type: "integer" }, urgentRecalls: { type: "integer" }, complaints: { type: "integer" }, seriousIncidents: { type: "integer" }, deaths: { type: "integer" }, topProblem: { type: "string", nullable: true }, safetyScore: { type: "integer" }, grade: { type: "string" } } } },
      } },
      BatchResult: { type: "object", properties: {
        summary: { type: "object", properties: { submitted: { type: "integer" }, unique: { type: "integer" }, decoded: { type: "integer" }, failed: { type: "integer" }, vehiclesWithRecalls: { type: "integer" }, vehiclesWithUrgentRecalls: { type: "integer" } } },
        results: { type: "array", items: { type: "object", properties: { vin: { type: "string" }, status: { type: "string", enum: ["ok", "error"] }, error: { type: "string" }, vehicle: { type: "object" }, recallCount: { type: "integer" }, urgentCount: { type: "integer" }, urgentCampaigns: { type: "array", items: { type: "object" } }, campaignNumbers: { type: "array", items: { type: "string" } }, safetyScore: { type: "integer" }, grade: { type: "string" } } } },
        note: { type: "string" }, methodology: { type: "string" },
      } },
      VinReport: {
        allOf: [
          { type: "object", properties: { vin: { type: "string" }, note: { type: "string" }, decoded: { type: "object", properties: { year: { type: "integer" }, make: { type: "string" }, model: { type: "string" }, trim: { type: "string", nullable: true }, bodyClass: { type: "string", nullable: true }, engine: { type: "string", nullable: true }, fuelType: { type: "string", nullable: true }, plant: { type: "string", nullable: true } } } } },
          { $ref: "#/components/schemas/VehicleReport" },
        ],
      },
    },
  },
};
