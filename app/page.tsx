import Link from "next/link";
import { PARENT_BRAND, SITE_NAME } from "@/lib/site";
import { listsInfo } from "@/lib/sanctions/api";
import { walletCount } from "@/lib/sanctions/wallets";

const TOOLS = [
  { href: "/xrpl/preflight", title: "Payment Pre-flight", tag: "Before you send", body: "Will this XRP or token payment land? Predicts the exact ledger error (missing destination tag, unactivated account, no trust line, frozen token, unfunded sender) and screens both parties for sanctions. Stop paying fees for failures and losing funds to untagged exchange deposits." },
  { href: "/xrpl/verify", title: "Settlement Verify", tag: "After you're paid", body: "Did you really get paid? Catches partial payments that state $1,000 but deliver cents, counterfeit tokens posing as USD, RLUSD or USDC from impostor issuers, wrong tags and sanctioned senders." },
  { href: "/xrpl/token", title: "Token Risk Report", tag: "Before you trade or list", body: "A graded report on any XRPL token: what the issuer can still do (freeze, claw back, fees), whether its identity is verified, AMM and order-book liquidity, supply, NOSHASHI's authority certificate and sanctions." },
  { href: "/xrpl", title: "XRPL Counterparty Check", tag: "Who am I dealing with?", body: "One verdict on any XRP Ledger address: sanctions on the address, who funded it and who it recently dealt with, plus its account settings and issuer powers." },
  { href: "/sanctions", title: "Sanctions & Wallet Screening", tag: "Every customer and wallet", body: "People, companies and crypto wallets against OFAC, UN, EU and UK lists, with fuzzy multilingual name matching, DOB and country filters, and daily monitoring with webhook alerts." },
];

export default function Home() {
  const info = listsInfo();
  return (
    <>
      <section className="hero">
        <h1>Crypto payments that land, settle and stay compliant</h1>
        <p className="lead">{SITE_NAME} checks the things that cost crypto businesses money: payments that fail or vanish, fake tokens, risky issuers and sanctioned counterparties. Live XRP Ledger data and {info.totalRecords.toLocaleString()} official sanctions records, including {walletCount().toLocaleString()} sanctioned crypto wallets. Free to try, one API to automate.</p>
        <p><Link href="/api-docs"><button>Get API access</button></Link></p>
      </section>
      <div className="plans">{TOOLS.map((t) => (
        <Link href={t.href} key={t.href} className="card toolcard"><span className="tag blue">{t.tag}</span><h2 style={{ margin: "8px 0 6px", fontSize: 20 }}>{t.title}</h2><p className="small muted" style={{ margin: 0 }}>{t.body}</p></Link>
      ))}</div>
      <h2>Who it&apos;s for</h2>
      <div className="card"><ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Wallets and payment apps:</b> pre-flight every send so users never lose funds to a missing destination tag.</li>
        <li><b>Merchants and exchanges accepting XRP, RLUSD or tokens:</b> verify settlement before crediting; reject partial payments and counterfeits.</li>
        <li><b>Traders, DEX front-ends and listing desks:</b> grade a token before listing or buying it.</li>
        <li><b>Fintechs and crypto businesses:</b> screen customers and wallets, and monitor them daily.</li>
      </ul></div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Built with {PARENT_BRAND.name}</h2>
        <p style={{ marginBottom: 0 }}>{SITE_NAME} is part of <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a>, the XRPL intelligence workstation that answers <i>can this move?</i> and <i>can it actually exit?</i> from the same validated ledger, with SHA-256 evidence for every decision. Institutions needing policy engines, four-eyes approvals and audit exports: <a href={PARENT_BRAND.url} rel="noopener">see {PARENT_BRAND.name}</a>.</p>
      </div>
    </>
  );
}
