# NoshGuard API examples

Copy-paste examples for the four NoshGuard APIs: sanctions and crypto-wallet screening, and XRP Ledger payment
safety, token risk and account security. All results come live from official sanctions lists and the validated XRP Ledger.

**Zero dependencies.** JavaScript needs Node 18+; Python needs 3.8+.

## 1. Get a free key (1 minute)
Subscribe to the free **Basic** plan on any listing (no card). One RapidAPI key works for every listing you subscribe to.

| API | What it does | Free plan |
|---|---|---|
| [Sanctions & Crypto Wallet Screening](https://rapidapi.com/Ignosha/api/noshguard-sanctions-crypto-wallet-screening) | Names and wallets vs OFAC, UN, EU, UK lists | 200 requests / month |
| [XRPL Payment Safety](https://rapidapi.com/Ignosha/api/noshguard-xrpl-payment-safety) | Pre-flight, settlement verify, counterparty check | 200 requests / month |
| [XRPL Token Risk](https://rapidapi.com/Ignosha/api/noshguard-xrpl-token-risk) | A to F grade for any XRPL token | 100 requests / month |
| [XRPL Account Security](https://rapidapi.com/Ignosha/api/noshguard-xrpl-account-security) | Takeover signals, address poisoning, reserve recovery, escrow unlocks | 200 requests / month |

## 2. Run the examples
```bash
export RAPIDAPI_KEY=your-key

# JavaScript
cd javascript && node examples.mjs          # or: node examples.mjs screen

# Python
cd python && python3 examples.py            # or: python3 examples.py token
```

Real output:
```
== screen
decision: strong_match (4 matches)
  1.00  Vladimir Vladimirovich PUTIN  [OFAC_SDN] RUSSIA-EO14024
  1.00  Vladimir Vladimirovich PUTIN  [UK] Russia
  0.96  Влади́мир Влади́мирович ПУ́ТИН  [EU] UKR

== wallet
sanctioned: true (Behzad MESRI)

== preflight
verdict: will_fail at ledger 108412019
  fail: The recipient requires a destination tag (typical for exchanges). Without it the payment is rejected, or worse, unattributable.

== escrows
12 escrows, 4,000,000,000 XRP locked
  next: 300,000,000 XRP on 2026-12-01

== trustlines
104 empty trust lines, 20.8 XRP recoverable
```

## 3. Use it in your app

**JavaScript**
```js
import { NoshGuard } from "./noshguard.mjs";
const ng = new NoshGuard(); // reads RAPIDAPI_KEY

const s = await ng.screenName("Jane Doe", { dob: "1980", country: "Germany" });
if (s.decision !== "clear") flagForReview(s.screeningId, s.matches);

const p = await ng.preflight({ to: "r...", amount: "100", destinationTag: 12345 });
if (p.verdict === "will_fail") showError(p.checks.filter((c) => c.status === "fail"));

const v = await ng.verifyPayment(txHash, { to: myAddress, destinationTag: orderTag, amount: "100", currency: "RLUSD", issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" });
if (v.verdict === "settled") creditCustomer(v.payment.deliveredAmount); // never the stated amount
```

**Python**
```python
from noshguard import NoshGuard
ng = NoshGuard()  # reads RAPIDAPI_KEY

w = ng.screen_wallet("0x...")
if w["sanctioned"]:
    block_withdrawal(w["matches"])

t = ng.token_report("RLUSD", "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De")
print(t["grade"], t["score"], t["liquidity"])
```

**curl**
```bash
curl "https://noshguard-sanctions-crypto-wallet-screening.p.rapidapi.com/sanctions/screen?name=Vladimir%20Putin" \
  -H "X-RapidAPI-Key: $RAPIDAPI_KEY" \
  -H "X-RapidAPI-Host: noshguard-sanctions-crypto-wallet-screening.p.rapidapi.com"
```

## Every method

| Method (JS / Python) | Endpoint | API |
|---|---|---|
| `screenName` / `screen_name` | `GET /sanctions/screen` | Sanctions |
| `screenNames` / `screen_names` | `POST /sanctions/batch` (Pro+) | Sanctions |
| `screenWallet` / `screen_wallet` | `GET /sanctions/wallet` | Sanctions |
| `screenWallets` / `screen_wallets` | `POST /sanctions/wallets/batch` (Pro+) | Sanctions |
| `record` | `GET /sanctions/entities/{id}` | Sanctions |
| `lists` | `GET /sanctions/lists` | Sanctions |
| `preflight` | `GET /xrpl/preflight` | Payment Safety |
| `verifyPayment` / `verify_payment` | `GET /xrpl/verify` | Payment Safety |
| `counterparty` | `GET /xrpl/check` | Payment Safety |
| `tokenReport` / `token_report` | `GET /xrpl/token` | Token Risk |
| `controlAudit` / `control_audit` | `GET /xrpl/control` | Account Security |
| `inboxScan` / `inbox_scan` | `GET /xrpl/inbox` | Account Security |
| `trustlineAudit` / `trustline_audit` | `GET /xrpl/trustlines` | Account Security |
| `escrowCalendar` / `escrow_calendar` | `GET /xrpl/escrows` | Account Security |

Errors throw with the HTTP `status` and an error `code` (for example `invalid_address`, `unauthorized`, `plan_upgrade_required`).

## Links
- Free web tools and docs: https://noshguard.vercel.app
- Terms: https://noshguard.vercel.app/terms
- Support: noshguard.support@gmail.com
- A [NOSHASHI](https://www.noshashi.app) product.

Results are automated information for your own review, not legal or financial advice.
