# NoshGuard XRPL Account Security

Four checks that protect XRP Ledger **accounts**, not just payments. Live from the validated ledger; read only.

| Endpoint | Question it answers |
|---|---|
| `GET /xrpl/control` | Who can sign for this account, and did that change recently? |
| `GET /xrpl/inbox` | Is someone baiting this account with look-alike addresses or phishing memos? |
| `GET /xrpl/trustlines` | How much XRP reserve can be recovered, and are any holdings fake or frozen? |
| `GET /xrpl/escrows` | When does locked supply unlock? |

All four take one parameter: `address` (an XRPL classic address starting with `r`).

## Quick start
```bash
curl "https://<RAPIDAPI_HOST>/xrpl/escrows?address=r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: <RAPIDAPI_HOST>"
```

## 1. Control Audit: `/xrpl/control`
Master key, regular key and multi-signing setup, plus every control change in recent history (SetRegularKey, SignerListSet, master key disabled or re-enabled).
A key change just before you send a large payment is a classic **account-takeover signal**, and is flagged. Signers on the OFAC list are blocked.
Example: the RLUSD issuer is controlled by a 26-signer multi-sign list.

## 2. Inbox Threat Scan: `/xrpl/inbox`
Scans recent incoming transactions for:
- **Address poisoning**: senders whose address imitates the first and last characters of addresses this account has paid, hoping you copy the wrong one from your history
- **Phishing memos**: links in memos, such as fake "incoming escrow, finalize via ..." lures (our live test found 30 on one popular account)
- **Dust spam** and **OFAC-listed senders**

## 3. Trust Line Audit: `/xrpl/trustlines`
Real example (abbreviated):
```json
{
  "data": {
    "verdict": "clear",
    "findings": [
      { "id": "RESERVE_RECOVERABLE", "severity": "info", "message": "104 empty trust line(s) can be removed to release up to 20.8 XRP of reserve." }
    ],
    "summary": { "trustLines": 168, "holdingsWithBalance": 64, "removableEmptyLines": 104, "reserveRecoverableXrp": 20.8 },
    "removable": [ { "currency": "MGT", "issuer": "rwpQQdPJZmnGFNrPfbtCjtStdBxZK8qs3W" } ]
  }
}
```
Also flags look-alike tokens (major codes from unverified issuers), frozen lines, clawback-capable issuers and OFAC-listed issuers.

## 4. Escrow Unlock Calendar: `/xrpl/escrows`
Real example (abbreviated):
```json
{
  "data": {
    "summary": {
      "escrows": 12,
      "totalXrpLocked": 4000000000,
      "releasableNowXrp": 0,
      "nextRelease": { "date": "2026-12-01T00:00:00.000Z", "amount": { "currency": "XRP", "value": 300000000 } }
    },
    "upcomingXrpByMonth": [ { "month": "2026-12", "xrp": 500000000 }, { "month": "2027-01", "xrp": 500000000 } ],
    "escrows": [ { "amount": { "currency": "XRP", "value": 300000000 }, "releasableFrom": "2026-12-01T00:00:00.000Z", "conditional": false, "releasableNow": false } ]
  }
}
```

## Response format
Control, Inbox and Trust Lines return a `verdict` (`clear`, `review` or `block`) and a list of `findings`, each with an `id`, `severity` and plain-English `message`. Every response includes `meta.source` and the ledger index where relevant.

## Errors
| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_address` | Not a valid XRPL classic address |
| 401 | `unauthorized` | Missing or invalid RapidAPI key |
| 404 | `not_found` | Account does not exist on the ledger |
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
Read only: never asks for keys and never signs. Findings are information for your own review, not a guarantee that an account is safe.
[Terms](https://noshguard.vercel.app/terms) · [Privacy](https://noshguard.vercel.app/privacy) · Free web tools: [noshguard.vercel.app](https://noshguard.vercel.app)

A [NOSHASHI](https://www.noshashi.app) product.
