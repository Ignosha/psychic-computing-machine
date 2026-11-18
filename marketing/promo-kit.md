# NoshGuard promo kit: get the first customers faster

Every number below is real, read from the live XRP Ledger on 2026-11-18. Re-run a check before reposting old numbers.
Images are in `marketing/promo-images/` (the private holder's address is hidden; never post a private person's address).

**The rule that sells APIs:** lead with a scary, specific, true finding → show it was found in one click → free tool link → API for businesses.

---

## 1. The 14-day launch plan (about 30 minutes a day)

| Day | Do this | Where |
|---|---|---|
| 1 | Post the **phishing** thread (§2A) with `inbox.png` | X |
| 1 | Pin it; set your X bio: "Building NoshGuard: XRPL payment safety + sanctions screening API. Free tools ↓" + site link | X |
| 2 | Post the **phishing** Reddit post (§3A) | r/XRP |
| 3 | Post the developer post (§4) | XRPL Discord (#dev or #showcase), r/xrpl_dev if active |
| 4 | Send 10 cold DMs/emails to **wallets** (§5A) | X DMs, email, Discord |
| 5 | Post the **escrow** thread (§2B) with `escrows.png`. Timely: the next unlock is 1 December | X |
| 6 | Send 10 cold messages to **merchants / payment apps** (§5B) | email, LinkedIn |
| 7 | Post the **reserve** post (§2C / §3B) with `trustlines.png` | X, r/XRP |
| 8 | Post the LinkedIn post (§6) | LinkedIn |
| 9 | Send 10 cold messages to **exchanges / OTC / custodians** (§5C) | email, LinkedIn |
| 10 | Post the **destination tag** thread (§2D) with `preflight.png` | X |
| 11 | Send 10 cold messages to **token launchpads / DEX front-ends** (§5D) | X, Discord |
| 12 | Follow up everyone who didn't reply (§5E) | same channels |
| 13 | Product Hunt launch (§7), early in the morning US Pacific time | Product Hunt |
| 14 | Show HN (§8); reply to every comment that day | news.ycombinator.com |

**Every day:** reply to 5 XRPL posts where someone lost funds or asks "is this token legit?" with a genuinely helpful answer
and the matching free tool link. That is the highest-converting thing you can do, and it's free.

**Track it:** keep a simple list of who you messaged, the date, and the reply. 40 conversations usually produce the first
trial users; trial users who hit the free limit become paying customers.

---

## 2. X / Twitter threads

### A. Phishing (post with `inbox.png`)
1/ I scanned one ordinary RLUSD holder's XRP Ledger account.
30 incoming transactions carried scam links in their memos. 27 were dust payments.
Here's what XRPL phishing looks like right now 🧵

2/ The most common lure, word for word:
"⌛Incoming Escrow for 259.37 XRP Expires in 24 Hours. Finalize Escrow via [scam site]"
There is no escrow. The site wants your wallet connection or seed.

3/ Another: "🎁 You have been sent a CHECK worth 510XRP! Visit [scam site] to redeem it."
Real XRPL Checks show up in your wallet. They never need a website.

4/ The dust (0.01 XRP or less) is the delivery vehicle: a tiny payment so the memo lands in your history.

5/ I built a free scanner that finds these, plus address-poisoning look-alikes and sanctioned senders, in one click. Read only, no wallet connection:
https://noshguard.vercel.app/xrpl/inbox

6/ Wallets and exchanges: the same scan is an API, so you can warn users before they click.
Free plan: https://rapidapi.com/Ignosha/api/noshguard-xrpl-account-security

### B. Escrow unlock (post with `escrows.png`, before 1 December)
1/ One XRP Ledger account holds 4,000,000,000 XRP in 12 time-locked escrows.
The next 300,000,000 XRP becomes releasable on 1 December 2026, and 500M per month after that.
You can check any account's unlock calendar yourself 🧵

2/ Escrows on XRPL are fully public: amount, release date, expiry, conditions. Most people just never look.

3/ Free calendar: paste any address, see every escrow and how much unlocks each month:
https://noshguard.vercel.app/xrpl/escrows

4/ Traders and researchers: same data by API for dashboards and alerts.
Docs: https://noshguard.vercel.app/api-docs

### C. Recover locked XRP (post with `trustlines.png`)
1/ Every trust line you open locks 0.2 XRP of reserve.
One account I checked had 104 empty trust lines: 20.8 XRP sitting locked for nothing.
Check yours in one click (free, read only): https://noshguard.vercel.app/xrpl/trustlines

2/ It also flags look-alike tokens (fake "USD"/"RLUSD" from unverified issuers), frozen lines and issuers that can claw tokens back.

3/ Wallet devs: show users their recoverable XRP with one API call. Free plan: https://rapidapi.com/Ignosha/api/noshguard-xrpl-account-security

### D. Destination tags (post with `preflight.png`)
1/ Sending XRP to an exchange without a destination tag is the #1 way people "lose" XRP.
Here's a free check that tells you a payment will fail before you sign it 🧵

2/ Paste the address and amount. It predicts the exact ledger result: missing tag, unactivated account, no trust line, frozen token, not enough XRP, and checks the recipient against OFAC.
https://noshguard.vercel.app/xrpl/preflight

3/ Already paid someone, or got paid? Verify shows what actually arrived. A "partial payment" can state $1,000 and deliver cents:
https://noshguard.vercel.app/xrpl/verify

4/ Wallets and merchants: both are one API call. Free plan:
https://rapidapi.com/Ignosha/api/noshguard-xrpl-payment-safety

**Hashtags (max 2 per post):** #XRP #XRPL #XRPCommunity #RLUSD #CryptoSecurity

---

## 3. Reddit (read each subreddit's self-promotion rules first; post as a helpful finding, not an ad)

### A. r/XRP: phishing
**Title:** PSA: the "Incoming Escrow… finalize via [site]" memos are phishing. I found 30 on one account
**Body:**
I've been building XRPL safety tools and scanned an ordinary RLUSD holder's account. 30 incoming transactions had links in
their memos, mostly "⌛Incoming Escrow for 259.37 XRP Expires in 24 Hours. Finalize Escrow via …" and "🎁 You have been
sent a CHECK worth 510XRP! Visit … to redeem it." Plus 27 dust payments that exist only to deliver those memos.

Real escrows and checks appear in your wallet; they never need a website. Don't visit the links, and never enter a seed.

If you want to check your own account, I made a free read-only scanner (no wallet connection, no sign-up):
https://noshguard.vercel.app/xrpl/inbox. Happy to answer questions.

### B. r/XRP: reserve
**Title:** You might have XRP locked in empty trust lines. One account had 20.8 XRP stuck in 104 of them
**Body:** Each trust line holds 0.2 XRP of reserve. If you've tried a lot of tokens, you probably have empty lines you can
remove to get that XRP back. Free read-only checker: https://noshguard.vercel.app/xrpl/trustlines. It also flags fake
"USD"/"RLUSD" look-alikes and frozen tokens. Feedback welcome; I built it.

---

## 4. XRPL developer community (Discord #dev/#showcase, XRPL dev forums)
Built a set of read-only XRPL safety checks, free on the web and as an API:
- **Pre-flight**: predicts tec* results before signing (DST_TAG_NEEDED, NO_DST_INSUF_XRP, PATH_DRY, NO_PERMISSION, UNFUNDED_PAYMENT)
- **Settlement verify**: delivered_amount vs stated, partial payments, two-way xrp-ledger.toml issuer verification
- **Token risk**: freeze/clawback/blackholed, AMM depth, NOSHASHI authority certificate, A to F grade
- **Account security**: control changes (takeover signal), address-poisoning look-alikes, phishing memos, recoverable reserve, escrow calendar
- OFAC/UN/EU/UK screening on every party

Validated ledgers via public nodes; every answer carries its ledger index. Zero-dependency JS/Python examples in the repo.
Wallet and exchange devs: I'd especially value feedback on edge cases. https://noshguard.vercel.app/api-docs

---

## 5. Cold messages (personalize the first line every time)

**Lead magnet that gets replies:** offer a free security report on their own hot wallet, treasury or issuer account. Run
it yourself on the free tools (Inbox, Control, Trust Lines, Token) and paste the results. It costs you 5 minutes and
shows real value before you ask for anything.

### A. XRPL wallets
Subject: Stopping failed sends before your users sign

Hi {name}, I saw {wallet} on XRPL. Users "losing" XRP to missing destination tags, and clicking "incoming escrow"
phishing memos, are the two most common XRPL support tickets. NoshGuard's API predicts a payment's ledger result before
signing and flags phishing memos and look-alike addresses in the user's history, in one call each. Free plans to try it:
https://rapidapi.com/Ignosha/api/noshguard-xrpl-payment-safety and https://rapidapi.com/Ignosha/api/noshguard-xrpl-account-security. I'm happy to run a free scan of {wallet}'s own accounts
and send you the results. Want me to?

### B. Merchants and payment apps accepting XRP or RLUSD
Subject: Partial payments and fake RLUSD before you credit them

Hi {name}, on the XRP Ledger a payment can state $1,000 and deliver cents, and anyone can issue a token called "RLUSD".
NoshGuard's Settlement Verify returns what was actually delivered, whether the token's issuer is the real one, and
whether the sender is sanctioned, before you release goods. One API call, free plan:
https://rapidapi.com/Ignosha/api/noshguard-xrpl-payment-safety. Worth a 15-minute look?

### C. Exchanges, OTC desks, custodians
Subject: Sanctions screening for XRPL deposits, including who funded the address

Hi {name}, NoshGuard screens XRPL counterparties against OFAC, UN, EU and UK lists, including the account that funded
the address and its last 200 counterparties, and verifies deposits (partial payments, counterfeit tokens) before credit.
Every result carries an audit ID and list version for your records. Free plan:
https://rapidapi.com/Ignosha/api/noshguard-sanctions-crypto-wallet-screening. Can I send a sample report on one of your
public deposit addresses?

### D. Token launchpads, DEX front-ends, listing desks
Subject: A to F risk grade for every token you list

Hi {name}, NoshGuard grades any XRPL token A to F in one call: can the issuer freeze or claw back, is its identity
verified through its own xrp-ledger.toml, is there AMM liquidity to exit, and NOSHASHI's issuer certificate. Showing the
grade on listings builds trust and cuts support load. Free plan:
https://rapidapi.com/Ignosha/api/noshguard-xrpl-token-risk. Want a free grade report on your top 10 tokens?

### E. Follow-up (5 to 7 days later, once only)
Hi {name}, following up in case this got buried. Here's a real example of what it catches: {one-line finding for their
account or sector}. Happy to set up a free trial or just send the report. No worries if the timing's wrong.

---

## 6. LinkedIn
Crypto compliance doesn't stop at KYC.

This week, scanning the XRP Ledger, I found an ordinary account receiving 30 phishing memos ("Incoming Escrow… finalize
via [site]"), an account with 20.8 XRP locked in 104 empty trust lines, and payments that state one amount but deliver a
fraction of it.

NoshGuard checks all of this in one API call: whether a payment will land, what really arrived, whether a token is the real
one, whether an account's control just changed, and whether any party is on the OFAC, UN, EU or UK sanctions lists.
Free tools for anyone, plus an API for wallets, exchanges, merchants and fintechs.
https://noshguard.vercel.app · A NOSHASHI product.

---

## 7. Product Hunt
**Name:** NoshGuard
**Tagline:** Catch failed, fake and phishing XRP payments before they cost you
**Description:** Free XRPL safety checks and an API. Pre-flight predicts if a payment will fail. Verify shows what really
arrived (partial payments, counterfeit RLUSD/USDC). Token Risk grades any token A to F. Account Security finds phishing
memos, address poisoning, recoverable XRP reserve and escrow unlocks. OFAC, UN, EU and UK sanctions screening, including
1,000+ sanctioned crypto wallets, on every check. Read only; never asks for keys.
**First comment:** I built this after seeing how XRPL users actually lose money: missing destination tags, partial
payments, fake "USD" tokens and "incoming escrow" phishing memos. One account I scanned had 30 of those memos. Every check
reads the validated ledger directly and shows the ledger index it used. Free on the site; the API has a free plan. I'd
love feedback on what to check next.
**Gallery:** `home.png`, `inbox.png`, `preflight.png`, `escrows.png`, `trustlines.png`

## 8. Show HN
**Title:** Show HN: NoshGuard – XRP Ledger payment pre-flight, phishing-memo detection and sanctions screening
**Text:** Use §4, and add one technical detail people will enjoy: e.g. that `account_lines` filtered by peer can return an
empty page with a marker, so you must keep paging, or how issuer identity is verified two ways (account Domain →
xrp-ledger.toml → listed account).

---

## 9. Offer to use in all posts and DMs
- **Free plan forever** on every API (100 to 200 calls a month): low-risk to try.
- **Free security report** for any business that asks: run the free tools on their accounts and send the results.
- **Pay in crypto, keep 100%** (once direct sales are on): XRP, RLUSD or USDC prepaid credits, no subscription.

## Don'ts
- Don't post a private person's address or imply they did something wrong. Use "one RLUSD holder's account".
- Don't make the scam domains clickable. Write them as plain text with a warning.
- Don't promise profits or say a token is "safe"; say what the check found.
- Don't spam the same text in many groups; change the first lines and follow each community's rules.
