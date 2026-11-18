import { SITE_NAME, SITE_URL } from "../site";
import { monitoringConfigured } from "./store";

const SANCTIONS_NAME = `${SITE_NAME} Crypto Compliance API`;
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
    description: "Screen people, companies, vessels and aircraft against the official OFAC (SDN + Consolidated), UN Security Council, EU and UK sanctions lists in one call. Fuzzy, transliteration-aware matching (Latin and Cyrillic), alias coverage, DOB and country filters, and clear/potential/strong decisions. Lists refresh from the official publishers every 6 hours. Ongoing monitoring re-screens your saved names daily against any list changes and alerts you by webhook.",
  },
  servers: [{ url: `${SITE_URL}/api/v1` }],
  paths: {
    "/sanctions/screen": {
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
    "/sanctions/wallet": {
      get: {
        summary: "Screen a crypto wallet address against OFAC's sanctioned wallets", operationId: "screenWallet", tags: ["Crypto"],
        description: "Exact match against every digital currency address on the OFAC SDN list (Bitcoin, Ethereum and EVM chains, Tron, USDT, Monero, Litecoin, Solana and more). EVM and bech32 addresses match case-insensitively; base58 addresses match exactly.",
        parameters: [qp("address", "Wallet address", { type: "string" }, "0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB", true)],
        responses: { ...ok({ $ref: "#/components/schemas/WalletResult" }), ...errors({ "400": "Invalid address" }) },
      },
      post: {
        summary: "Screen a crypto wallet address (JSON body)", operationId: "screenWalletPost", tags: ["Crypto"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["address"], properties: { address: { type: "string" } } } } } },
        responses: { ...ok({ $ref: "#/components/schemas/WalletResult" }), ...errors({ "400": "Invalid address" }) },
      },
    },
    "/sanctions/wallets/batch": {
      post: {
        summary: "Screen many wallet addresses (Pro: 25 per call, Ultra and Mega: 100)", operationId: "screenWalletsBatch", tags: ["Crypto"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["addresses"], properties: { addresses: { type: "array", maxItems: 100, items: { type: "string" } } } } } } },
        responses: { ...ok({ type: "object", properties: { summary: { type: "object", properties: { submitted: { type: "integer" }, screened: { type: "integer" }, failed: { type: "integer" }, sanctioned: { type: "integer" } } }, results: { type: "array", items: { $ref: "#/components/schemas/WalletResult" } } } }), ...errors({ "400": "Invalid body", "403": "Plan upgrade required" }) },
      },
    },
    "/xrpl/preflight": {
      get: {
        summary: "Payment Pre-flight (1 credit): will this XRP or token payment succeed?", operationId: "xrplPreflight", tags: ["XRPL Payments"],
        description: "Predicts the ledger result before signing: destination tag required (tecDST_TAG_NEEDED), unactivated recipient below reserve (tecNO_DST_INSUF_XRP), missing or full trust line (tecPATH_DRY / tecPATH_PARTIAL), frozen or unauthorized lines, deposit authorization (tecNO_PERMISSION), unfunded sender (tecUNFUNDED_PAYMENT), issuer transfer fees, and OFAC screening of both parties.",
        parameters: [qp("to", "Recipient address", { type: "string" }, "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv", true), qp("amount", "Amount (XRP, or token units)", { type: "string" }, "25", true),
          qp("currency", "XRP or a token code", { type: "string" }, "XRP"), qp("issuer", "Token issuer (required unless XRP)", { type: "string" }),
          qp("destinationTag", "Destination tag", { type: "integer" }, 12345), qp("from", "Sender address (enables balance and deposit-auth checks)", { type: "string" })],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["will_succeed", "will_succeed_with_warnings", "will_fail"] }, checks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["pass", "warn", "fail"] }, message: { type: "string" }, ledgerResult: { type: "string" } } } }, validatedLedgerIndex: { type: "integer" } } }), ...errors({ "400": "Invalid parameters", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/verify": {
      get: {
        summary: "Settlement Verify (1 credit): did I really get paid? Partial payments and counterfeit tokens", operationId: "xrplVerify", tags: ["XRPL Payments"],
        description: "Given a transaction hash and what you expected, reports what was actually delivered (meta.delivered_amount), flags partial payments, counterfeit tokens (a major asset code from an issuer that fails xrp-ledger.toml verification), unvalidated or failed transactions, wrong destination or tag, and sanctioned senders. Verdict: settled, settled_with_warnings or not_settled.",
        parameters: [qp("tx", "Transaction hash", { type: "string" }, undefined, true), qp("expectTo", "Your receiving address", { type: "string" }), qp("expectDestinationTag", "Expected destination tag", { type: "integer" }),
          qp("expectAmount", "Minimum expected amount", { type: "string" }), qp("expectCurrency", "Expected currency (XRP or token code)", { type: "string" }, "RLUSD"), qp("expectIssuer", "Expected token issuer", { type: "string" }, "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De")],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["settled", "settled_with_warnings", "not_settled"] }, findings: { type: "array", items: { type: "object" } }, payment: { type: "object" }, issuer: { type: "object", nullable: true } } }), ...errors({ "400": "Invalid parameters", "404": "Transaction not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/token": {
      get: {
        summary: "Token Risk Report (3 credits): A-F grade for any XRPL token", operationId: "xrplToken", tags: ["XRPL Tokens"],
        description: "Issuer powers (freeze, clawback, transfer fee, blackholed), identity verified through the issuer's xrp-ledger.toml, XRP AMM pool depth and order books, circulating supply, NOSHASHI's issuer authority certificate, and OFAC screening of the issuer and its funding account, with a transparent scoring methodology.",
        parameters: [qp("currency", "Token code", { type: "string" }, "RLUSD", true), qp("issuer", "Issuer address", { type: "string" }, "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", true)],
        responses: { ...ok({ type: "object", properties: { grade: { type: "string", enum: ["A", "B", "C", "D", "F"] }, score: { type: "integer" }, factors: { type: "array", items: { type: "object" } }, issuer: { type: "object" }, liquidity: { type: "object" }, noshashiCertificate: { type: "object", nullable: true }, sanctions: { type: "object" }, methodology: { type: "string" } } }), ...errors({ "400": "Invalid parameters", "404": "Issuer not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/control": {
      get: {
        summary: "Account Control Audit (2 credits): who can sign, and did that change recently?", operationId: "controlAudit", tags: ["XRPL Account Security"],
        description: "Master key, regular key and multi-signing setup, plus every control change (SetRegularKey, SignerListSet, master key disabled or re-enabled) in recent history. A recent change is flagged as a takeover signal; signers on the OFAC list are blocked.",
        parameters: [qp("address", "XRPL classic address", { type: "string" }, "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", true)],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["clear", "review", "block"] }, findings: { type: "array", items: { type: "object", properties: { id: { type: "string" }, severity: { type: "string" }, message: { type: "string" } } } } } }), ...errors({ "400": "Invalid address", "404": "Account not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/inbox": {
      get: {
        summary: "Inbox Threat Scan (2 credits): address poisoning, phishing memos, dust spam", operationId: "inboxScan", tags: ["XRPL Account Security"],
        description: "Scans recent incoming transactions for address-poisoning attempts (senders imitating the first and last characters of addresses this account has paid), links in memos, dust spam and OFAC-listed senders.",
        parameters: [qp("address", "XRPL classic address", { type: "string" }, "rKyvBTU7UqAoHbQe3jgZee2W1SxgrK6b7m", true)],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["clear", "review", "block"] }, findings: { type: "array", items: { type: "object", properties: { id: { type: "string" }, severity: { type: "string" }, message: { type: "string" } } } } } }), ...errors({ "400": "Invalid address", "404": "Account not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/trustlines": {
      get: {
        summary: "Trust Line Audit (2 credits): recoverable reserve and risky holdings", operationId: "trustlineAudit", tags: ["XRPL Account Security"],
        description: "Lists empty trust lines that can be removed to release owner reserve, and flags holdings of look-alike tokens (major asset codes from unverified issuers), frozen lines, clawback-capable and OFAC-listed issuers.",
        parameters: [qp("address", "XRPL classic address", { type: "string" }, "rKyvBTU7UqAoHbQe3jgZee2W1SxgrK6b7m", true)],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["clear", "review", "block"] }, findings: { type: "array", items: { type: "object", properties: { id: { type: "string" }, severity: { type: "string" }, message: { type: "string" } } } } } }), ...errors({ "400": "Invalid address", "404": "Account not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/escrows": {
      get: {
        summary: "Escrow Unlock Calendar (1 credit): upcoming escrow releases", operationId: "escrowCalendar", tags: ["XRPL Account Security"],
        description: "Every escrow on an account with amounts, releasable-from and expiry dates, conditional flags, the next release and XRP releasable per month.",
        parameters: [qp("address", "XRPL classic address", { type: "string" }, "r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp", true)],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["clear", "review", "block"] }, findings: { type: "array", items: { type: "object", properties: { id: { type: "string" }, severity: { type: "string" }, message: { type: "string" } } } } } }), ...errors({ "400": "Invalid address", "404": "Account not found", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/xrpl/check": {
      get: {
        summary: "XRPL Counterparty Check (2 credits): sanctions + ledger state + NOSHASHI issuer certificate", operationId: "xrplCheck", tags: ["XRPL Payments"],
        description: "One verdict (clear / review / block) on an XRP Ledger address: OFAC listing of the address, its funding account and its direct counterparties in the last 200 transactions; account settings (destination tag required, deposit authorization, frozen); and for token issuers, clawback and NOSHASHI's issuer authority certificate with its SHA-256 digest. A check that could not run is reported as review, never clear.",
        parameters: [qp("address", "XRPL classic address", { type: "string" }, "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", true)],
        responses: { ...ok({ type: "object", properties: { verdict: { type: "string", enum: ["clear", "review", "block"] }, findings: { type: "array", items: { type: "object", properties: { code: { type: "string" }, severity: { type: "string", enum: ["block", "review", "info"] }, message: { type: "string" } } } }, sanctions: { type: "object" }, ledger: { type: "object" }, issuer: { type: "object", nullable: true } } }), ...errors({ "400": "Invalid address", "502": "XRPL nodes unavailable" }) },
      },
    },
    "/sanctions/batch": {
      post: {
        summary: "Screen many names in one call (Pro: 25 per call, Ultra and Mega: 100)", operationId: "screenBatch", tags: ["Screening"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["queries"], properties: { queries: { type: "array", maxItems: 100, items: Query } } },
          example: { queries: [{ name: "Vladimir Putin" }, { name: "Jane Doe", dob: "1990-01-01", country: "Canada" }] } } } },
        responses: { ...ok({ type: "object", properties: {
          summary: { type: "object", properties: { submitted: { type: "integer" }, screened: { type: "integer" }, failed: { type: "integer" }, clear: { type: "integer" }, potentialMatches: { type: "integer" }, strongMatches: { type: "integer" } } },
          results: { type: "array", items: { allOf: [{ type: "object", properties: { index: { type: "integer" }, status: { type: "string", enum: ["ok", "error"] }, error: { type: "string" } } }, { $ref: "#/components/schemas/ScreenResult" }] } },
        } }), ...errors({ "400": "Invalid body or too many queries for your plan", "403": "Plan upgrade required" }) },
      },
    },
    "/sanctions/monitors": {
      get: {
        summary: "List monitored names", operationId: "listMonitors", tags: ["Monitoring"],
        parameters: [qp("limit", "Page size (max 500)", { type: "integer" }, 100), qp("offset", "Offset", { type: "integer" }, 0)],
        responses: { ...ok({ type: "object", properties: { total: { type: "integer" }, planLimit: { type: "integer" }, monitors: { type: "array", items: { $ref: "#/components/schemas/Monitor" } } } }), ...errors({ "503": "Monitoring temporarily unavailable" }) },
      },
      post: {
        summary: "Monitor names: screened now, then re-screened daily whenever the lists have changed", operationId: "addMonitors", tags: ["Monitoring"],
        description: "Up to 500 items per call. Re-adding an item with the same externalId updates it. Plan limits: Basic 10, Pro 1,000, Ultra 25,000, Mega 250,000 monitored names.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["items"], properties: { items: { type: "array", maxItems: 500, items: { allOf: [Query, { type: "object", properties: { externalId: { type: "string", description: "Your own customer ID" } } }] } } } },
          example: { items: [{ name: "Jane Doe", externalId: "cust-1042", dob: "1985-04-12", country: "Canada" }] } } } },
        responses: { ...ok({ type: "object", properties: { added: { type: "integer" }, results: { type: "array", items: { type: "object", properties: { monitor: { $ref: "#/components/schemas/Monitor" }, currentScreening: { type: "object" } } } } } }), ...errors({ "400": "Invalid items", "403": "Monitor limit reached for your plan" }) },
      },
    },
    "/sanctions/monitors/{id}": {
      get: { summary: "Get a monitored name", operationId: "getMonitor", tags: ["Monitoring"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { ...ok({ $ref: "#/components/schemas/Monitor" }), ...errors({ "404": "Not found" }) } },
      delete: { summary: "Stop monitoring a name", operationId: "deleteMonitor", tags: ["Monitoring"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { ...ok({ type: "object", properties: { deleted: { type: "string" } } }), ...errors({ "404": "Not found" }) } },
    },
    "/sanctions/alerts": {
      get: {
        summary: "Alerts: a monitored name newly matches a list, or a match was delisted", operationId: "listAlerts", tags: ["Monitoring"],
        description: "Poll with after=<last alert id you processed>. Alerts are also pushed to your webhook if one is set.",
        parameters: [qp("after", "Return alerts with id greater than this", { type: "integer" }, 0), qp("limit", "Max alerts (max 500)", { type: "integer" }, 100)],
        responses: { ...ok({ type: "object", properties: { count: { type: "integer" }, nextAfter: { type: "integer" }, alerts: { type: "array", items: { $ref: "#/components/schemas/Alert" } } } }), ...errors({}) },
      },
    },
    "/sanctions/webhook": {
      get: { summary: "Current webhook URL", operationId: "getWebhook", tags: ["Monitoring"], responses: { ...ok({ type: "object", properties: { url: { type: "string", nullable: true } } }), ...errors({}) } },
      put: {
        summary: "Set the HTTPS URL that receives alerts (returns a signing secret)", operationId: "setWebhook", tags: ["Monitoring"],
        description: "Deliveries are POSTs of {type: 'sanctions.alerts', alerts: [...]} with X-Webhook-Timestamp and X-Webhook-Signature (sha256=HMAC-SHA256 of `${timestamp}.${body}`). Failed deliveries are retried up to 6 times.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri" } } } } } },
        responses: { ...ok({ type: "object", properties: { url: { type: "string" }, signingSecret: { type: "string" } } }), ...errors({ "400": "URL must be public HTTPS" }) },
      },
      delete: { summary: "Remove the webhook", operationId: "deleteWebhook", tags: ["Monitoring"], responses: { ...ok({ type: "object", properties: { deleted: { type: "boolean" } } }), ...errors({}) } },
    },
    "/sanctions/entities/{id}": {
      get: {
        summary: "Full sanctions record, including every alias", operationId: "getEntity", tags: ["Records"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "ofac_sdn-35096" }],
        responses: { ...ok({ $ref: "#/components/schemas/Record" }), ...errors({ "404": "Not found" }) },
      },
    },
    "/sanctions/lists": {
      get: {
        summary: "Lists covered, record counts and publication dates", operationId: "getLists", tags: ["Records"],
        responses: { ...ok({ type: "object", properties: { dataGeneratedAt: { type: "string", format: "date-time" }, totalRecords: { type: "integer" },
          sources: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, publisher: { type: "string" }, url: { type: "string" }, publishedAt: { type: "string" }, count: { type: "integer" } } } } } }), ...errors({}) },
      },
    },
  },
  security: [{ ApiKey: [] }],
  components: {
    securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "X-API-Key", description: "Prepaid credit key bought with XRP or RLUSD on the XRP Ledger, or USDC on Base or Ethereum: GET /api/v1/billing/info. Marketplace subscribers use the marketplace's own key instead." } },
    schemas: {
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } },
      Monitor: { type: "object", properties: {
        id: { type: "string", format: "uuid" }, externalId: { type: "string", nullable: true }, name: { type: "string" }, type: { type: "string", nullable: true },
        dob: { type: "string", nullable: true }, country: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" },
        lastScreenedAt: { type: "string", format: "date-time" }, lastDecision: { type: "string", enum: ["clear", "potential_match", "strong_match"] },
        currentMatchIds: { type: "array", items: { type: "string" } }, upToDate: { type: "boolean", description: "Screened against the current list snapshot" },
      } },
      Alert: { type: "object", properties: {
        id: { type: "integer" }, kind: { type: "string", enum: ["new_match", "match_removed"] }, monitorId: { type: "string" }, externalId: { type: "string", nullable: true },
        monitoredName: { type: "string" }, match: { type: "object", description: "Full match (new_match) or {id} (match_removed)" }, listsVersion: { type: "string" },
        createdAt: { type: "string", format: "date-time" }, webhookDelivered: { type: "boolean" },
      } },
      Record: { type: "object", properties: {
        id: { type: "string" }, source: { type: "string" }, sourceName: { type: "string" }, type: { type: "string" }, name: { type: "string" },
        aliases: { type: "array", items: { type: "string" } }, aliasCount: { type: "integer" }, datesOfBirth: { type: "array", items: { type: "string" } },
        placesOfBirth: { type: "array", items: { type: "string" } }, nationalities: { type: "array", items: { type: "string" } },
        addressCountries: { type: "array", items: { type: "string" } }, programs: { type: "array", items: { type: "string" } },
        walletAddresses: { type: "array", items: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" } } } },
        identifiers: { type: "array", items: { type: "object", properties: { type: { type: "string" }, number: { type: "string" }, country: { type: "string" } } } },
        listedOn: { type: "string", nullable: true }, remarks: { type: "string", nullable: true }, sourceUrl: { type: "string" },
      } },
      WalletResult: { type: "object", properties: {
        screeningId: { type: "string", format: "uuid" }, screenedAt: { type: "string", format: "date-time" }, address: { type: "string" },
        addressFormat: { type: "string", enum: ["evm", "bitcoin", "tron", "litecoin", "monero", "solana-or-base58", "unknown"] },
        sanctioned: { type: "boolean" }, decision: { type: "string", enum: ["clear", "sanctioned"] }, listsVersion: { type: "string" }, coverage: { type: "string" },
        matches: { type: "array", items: { allOf: [{ type: "object", properties: { listedChain: { type: "string" }, listedAddress: { type: "string" } } }, { $ref: "#/components/schemas/Record" }] } },
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

// One OpenAPI document per marketplace listing (each listing is found by different searches).
const LISTINGS = {
  sanctions: { title: `${SITE_NAME} Sanctions & Crypto Wallet Screening API`, prefix: "/sanctions/",
    description: "Screen people, companies, vessels and crypto wallets against OFAC (SDN + Consolidated), UN, EU and UK sanctions lists in one call, with fuzzy multilingual matching, DOB and country filters, batch screening, and daily monitoring with signed webhook alerts. Lists refresh every 6 hours." },
  "xrpl-payments": { title: `${SITE_NAME} XRPL Payment Safety API`, paths: ["/xrpl/preflight", "/xrpl/verify", "/xrpl/check", "/xrpl/check/batch"],
    description: "Stop failed and fraudulent XRP Ledger payments. Pre-flight predicts whether a payment will succeed before you sign it; Settlement Verify confirms what you were actually paid, catching partial payments and counterfeit tokens; Counterparty Check screens any address, its funder and its recent counterparties against OFAC." },
  "xrpl-security": { title: `${SITE_NAME} XRPL Account Security API`, paths: ["/xrpl/control", "/xrpl/inbox", "/xrpl/trustlines", "/xrpl/escrows"],
    description: "Security checks for XRP Ledger accounts: who can sign and whether control changed recently (takeover signal), address-poisoning and phishing-memo detection, trust-line audits that find recoverable XRP reserve and look-alike tokens, and escrow unlock calendars." },
  "xrpl-tokens": { title: `${SITE_NAME} XRPL Token Risk API`, paths: ["/xrpl/token"],
    description: "Grade any XRP Ledger token A to F: issuer powers (freeze, clawback, fees, blackholed), verified issuer identity, AMM and order-book liquidity, supply, NOSHASHI's authority certificate, and sanctions on the issuer and its funder." },
} as const;
export type ListingId = keyof typeof LISTINGS | "all";
export const LISTING_IDS = ["all", ...Object.keys(LISTINGS)] as ListingId[];

// Monitoring endpoints only appear in published specs once their database is configured,
// so marketplace buyers never see endpoints that would answer "not enabled yet".
const MONITORING_PATHS = ["/sanctions/monitors", "/sanctions/monitors/{id}", "/sanctions/alerts", "/sanctions/webhook"];

export function specFor(id: ListingId) {
  const live = monitoringConfigured();
  const keep = (p: string) => live || !MONITORING_PATHS.includes(p);
  if (id === "all") return { ...sanctionsOpenapi, paths: Object.fromEntries(Object.entries(sanctionsOpenapi.paths).filter(([p]) => keep(p))) };
  const l = LISTINGS[id];
  const paths = Object.fromEntries(Object.entries(sanctionsOpenapi.paths).filter(([p]) => keep(p) && ("prefix" in l ? p.startsWith(l.prefix) : (l.paths as readonly string[]).includes(p))));
  // Per-listing specs are what marketplaces import. They authenticate with their own key and proxy secret, so the
  // prepaid X-API-Key scheme is left out; otherwise the marketplace console sends that header and the call is
  // routed to crypto billing instead of the marketplace subscription.
  const { security: _s, ...base } = sanctionsOpenapi;
  const { securitySchemes: _ss, ...components } = sanctionsOpenapi.components;
  return { ...base, components, info: { ...sanctionsOpenapi.info, title: l.title, description: live ? l.description : l.description.replace(", batch screening, and daily monitoring with signed webhook alerts", " and batch screening") }, paths };
}
