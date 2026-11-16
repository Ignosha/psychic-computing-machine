# RecallRadar

Free vehicle recall and VIN check site built on **live** U.S. government data (NHTSA public APIs: no API key, no cost).

- **VIN tool**: decodes any 17-character VIN (vPIC API) and shows recalls, complaints and crash ratings for that vehicle.
- **SEO pages**: one page per year, make and model (13,000+ URLs in the sitemap), each with recalls, do-not-drive warnings, owner-complaint breakdowns, recent complaints, NHTSA 5-star ratings and FAQ structured data.
- **Recall pages**: `/campaign/<id>` lists every affected vehicle.
- Data refreshes every 6 hours (ISR). Pages render on first visit, then are served from cache.

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

After deploying, submit `https://<your-domain>/sitemap.xml` in Google Search Console (free) so the pages get indexed.

## Data sources
- Recalls, complaints, 5-Star ratings: https://api.nhtsa.gov
- VIN decoding: https://vpic.nhtsa.dot.gov/api
