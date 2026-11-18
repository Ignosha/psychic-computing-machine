# RapidAPI listings

Create **four separate APIs** in RapidAPI Studio (rapidapi.com/provider). Separate listings appear in more searches
than one combined listing, and each targets a different buyer.

## Step-by-step (about 15 minutes per listing)

RapidAPI renames buttons from time to time; if a label below differs slightly, look for the closest match.

**Once, before the first listing**
1. Sign up at **rapidapi.com** (free). Use a business name you're happy for buyers to see, e.g. "NoshGuard".
2. Open **rapidapi.com/studio** (Studio is the provider side).
3. Set up payouts: profile picture → **Settings / Organization → Payouts** (PayPal or Payoneer). Without it, paid plans
   cannot be published. RapidAPI keeps a marketplace fee (currently around 25%) from each sale.

**For each of the four listings below**
1. Studio → **Add API Project**. Enter the listing's name, short description and category (from the listing below).
   Under "Specify using", choose **OpenAPI** and import the listing's **Spec** URL. If it only accepts a file, open the
   spec URL in your browser, save the page as a `.json` file and upload that.
2. **Hub Listing → General**:
   - Logo: `public/icon-512.png` in this repo (or any square image).
   - Long description: paste the listing's long description.
   - Website: `https://noshguard.vercel.app`
   - **Terms of Use**: `https://noshguard.vercel.app/terms`
   - Add the tags.
3. **Hub Listing → Gateway** (or **Settings → Gateway**): set the base URL to `https://noshguard.vercel.app/api/v1`.
   Leave "Request transformation" off.
4. **Gateway → Security / Firewall**: copy the **X-RapidAPI-Proxy-Secret** value. Keep it private: send it to me in
   chat, or paste it yourself into Vercel → project **recallradar** → Settings → Environment Variables →
   `RAPIDAPI_PROXY_SECRET` (all four secrets in one value, separated by commas), then **Redeploy**.
5. **Hub Listing → Monetize → Plans**: create **Basic**, **Pro**, **Ultra** and **Mega** with the prices and request
   quotas in the listing. Keep the standard plan names: the API reads `BASIC / PRO / ULTRA / MEGA` from RapidAPI's
   `X-RapidAPI-Subscription` header to unlock batch sizes and monitoring. Set overage to "hard limit" on Basic.
6. **Endpoints tab → Test endpoint** on one endpoint. A `200` with real ledger or sanctions data means the gateway works.
   (A `401 unauthorized` means the proxy secret isn't in Vercel yet, or you haven't redeployed.)
7. **Hub Listing → General → Visibility → Public**, then save. It usually appears in search within a day.
8. Send me the public listing URL (looks like `rapidapi.com/<you>/api/<name>`). I'll add "Subscribe" buttons on the
   site and in the docs.

Quota tip: RapidAPI counts requests, not credits. Heavier endpoints (Token Risk Report, Counterparty Check) can be
given a request "weight" in RapidAPI's object-quota settings, or just keep request quotas at the numbers below.

---

## Listing 1: NoshGuard Sanctions & Crypto Wallet Screening
- **Spec**: `https://noshguard.vercel.app/api/v1/openapi/sanctions.json`
- **Category**: Financial (or Data → Compliance if available)
- **Tags**: sanctions, OFAC, AML, KYC, compliance, crypto, wallet screening, watchlist, PEP alternative, UN sanctions, EU sanctions, UK sanctions
- **Short description** (<= 120 chars): Screen names and crypto wallets against OFAC, UN, EU and UK sanctions lists. Fuzzy, multilingual, batch.
- **Long description**:
  > Screen customers, vendors and crypto wallets against five official sanctions lists (OFAC SDN and Consolidated, UN Security Council, EU, UK) in one call. 33,000+ records refreshed every 6 hours from the official publishers, including every crypto wallet address OFAC has listed (Bitcoin, Ethereum and EVM chains, Tron, USDT, Monero, and more).
  >
  > - Fuzzy, multilingual name matching: misspellings, reordered names, aliases, legal suffixes and Cyrillic input. Measured on 400 real listed names: 100% found exact, reordered and first + last only; 99.8% with a typo.
  > - Fewer false positives: date of birth and country filters, plus a clear / potential / strong decision.
  > - Batch screening (up to 100 per call).
  > - *(Add once monitoring is enabled: daily monitoring with HMAC-signed webhook alerts when a saved customer newly matches or is delisted.)*
  > - Audit-ready: every screening returns a unique ID, timestamp and list version.
  > - Free tier, no card.
- **Plans**: BASIC Free 200 req/mo · PRO $299/mo 10,000 req · ULTRA $999/mo 100,000 req · MEGA $3,999/mo 1,000,000 req

## Listing 2: NoshGuard XRPL Payment Safety
- **Spec**: `https://noshguard.vercel.app/api/v1/openapi/xrpl-payments.json`
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
- **Spec**: `https://noshguard.vercel.app/api/v1/openapi/xrpl-tokens.json`
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
- **Plans**: BASIC Free 100 req/mo · PRO $149/mo 5,000 req · ULTRA $549/mo 50,000 req · MEGA $1,999/mo 500,000 req

## Listing 4: NoshGuard XRPL Account Security
- **Spec**: `https://noshguard.vercel.app/api/v1/openapi/xrpl-security.json`
- **Category**: Cryptocurrency (or Security)
- **Tags**: XRPL, XRP Ledger, account security, address poisoning, phishing, account takeover, multisig, regular key, trust lines, reserve, escrow, wallet security
- **Short description**: XRPL account security: takeover signals, address-poisoning and phishing detection, reserve recovery, escrow unlocks.
- **Long description**:
  > Four checks that protect XRP Ledger accounts, not just payments:
  >
  > **Control Audit**: who can sign (master key, regular key, multi-signing) and every recent control change. A key change just before you send a large payment is a classic account-takeover signal.
  >
  > **Inbox Threat Scan**: finds address-poisoning attempts (senders imitating the first and last characters of addresses you have paid), phishing links in memos (e.g. fake "incoming escrow, finalize via ..." lures), dust spam and OFAC-listed senders.
  >
  > **Trust Line Audit**: empty trust lines you can remove to recover locked XRP reserve, plus holdings of look-alike tokens, frozen lines and risky issuers.
  >
  > **Escrow Unlock Calendar**: every escrow on an account, when each becomes releasable and how much XRP unlocks per month.
- **Plans**: BASIC Free 200 req/mo · PRO $299/mo 10,000 req · ULTRA $999/mo 100,000 req · MEGA $3,999/mo 1,000,000 req
