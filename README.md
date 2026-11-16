# RecallRadar

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
| `RAPIDAPI_PROXY_SECRET` | Locks the API so only RapidAPI-forwarded (paying) requests are served |
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
