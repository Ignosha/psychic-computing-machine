# NoshGuard: crypto compliance & XRPL payment safety APIs (a NOSHASHI product)

Free tools on the website plus a paid API, all on real data: official sanctions lists and live XRP Ledger reads.
Live: https://noshguard.vercel.app · Docs & pricing: `/api-docs` · Marketing kit: [`marketing/`](marketing/)

## Products
| Product | Endpoint | Credits | Free page |
|---|---|---|---|
| **Payment Pre-flight**: will this XRP/token payment succeed? Predicts the ledger result (tecDST_TAG_NEEDED, tecNO_DST_INSUF_XRP, tecPATH_DRY, tecNO_PERMISSION, tecUNFUNDED_PAYMENT…), transfer fees, sanctions on both parties | `GET/POST /api/v1/xrpl/preflight` | 1 | `/xrpl/preflight` |
| **Settlement Verify**: what was actually delivered? Partial payments, counterfeit tokens (major codes from issuers failing xrp-ledger.toml verification), unvalidated/failed tx, wrong destination/tag, sanctioned sender | `GET/POST /api/v1/xrpl/verify` | 1 | `/xrpl/verify` |
| **Token Risk Report**: A–F grade: issuer powers (freeze, clawback, fee, blackholed), verified identity, AMM/order-book liquidity, supply, NOSHASHI certificate, sanctions on issuer and funder | `GET /api/v1/xrpl/token` | 3 | `/xrpl/token` |
| **XRPL Counterparty Check**: sanctions on an address, its funder and last-200-tx counterparties; account settings; issuer certificate | `GET/POST /api/v1/xrpl/check`, `POST /api/v1/xrpl/check/batch` | 2 | `/xrpl` |
| **Sanctions & wallet screening**: OFAC SDN + Consolidated, UN, EU, UK (33,000+ records, 1,081 crypto wallets), fuzzy multilingual matching, batch, monitoring with signed webhooks | `/api/v1/sanctions/*` | 1 | `/sanctions` |

OpenAPI per marketplace listing: `/api/v1/openapi/{all,sanctions,xrpl-payments,xrpl-tokens}.json`.

## How the hard parts work
- **Sanctions data**: `scripts/ingest-sanctions.mjs` downloads the five official lists; `.github/workflows/refresh-sanctions.yml` refreshes every 6 hours and refuses to publish a list that downloads or parses suspiciously small. Matching (`lib/sanctions/`): transliteration, legal-suffix removal, token Jaro-Winkler with reorder and middle-name tolerance; 400-name test: 100% exact/reordered/first+last, 99.8% with a typo.
- **XRPL reads** (`lib/xrpl/`): JSON-RPC to public validated nodes with failover (`XRPL_RPC_URLS`). Never signs or submits. Trust lines filtered by peer follow pagination markers (a page can be empty while the line exists further on).
- **Issuer identity**: two-way check, the account's Domain names a site and that site's `/.well-known/xrp-ledger.toml` lists the account. "Could not reach the site" is reported as unchecked, never as counterfeit.
- **Partial payments**: always `meta.delivered_amount`, never the stated `Amount`.
- **NOSHASHI**: issuer authority certificates from `noshashi.app/api/authority` (verdict, checks, SHA-256 digest, verify link); every page promotes NOSHASHI.

## Getting paid
1. **RapidAPI** (card subscriptions): see `marketing/rapidapi-listings.md`. Set `RAPIDAPI_PROXY_SECRET` in Vercel (comma-separate one secret per listing). Plans BASIC/PRO/ULTRA/MEGA unlock batch sizes and monitoring limits.
2. **Crypto prepaid credits** (no processor, keep 100%): XRP/RLUSD via per-account destination tags (`/api/v1/billing/xrpl/tag`, `/claim`; credited from `delivered_amount`, XRP valued at the on-ledger XRP/RLUSD AMM price), or USDC on Base/Ethereum (`/api/v1/billing/claim`, signed by the paying wallet). Payments from OFAC-listed payers are refused.

In production the API returns 401 until RapidAPI or crypto billing is configured (or `API_PUBLIC=true`).

## Configuration (Vercel environment variables)
| Variable | Purpose |
|---|---|
| `RAPIDAPI_PROXY_SECRET` | RapidAPI proxy secret(s), comma-separated |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MONITORING_DB_SECRET` | Database for monitoring and crypto credits (apply `supabase/migrations/000{1,2,3}*.sql`, then `insert into monitoring.config values ('api_secret', '<secret>')`) |
| `XRPL_RECEIVING_ADDRESS` | Your XRPL address for XRP/RLUSD payments |
| `CRYPTO_RECEIVING_ADDRESS` | Your EVM address for USDC payments |
| `CREDIT_PRICE_USDC` | Price per credit (default 0.02) |
| `CRON_SECRET` | Protects the daily monitoring job (already set) |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL` | Brand name and custom domain |
| `NEXT_PUBLIC_API_MARKETPLACE_URL` | Your marketplace listing URL (adds a Subscribe button) |
| `XRPL_RPC_URLS`, `NOSHASHI_URL`, `BASE_RPC_URL`, `ETHEREUM_RPC_URL` | Optional overrides |

Run locally: `npm install && npm run dev`. Results are information for review, not legal or financial advice; have a lawyer review your terms before selling compliance services.
