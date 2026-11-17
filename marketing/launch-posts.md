# Launch posts

Replace the URL if you add a custom domain. Post from your own accounts; be transparent that you built it.

## Product Hunt
**Name**: NoshGuard
**Tagline** (60 chars): Stop failed, fake and sanctioned crypto payments
**Description**: NoshGuard checks the things that cost crypto businesses money. Before you send XRP, Pre-flight tells you if the payment will fail (missing destination tag, no trust line, frozen token). After you're paid, Settlement Verify shows what really arrived, catching partial payments and counterfeit tokens. Token Risk grades any XRPL token A-F, and Sanctions Screening covers OFAC, UN, EU and UK lists including 1,000+ sanctioned crypto wallets. Free tools on the site; one API to automate. Built with NOSHASHI.
**First comment**: Why I built it: on the XRP Ledger a payment can report success while delivering a fraction of the stated amount, and anyone can issue a token called "USD". Exchanges and merchants have lost money to both. NoshGuard reads the validated ledger directly and verifies issuers through their own xrp-ledger.toml, so the answers come with the ledger index they were read at. Free tier, feedback very welcome.

## Show HN
**Title**: Show HN: NoshGuard – Catch partial payments and fake tokens on the XRP Ledger
**Text**: On the XRP Ledger a Payment can succeed while delivering a tiny fraction of its stated Amount (the "partial payment" flag), and any account can issue a token called USD or RLUSD. Both have cost merchants and exchanges real money. NoshGuard is a set of free checks and an API: Pre-flight predicts whether a payment will fail before you sign it (and with which ledger result code), Settlement Verify reports what was actually delivered and whether the token's issuer passes two-way domain verification, and a token report grades issuers on freeze/clawback powers, identity and liquidity. Sanctions screening (OFAC/UN/EU/UK, including OFAC-listed wallets) runs on every check. Everything is read from validated ledgers via public nodes; no keys are ever requested. Happy to answer questions about the edge cases (e.g. account_lines filtered by peer can return an empty page with a marker).

## Reddit (r/XRP, r/Ripple, r/CryptoCurrency rules permitting; read each subreddit's self-promotion rules first)
**Title**: I built a free tool that tells you if an XRP payment will fail before you send it (and if a payment you received is fake)
**Body**: Losing an exchange deposit to a missing destination tag, or getting "paid" in a fake USD token, are classic XRPL mistakes. NoshGuard has free checks: Pre-flight (will it land?), Verify (what really arrived? partial payment? counterfeit token?), Token Risk (can the issuer freeze or claw back? is it really who it says?). Link: https://noshguard.vercel.app. Built with NOSHASHI. Feedback welcome.

## X / Twitter thread
1/ On the XRP Ledger, a payment can say $1,000 and deliver $0.02. It's called a partial payment, and it's caught plenty of merchants. I built a free checker. 🧵
2/ Paste any tx hash → see what was actually delivered, whether the token is the real RLUSD/USDC or an impostor, and whether the sender is OFAC-listed: https://noshguard.vercel.app/xrpl/verify
3/ Sending instead? Pre-flight tells you if it will fail first: missing destination tag, unactivated account, no trust line, frozen token: /xrpl/preflight
4/ Buying a token? Grade it A–F: freeze/clawback powers, verified issuer, AMM liquidity, NOSHASHI certificate: /xrpl/token
5/ All free on the site; there's an API for wallets, exchanges and merchants. Built with @noshashi.

## LinkedIn
Crypto compliance doesn't stop at KYC. On the XRP Ledger, payments can deliver a fraction of their stated amount and anyone can issue a token named "USD". NoshGuard verifies what was actually delivered, detects counterfeit tokens through issuers' own domain records, predicts payment failures before signing, and screens every party against OFAC, UN, EU and UK sanctions, including OFAC-listed crypto wallets. Free tools and an API for wallets, exchanges, merchants and fintechs. Built with NOSHASHI.

## XRPL developer community
Built an open set of XRPL safety checks you can call before/after payments: pre-flight (predicts tec* codes: DST_TAG_NEEDED, NO_DST_INSUF_XRP, PATH_DRY, NO_PERMISSION, UNFUNDED_PAYMENT), settlement verify (delivered_amount, partial payments, xrp-ledger.toml issuer verification), token risk (freeze/clawback/blackholed, AMM depth, NOSHASHI authority certificate). Read-only, public validated nodes, ledger index on every answer. Feedback from wallet and exchange devs especially welcome.
