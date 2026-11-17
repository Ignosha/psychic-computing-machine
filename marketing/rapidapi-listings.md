# RapidAPI listings

Create **three separate APIs** in RapidAPI Studio (rapidapi.com/provider). Separate listings appear in more searches
than one combined listing, and each targets a different buyer.

## Setup steps (same for each listing)
1. RapidAPI Studio → **Add API Project** → name it (below) → **Import OpenAPI** from the spec URL.
2. **Base URL**: `https://recallradar-puce.vercel.app/api/v1` (or your custom domain).
3. **Settings → Security**: copy the **Proxy Secret**. After creating all three, send me the three secrets (or add them
   yourself in Vercel → Settings → Environment Variables as `RAPIDAPI_PROXY_SECRET`, comma-separated) and redeploy.
4. **Plans & Pricing**: create the plans below. Plan IDs must be the standard BASIC / PRO / ULTRA / MEGA, because the
   API reads them from the `X-RapidAPI-Subscription` header to unlock batch sizes and monitoring limits.
5. Paste the descriptions, pick the category, add the tags, upload a logo, set to **Public**.
6. Send me each listing's public URL so I can add "Subscribe" buttons on the site (`NEXT_PUBLIC_API_MARKETPLACE_URL`).

Quota tip: RapidAPI counts requests, not credits. Heavier endpoints (Token Risk Report) can be given a request
"weight" in RapidAPI's object-quota settings, or just keep request quotas at the numbers below.

---

## Listing 1: NoshGuard Sanctions & Crypto Wallet Screening
- **Spec**: `https://recallradar-puce.vercel.app/api/v1/openapi/sanctions.json`
- **Category**: Financial (or Data → Compliance if available)
- **Tags**: sanctions, OFAC, AML, KYC, compliance, crypto, wallet screening, watchlist, PEP alternative, UN sanctions, EU sanctions, UK sanctions
- **Short description** (<= 120 chars): Screen names and crypto wallets against OFAC, UN, EU and UK sanctions lists. Fuzzy matching, monitoring, webhooks.
- **Long description**:
  > Screen customers, vendors and crypto wallets against five official sanctions lists (OFAC SDN and Consolidated, UN Security Council, EU, UK) in one call. 33,000+ records refreshed every 6 hours from the official publishers, including every crypto wallet address OFAC has listed (Bitcoin, Ethereum and EVM chains, Tron, USDT, Monero, and more).
  >
  > - Fuzzy, multilingual name matching: misspellings, reordered names, aliases, legal suffixes and Cyrillic input. Measured on 400 real listed names: 100% found exact, reordered and first + last only; 99.8% with a typo.
  > - Fewer false positives: date of birth and country filters, plus a clear / potential / strong decision.
  > - Batch screening (up to 100 per call) and daily monitoring with HMAC-signed webhook alerts when a saved customer newly matches or is delisted.
  > - Audit-ready: every screening returns a unique ID, timestamp and list version.
  > - Free tier, no card.
- **Plans**: BASIC Free 200 req/mo · PRO $199/mo 10,000 req · ULTRA $749/mo 100,000 req · MEGA $2,999/mo 1,000,000 req

## Listing 2: NoshGuard XRPL Payment Safety
- **Spec**: `https://recallradar-puce.vercel.app/api/v1/openapi/xrpl-payments.json`
- **Category**: Payments (or Cryptocurrency)
- **Tags**: XRP, XRPL, XRP Ledger, RLUSD, payments, payment verification, partial payment, destination tag, crypto compliance, merchant, wallet, OFAC
- **Short description**: Will this XRP payment land? Did I really get paid? Pre-flight, settlement verification and counterparty checks for XRPL.
- **Long description**:
  > Three checks that stop the expensive XRP Ledger payment mistakes:
  >
  > **Pre-flight**: before you sign, predicts whether a payment will succeed and the exact ledger result if not: missing destination tag (tecDST_TAG_NEEDED), unactivated recipient below reserve, missing or full trust line, frozen or unauthorized token lines, deposit authorization, unfunded sender and issuer transfer fees, plus OFAC screening of both parties.
  >
  > **Settlement Verify**: after you are paid, confirms what actually arrived. Catches partial payments (a transaction that states $1,000 and delivers cents), counterfeit tokens (USD, RLUSD or USDC codes from issuers that fail xrp-ledger.toml identity verification), unvalidated or failed transactions, wrong destination or tag, and sanctioned senders.
  >
  > **Counterparty Check**: one verdict on any XRPL address: OFAC screening of the address, the account that funded it and its counterparties in its last 200 transactions; account settings; and for token issuers, NOSHASHI's issuer authority certificate.
  >
  > Live reads from public validated XRPL nodes; every answer names the ledger index it was read at.
- **Plans**: same as Listing 1.

## Listing 3: NoshGuard XRPL Token Risk
- **Spec**: `https://recallradar-puce.vercel.app/api/v1/openapi/xrpl-tokens.json`
- **Category**: Cryptocurrency (or Finance)
- **Tags**: XRPL, XRP Ledger, token, memecoin, rug check, token security, issuer, AMM, liquidity, RLUSD, due diligence, NOSHASHI
- **Short description**: A-F risk grade for any XRPL token: issuer powers, verified identity, liquidity, NOSHASHI certificate and sanctions.
- **Long description**:
  > Grade any XRP Ledger token before you buy, list or accept it. One call returns:
  > - what the issuer can still do: freeze holders, claw back tokens, charge transfer fees, or whether it is blackholed and can never change;
  > - whether the issuer is who it claims to be, verified two-way through its own xrp-ledger.toml;
  > - liquidity: XRP AMM pool depth and price, and order-book depth;
  > - circulating supply;
  > - NOSHASHI's issuer authority certificate (verdict, failed checks, SHA-256 digest, verify link);
  > - OFAC screening of the issuer and the account that funded it;
  > - a transparent A-F score with the published methodology.
- **Plans**: BASIC Free 100 req/mo · PRO $99/mo 5,000 req · ULTRA $399/mo 50,000 req · MEGA $1,499/mo 500,000 req
