# NoshGuard XRPL Payment Safety

Three checks that stop the expensive XRP Ledger payment mistakes, read live from the validated ledger:

- **Pre-flight**: will this payment succeed, before anyone signs?
- **Settlement Verify**: did I really get paid?
- **Counterparty Check**: who is on the other side?

Every answer states the ledger index it was read at.

## Quick start
```bash
curl "https://<RAPIDAPI_HOST>/xrpl/preflight?to=rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv&amount=25" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: <RAPIDAPI_HOST>"
```

## 1. Payment Pre-flight: `GET /xrpl/preflight`
| Parameter | Required | Example | Notes |
|---|---|---|---|
| `to` | yes | `rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv` | Recipient address |
| `amount` | yes | `25` | In XRP, or token units |
| `currency` | no | `XRP` | `XRP` (default) or a token code such as `RLUSD` |
| `issuer` | for tokens | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | Token issuer address |
| `destinationTag` | no | `12345` | |
| `from` | no | `r...` | Sender. Enables balance, reserve and deposit-authorization checks. |

**Catches**: missing destination tag (`tecDST_TAG_NEEDED`), recipient not activated or below reserve, missing or full trust line, frozen or unauthorized token lines, deposit authorization, unfunded sender, issuer transfer fees, and OFAC-listed sender or recipient.

**Verdict**: `will_succeed`, `will_succeed_with_warnings` or `will_fail`, plus the list of checks.

Real example: 25 XRP to an exchange address without a destination tag:
```json
{
  "data": {
    "validatedLedgerIndex": 108403188,
    "verdict": "will_fail",
    "checks": [
      { "id": "SANCTIONS_RECIPIENT", "status": "pass", "message": "The recipient is not on the OFAC sanctioned address list." },
      { "id": "DESTINATION_EXISTS", "status": "pass", "message": "The recipient account exists." },
      { "id": "DESTINATION_TAG", "status": "fail", "message": "The recipient requires a destination tag (typical for exchanges). Without it the payment is rejected..." }
    ],
    "network": { "baseReserveXrp": 1, "ownerReserveXrp": 0.2 }
  }
}
```

## 2. Settlement Verify: `GET /xrpl/verify`
| Parameter | Required | Notes |
|---|---|---|
| `tx` | yes | 64-character transaction hash |
| `expectTo` | no | Your receiving address |
| `expectDestinationTag` | no | The tag you gave the customer |
| `expectAmount` | no | Minimum amount you expect |
| `expectCurrency` | no | `XRP` or a token code, e.g. `RLUSD` |
| `expectIssuer` | no | The real issuer, e.g. `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` for RLUSD |

**Catches**:
- **Partial payments**: a transaction that states $1,000 but delivers cents. Always credit `deliveredAmount`, never the stated amount.
- **Counterfeit tokens**: a USD, RLUSD or USDC code from an issuer that fails two-way xrp-ledger.toml identity verification.
- Unvalidated or failed transactions, wrong destination, wrong or missing tag, wrong asset, short amount, sanctioned sender, and issuers that can claw tokens back.

**Verdict**: `settled`, `settled_with_warnings` or `not_settled`, with every finding explained.

## 3. Counterparty Check: `GET /xrpl/check?address=r...`
One verdict (`clear`, `review` or `block`) on any XRPL address:
- OFAC screening of the address, **the account that funded it**, and **every counterparty in its last 200 transactions**
- Account settings: destination tag required, deposit authorization, master key disabled, regular key, freeze and clawback flags
- For token issuers: tokens issued and the **NOSHASHI issuer authority certificate**

Real example (RLUSD issuer, abbreviated):
```json
{
  "data": {
    "verdict": "review",
    "findings": [
      { "code": "DESTINATION_TAG_REQUIRED", "severity": "info", "message": "Payments to this account must include a destination tag (typical for exchanges)." }
    ],
    "sanctions": {
      "listed": false,
      "fundedBy": { "fundedBy": "rJqiMb94hyz41SBTNr2AyPNW8AzELa8nE", "sanctioned": false },
      "recentCounterparties": { "transactionsScanned": 200, "uniqueCounterparties": 64, "sanctioned": [] }
    },
    "ledger": { "exists": true, "validatedLedgerIndex": 108403189, "domain": "https://ripple.com/" },
    "issuer": { "tokensIssued": { "RLUSD": "721198828.5814977" } }
  }
}
```

## Errors
| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_address`, `invalid_tx`, `invalid_params` | Bad input. The message says which. |
| 401 | `unauthorized` | Missing or invalid RapidAPI key. |
| 404 | `not_found`, `tx_not_found` | Account or transaction not on the ledger. |
| 502 | `xrpl_unavailable` | XRPL nodes did not answer. Retry. |

Failed calls are not charged.

## Plans
| Plan | Price | Requests / month |
|---|---|---|
| Basic | Free | 200 |
| Pro | $299 | 10,000 |
| Ultra | $999 | 100,000 |
| Mega | $3,999 | 1,000,000 |

## Important
Read only: never asks for keys and never signs. Predictions use the ledger at the stated index; state can change before you submit. Information for your own review, not financial or legal advice.
[Terms](https://noshguard.vercel.app/terms) · [Privacy](https://noshguard.vercel.app/privacy) · Free web tools: [noshguard.vercel.app](https://noshguard.vercel.app)

A [NOSHASHI](https://www.noshashi.app) product.
