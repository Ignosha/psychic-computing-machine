# NoshGuard Sanctions & Crypto Wallet Screening

Screen people, companies and crypto wallets against **five official sanctions lists** in one call:
OFAC SDN, OFAC Consolidated (U.S. Treasury), UN Security Council, European Union and UK FCDO.
**33,000+ records**, refreshed from the official publishers **every 6 hours**, including **every crypto wallet address OFAC has listed**.

## Quick start
1. Subscribe to the free **Basic** plan (no card).
2. Copy the code snippet on any endpoint, or:

```bash
curl "https://<RAPIDAPI_HOST>/sanctions/screen?name=Vladimir%20Putin" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: <RAPIDAPI_HOST>"
```

## Endpoints

| Group | Endpoint | What it does |
|---|---|---|
| Screening | `GET/POST /sanctions/screen` | Screen one name. Optional `type`, `dob`, `country`, `sources`, `threshold`, `limit`. |
| Screening | `POST /sanctions/batch` | Screen up to 100 names per call (Pro: 25). |
| Crypto | `GET/POST /sanctions/wallet` | Is this wallet address on OFAC's list? Bitcoin, Ethereum/EVM, Tron, Litecoin, Monero and more. |
| Crypto | `POST /sanctions/wallets/batch` | Up to 100 addresses per call (Pro: 25). |
| Records | `GET /sanctions/entities/{id}` | Full record: every alias, dates and places of birth, nationalities, programs, wallets, IDs. |
| Records | `GET /sanctions/lists` | Lists covered, record counts and each list's publication date. |

## Name screening
| Parameter | Required | Example | Notes |
|---|---|---|---|
| `name` | yes | `Vladimir Putin` | 2 to 200 characters. Latin or Cyrillic. |
| `type` | no | `individual` | `individual`, `entity`, `vessel`, `aircraft` |
| `dob` | no | `1952-10-07` | `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. A mismatch lowers the score. |
| `country` | no | `Russia` | Nationality or address country. A mismatch lowers the score. |
| `sources` | no | `OFAC_SDN,UN` | Any of `OFAC_SDN, OFAC_CONS, UN, EU, UK`. Default: all. |
| `threshold` | no | `0.88` | 0.5 to 1. Lower finds more, with more false positives. |
| `limit` | no | `10` | 1 to 50 matches. |

**Matching** handles misspellings, reordered names, aliases, legal suffixes (LLC, OOO, GmbH) and Cyrillic.
Tested on 400 real listed names: 100% found for exact, reordered and first + last name; 99.8% with a typo.

**Decision**: `clear`, `potential_match` (review it) or `strong_match`.

Example response (abbreviated, real data):
```json
{
  "data": {
    "screeningId": "c62a7938-46fc-47d7-a427-b4558e720521",
    "decision": "strong_match",
    "matchCount": 1,
    "matches": [{
      "score": 1,
      "matchedName": "Vladimir PUTIN",
      "id": "ofac_sdn-35096",
      "source": "OFAC_SDN",
      "type": "individual",
      "name": "Vladimir Vladimirovich PUTIN",
      "datesOfBirth": ["1952-10-07"],
      "nationalities": ["Russia"],
      "programs": ["RUSSIA-EO14024"]
    }],
    "listsVersion": "2026-11-17T20:51:36.002Z"
  },
  "meta": { "source": "Official sanctions lists: OFAC (U.S. Treasury), UN Security Council, European Union, UK FCDO" }
}
```

## Wallet screening
```bash
GET /sanctions/wallet?address=0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB
```
```json
{
  "data": {
    "address": "0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB",
    "addressFormat": "evm",
    "sanctioned": true,
    "decision": "sanctioned",
    "matches": [{ "listedChain": "ETH", "id": "ofac_sdn-24003", "name": "Behzad MESRI", "programs": ["CYBER2", "HRIT-IR"] }]
  }
}
```
EVM addresses are matched case-insensitively. Coverage is exact matches against OFAC-published addresses; it does not trace funds that passed through other wallets.

## Batch (Pro and above)
```json
POST /sanctions/batch
{ "queries": [ { "name": "Vladimir Putin", "country": "Russia" }, { "name": "Acme Trading LLC", "type": "entity" } ] }

POST /sanctions/wallets/batch
{ "addresses": ["0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB", "bc1q..."] }
```

## Audit trail
Every screening returns a unique `screeningId`, a timestamp and `listsVersion` (when the list snapshot was fetched). Store them with your decision.

## Errors
| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_params` | Missing or invalid parameter. The message says which. |
| 401 | `unauthorized` | Missing or invalid RapidAPI key. |
| 403 | `plan_upgrade_required` | Batch endpoints need Pro or above. |
| 404 | `not_found` | No record with that id. |
| 429 | | Rate limit or monthly quota reached. |

Failed calls are not charged.

## Plans
| Plan | Price | Requests / month | Batch |
|---|---|---|---|
| Basic | Free | 200 | – |
| Pro | $299 | 10,000 | 25 per call |
| Ultra | $999 | 100,000 | 100 per call |
| Mega | $3,999 | 1,000,000 | 100 per call |

## Important
Results are automated screening, not a legal determination. A match is a potential match that needs human review; a clear result does not guarantee a party is not sanctioned. You remain responsible for your own compliance decisions.
[Terms](https://noshguard.vercel.app/terms) · [Privacy](https://noshguard.vercel.app/privacy) · Free web tool: [noshguard.vercel.app/sanctions](https://noshguard.vercel.app/sanctions)

A [NOSHASHI](https://www.noshashi.app) product.
