# NoshGuard XRPL Token Risk

An **A to F risk grade** for any XRP Ledger token, before you buy, list or accept it. One call, live from the validated ledger.

## Quick start
```bash
curl "https://<RAPIDAPI_HOST>/xrpl/token?currency=RLUSD&issuer=rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: <RAPIDAPI_HOST>"
```

## `GET /xrpl/token`
| Parameter | Required | Example | Notes |
|---|---|---|---|
| `currency` | yes | `RLUSD` | 3-letter code, a name up to 20 characters, or a 40-character hex code |
| `issuer` | yes | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | Issuer address |

## What you get
- **Issuer powers**: can it freeze holders, claw tokens back, charge a transfer fee? Is it blackholed (can never change)? Multi-signing or regular key?
- **Identity**: is the issuer who it claims to be, verified two-way through its own `xrp-ledger.toml`? Look-alike codes (USD, RLUSD, USDC) from unverified issuers are heavily penalized.
- **Liquidity**: XRP AMM pool depth and price, and order-book depth. Can you actually sell?
- **Circulating supply**
- **NOSHASHI issuer authority certificate**: verdict, failed checks, SHA-256 digest and a public verify link
- **Sanctions**: OFAC screening of the issuer and the account that funded it
- **Grade and score** with every factor itemized

Example response (abbreviated, real ledger data for RLUSD):
```json
{
  "data": {
    "validatedLedgerIndex": 108403188,
    "token": { "currency": "RLUSD", "issuer": "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", "circulatingSupply": "721198828.5814977" },
    "grade": "B",
    "score": 75,
    "factors": [
      { "factor": "clawback", "points": -10, "detail": "The issuer (identity verified) can claw tokens back, typically as a regulatory control." },
      { "factor": "freeze", "points": -5, "detail": "The issuer (identity verified) keeps the right to freeze holders." }
    ],
    "issuer": { "blackholed": false, "canFreeze": true, "canClawback": true, "transferFeePercent": 0, "multiSign": true,
                "identity": { "domain": "ripple.com", "status": "verified", "verified": true } },
    "liquidity": { "amm": { "xrp": 1932751.16, "tokens": 1888251.57, "priceXrp": 1.0236, "tradingFeePercent": 0.315 },
                   "orderBook": { "sellOffers": 50, "buyOffers": 50 } },
    "noshashiCertificate": { "verdict": "hold", "failedChecks": ["Freeze permanently surrendered", "Supply concentration"],
                             "verifyUrl": "https://www.noshashi.app/certificate/?issuer=rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" },
    "sanctions": { "issuerListed": false, "funderListed": false }
  }
}
```

## Methodology
Starts at 100.
- Clawback: −25 (−10 if the issuer's identity is verified). Freeze: −15 (−5 if verified).
- Identity fails xrp-ledger.toml verification: −20, or −40 if the code copies a major asset such as USD or RLUSD. If the issuer's site cannot be reached, no penalty and the report says so.
- Transfer fee above 1%: −10.
- No XRP AMM pool and no order book: −25. Under 10,000 XRP of AMM depth: −10.
- NOSHASHI verdict hold: −10; no-go: −25.
- Issuer or its funder on the OFAC list: score 0.

Grades: **A** ≥ 85, **B** ≥ 70, **C** ≥ 55, **D** ≥ 40, else **F**. The full methodology is returned in every response.

## Errors
| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_address`, `invalid_currency` | Bad issuer or currency code |
| 401 | `unauthorized` | Missing or invalid RapidAPI key |
| 404 | `not_found` | The issuer account does not exist |
| 502 | `xrpl_unavailable` | XRPL nodes did not answer. Retry. |

Failed calls are not charged.

## Plans
| Plan | Price | Requests / month |
|---|---|---|
| Basic | Free | 100 |
| Pro | $149 | 5,000 |
| Ultra | $549 | 50,000 |
| Mega | $1,999 | 500,000 |

## Important
A grade is an automated opinion from public data, not investment advice or a recommendation to buy or sell.
[Terms](https://noshguard.vercel.app/terms) · [Privacy](https://noshguard.vercel.app/privacy) · Free web tool: [noshguard.vercel.app/xrpl/token](https://noshguard.vercel.app/xrpl/token)

A [NOSHASHI](https://www.noshashi.app) product.
