# RecallRadar

Two products in one Next.js app, both on free, official government data:
1. **Sanctions Screening API** (`/api/v1/sanctions`, free search at `/sanctions`, docs at `/sanctions/api`)
2. **Vehicle recall site + Vehicle Safety API** (below)

## Sanctions Screening API
Screens names against **33,000+ records** on five official lists, refreshed every 6 hours:

| List | Publisher |
|---|---|
| OFAC SDN + OFAC Consolidated (Non-SDN) | U.S. Department of the Treasury |
| UN Security Council Consolidated List | United Nations |
| EU Consolidated Financial Sanctions List | European Commission |
| UK Sanctions List | UK FCDO |

**Matching** (`lib/sanctions/`): Unicode and Cyrillic transliteration, legal-suffix removal (LLC, OOO, PJSC…), token-level Jaro-Winkler with reorder handling, alias coverage, middle-name tolerance, plus DOB and country filters. Measured on 400 random real listed names: 100% found exact, 100% reordered, 99.8% with a typo, 100% with first + last name only. Innocent common names (John Smith, Michael Johnson, Sarah Thompson…) return no matches.

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/v1/sanctions/screen` | Screen one name (`name`, optional `type`, `dob`, `country`, `sources`, `threshold`, `limit`) |
| `POST /api/v1/sanctions/batch` | Screen many names (Growth: 25, Business/Enterprise: 100 per call) |
| `GET /api/v1/sanctions/entities/{id}` | Full record with every alias |
| `GET /api/v1/sanctions/lists` | Lists covered, counts, official publication dates |
| `GET /api/v1/sanctions/openapi.json` | OpenAPI 3 spec for RapidAPI import |

Each screening returns `decision` (`clear`, `potential_match`, `strong_match`), a `screeningId` for audit trails, and `listsVersion` (when the lists were last fetched).

**Data refresh:** `.github/workflows/refresh-sanctions.yml` runs `scripts/ingest-sanctions.mjs` every 6 hours and commits `data/sanctions.json`; Vercel redeploys automatically. If a list fails to download or parses suspiciously small, the job fails (GitHub emails you) and the previous data stays live. Run manually: `node scripts/ingest-sanctions.mjs`.

**Ongoing monitoring:** customers save names once (`POST /monitors`, with their own `externalId`). A daily Vercel Cron job (`/api/cron/rescreen`, `vercel.json`) re-screens every saved name whose last check predates the current list snapshot, records `new_match` / `match_removed` alerts, and pushes them to the customer's webhook (HMAC-signed, retried up to 6 times; private and non-HTTPS URLs are refused). Customers can also poll `GET /alerts?after=`. Each customer's data is isolated by RapidAPI's `X-RapidAPI-User` header.

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/v1/sanctions/monitors` | List / add monitored names (up to 500 per call; upsert by `externalId`) |
| `GET/DELETE /api/v1/sanctions/monitors/{id}` | Get / stop monitoring a name |
| `GET /api/v1/sanctions/alerts?after=` | New-match and delisting alerts |
| `GET/PUT/DELETE /api/v1/sanctions/webhook` | Manage the alert webhook (PUT returns the signing secret once) |

**Monitoring setup (free Supabase project):**
1. Apply `supabase/migrations/0001_sanctions_monitoring.sql` (tables are private with RLS on; the app reaches them only through secret-checked functions).
2. Generate a long random secret and store it: `insert into monitoring.config (key, value) values ('api_secret', '<secret>');`
3. In Vercel set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MONITORING_DB_SECRET` (the same secret) and `CRON_SECRET` (another random string; Vercel Cron sends it automatically).

Until these are set, monitoring endpoints return 503 and everything else works.

**Crypto wallet screening:** `GET /api/v1/sanctions/wallet?address=` (all plans) and `POST /api/v1/sanctions/wallets/batch` (Growth+) check addresses against all 1,000+ digital currency addresses on the OFAC SDN list (Bitcoin, EVM, Tron, USDT, Monero, Litecoin, Solana and more). EVM and bech32 addresses match case-insensitively; base58 exactly. The free `/sanctions` page also accepts wallet addresses. This is direct-listing screening only, not tracing of indirect exposure.

**Pay with crypto (prepaid credits, no processor):** customers send USDC on Base or Ethereum to your wallet, sign a claim message with the paying wallet, and `POST /api/v1/billing/claim` to receive an `X-API-Key` (stored hashed). Each call deducts credits (1 per screening/report, 1 per batch item or monitored name; management endpoints free); failed calls are refunded; responses carry `X-Credits-Remaining`. Payments are verified on-chain through free public nodes: successful transaction, USDC contract, sent to your address, enough confirmations (Base 10, Ethereum 12), each transaction claimable once, and the signature must come from the paying wallet so nobody can claim someone else's payment. **Payments from OFAC-listed wallets are refused** (logged as `SANCTIONED PAYER`; talk to a lawyer about any such funds received). Endpoints: `GET /api/v1/billing/info`, `POST /api/v1/billing/claim`, `GET /api/v1/billing/balance`.

Crypto setup: apply `supabase/migrations/0002_crypto_billing.sql`, then set in Vercel `CRYPTO_RECEIVING_ADDRESS` (your EVM wallet; the same address receives on Base and Ethereum). Optional: `CREDIT_PRICE_USDC` (default 0.02), `BASE_RPC_URL` / `ETHEREUM_RPC_URL` (free public nodes by default; they rate-limit, so a free-tier key from an RPC provider is more reliable at volume). Crypto payments may have tax and reporting obligations where you live; check with an accountant.

**Suggested plans** (`lib/plans.ts`, `SANCTIONS_PLANS`): Starter free (100 screenings/mo, 10 monitored names), Growth $199/mo (10k, 1,000 monitored), Business $749/mo (100k, 25,000 monitored), Enterprise $2,999/mo (1M, 250,000 monitored). Create it as a **separate RapidAPI listing** with plans BASIC/PRO/ULTRA/MEGA, and add its proxy secret to `RAPIDAPI_PROXY_SECRET` comma-separated with the vehicle API's secret.

**Before selling:** have a lawyer review your terms of service. The API returns a disclaimer that results are potential matches for human review and not legal advice, but your contract with customers should say so too.

---

# Vehicle recall site

Free vehicle recall and VIN check site built on **live** U.S. government data (NHTSA public APIs: no API key, no cost).

- **VIN tool**: decodes any 17-character VIN (vPIC API) and shows recalls, complaints and crash ratings for that vehicle.
- **SEO pages**: one page per year, make and model (13,000+ URLs in the sitemap), each with recalls, do-not-drive warnings, owner-complaint breakdowns, recent complaints, NHTSA 5-star ratings and FAQ structured data.
- **Recall pages**: `/campaign/<id>` lists every affected vehicle.
- **Paid API** (`/api/v1`): one call returns recalls, complaint stats, crash ratings and VIN decoding as clean JSON. Docs at `/developers`, OpenAPI spec at `/api/v1/openapi.json`.
- Data refreshes every 6 hours (ISR). Pages render on first visit, then are served from cache.
- If NHTSA is down, pages show an error and the API returns HTTP 502. Neither ever reports an outage as "0 recalls".

## Run locally
```bash
npm install
npm run dev
```

## Deploy free on Vercel
Import this repo at vercel.com/new (Hobby plan is free). No environment variables are required.

Optional environment variables:
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your custom domain, e.g. `https://example.com` (used in the sitemap and canonical URLs) |
| `NEXT_PUBLIC_SITE_NAME` | Rename the site |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Your Google AdSense publisher ID (`ca-pub-...`). Ad slots stay hidden until this is set |
| `NEXT_PUBLIC_ADSENSE_SLOT` | Optional AdSense ad-unit ID |
| `RAPIDAPI_PROXY_SECRET` | Locks the APIs so only RapidAPI-forwarded (paying) requests are served. Comma-separate one secret per RapidAPI listing |
| `NEXT_PUBLIC_SANCTIONS_MARKETPLACE_URL` | Sanctions API RapidAPI listing URL (shows a "Get an API key" button) |
| `API_PUBLIC` | Set to `true` to open the API to everyone without a key (not recommended once you sell it) |
| `NEXT_PUBLIC_API_MARKETPLACE_URL` | Your RapidAPI listing URL; shows a "Get an API key" button on `/developers` |

In production the API returns 401 unless `RAPIDAPI_PROXY_SECRET` is set (and the request carries it) or `API_PUBLIC=true`.

After deploying, submit `https://<your-domain>/sitemap.xml` in Google Search Console (free) so the pages get indexed.

## Data sources
- Recalls, complaints, 5-Star ratings: https://api.nhtsa.gov
- VIN decoding: https://vpic.nhtsa.dot.gov/api

## Selling the API on RapidAPI (free to list)
1. Deploy the site to Vercel.
2. At rapidapi.com/provider, create an API and import `https://<your-domain>/api/v1/openapi.json`.
3. Copy the listing's **proxy secret** (API settings → Security) into Vercel as `RAPIDAPI_PROXY_SECRET`, then redeploy.
4. Create four plans on RapidAPI named **BASIC, PRO, ULTRA, MEGA** (RapidAPI's standard plan IDs, which it forwards in the `X-RapidAPI-Subscription` header). The API enforces premium endpoints by plan. Suggested pricing lives in `lib/plans.ts` and appears on `/developers`:

   | Plan | Price | Quota | Unlocks |
   |---|---|---|---|
   | BASIC (Starter) | Free | 100 / month | Reports, safety score, remedy type, recall lookup |
   | PRO | $79 / month | 15,000 / month | + Defect signals, model-year history |
   | ULTRA (Business) | $249 / month | 100,000 / month | + 50-VIN batch screening |
   | MEGA (Enterprise) | $799 / month | 1,000,000 / month | + priority support |

   RapidAPI handles keys, billing and rate limits and keeps a share of revenue. If you change prices there, update `lib/plans.ts` to match.
5. Add the listing URL as `NEXT_PUBLIC_API_MARKETPLACE_URL` so the site's `/developers` page links buyers to it.

## API endpoints
| Endpoint | Returns |
|---|---|
| `GET /api/v1/vin/{vin}` | Decoded VIN plus recalls, complaints and crash ratings |
| `GET /api/v1/vehicle?year=&make=&model=` | Same report by year, make and model |
| `GET /api/v1/recalls/{campaign}` | Recall details and every affected vehicle |
| `GET /api/v1/defects?vin=` or `?year=&make=&model=` | **Pro.** Unrecalled complaint clusters ranked by severity, with 12-month trend |
| `GET /api/v1/history?make=&model=&from=&to=` | **Pro.** Per-year recalls, complaints, serious incidents, grade; best and worst years |
| `POST /api/v1/batch` `{"vins": [...]}` | **Business.** Screen up to 50 VINs: recalls, urgent recalls, safety grade |
| `GET /api/v1/makes?year=` | Makes with recalls for a year |
| `GET /api/v1/models?year=&make=` | Models with recalls for a year and make |

## How the derived data works
Every derived value is reproducible from public NHTSA records; the formulas are in `lib/insights.ts` (`METHODOLOGY`) and are returned in API responses.
- **Model-name matching:** NHTSA often files recalls and complaints for newer years under variant names (a 2025 "ACCORD" appears as ACCORD SEDAN and ACCORD HYBRID). When the exact name has no records, related variants are combined, so a VIN check never wrongly reports zero recalls. The variants used are returned as `matchedModels` / `complaintModels`.
- **Defect signals** exclude components that already have a recall, and need at least 10 complaints.
- **Best years** exclude the two newest model years and years with no complaints on record, since both usually reflect missing data rather than a better car.
