import Link from "next/link";
import { PARENT_BRAND, SITE_NAME } from "@/lib/site";
import { listsInfo } from "@/lib/sanctions/api";
import { walletCount } from "@/lib/sanctions/wallets";

// Explanatory geometry only: three stacked plates for the three checks. It encodes no measurement.
function Plates() {
  const plate = (y: number, label: string, rings: boolean) => (
    <g key={label} transform={`translate(0 ${y})`}>
      <polygon points="260,20 480,105 260,190 40,105" fill="var(--ground)" stroke="currentColor" strokeWidth="1" />
      <polygon points="40,105 260,190 260,198 40,113" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".6" />
      <polygon points="480,105 260,190 260,198 480,113" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".6" />
      {rings && <><ellipse cx="260" cy="105" rx="96" ry="37" fill="none" stroke="currentColor" strokeWidth=".7" opacity=".7" />
        <ellipse cx="260" cy="105" rx="52" ry="20" fill="none" stroke="currentColor" strokeWidth=".7" opacity=".7" />
        <line x1="160" y1="105" x2="360" y2="105" stroke="currentColor" strokeWidth=".5" opacity=".5" />
        <line x1="260" y1="66" x2="260" y2="144" stroke="currentColor" strokeWidth=".5" opacity=".5" /></>}
      <text x="72" y="112" fill="var(--ink)" fontFamily="IBM Plex Mono, monospace" fontSize="12" letterSpacing="1.5">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 520 330" role="img" aria-label="Three stacked plates: pre-flight, verify and screen. Explanatory geometry, not a measured chart.">
      <ellipse cx="260" cy="210" rx="250" ry="88" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".35" />
      {plate(120, "03 / SCREEN", false)}{plate(60, "02 / VERIFY", false)}{plate(0, "01 / PRE-FLIGHT", true)}
    </svg>
  );
}

const STEPS = [
  { n: "01 / PRE-FLIGHT", q: "Will it land?", body: "Predicts the exact ledger result before anyone signs: missing destination tag, unactivated account, no trust line, frozen token, unfunded sender.", href: "/xrpl/preflight", cta: "Check a payment" },
  { n: "02 / VERIFY", q: "What arrived?", body: "Delivered amount, not stated amount. Catches partial payments and counterfeit USD, RLUSD or USDC from impostor issuers.", href: "/xrpl/verify", cta: "Verify a payment" },
  { n: "03 / ASSESS", q: "Is the token sound?", body: "Issuer powers, verified identity, liquidity to exit and the NOSHASHI authority certificate, graded A to F.", href: "/xrpl/token", cta: "Grade a token" },
  { n: "04 / SCREEN", q: "Who is on the other side?", body: "OFAC, UN, EU and UK lists for names and wallets, plus who funded an address and who it dealt with.", href: "/xrpl", cta: "Screen a counterparty" },
];

export default function Home() {
  const info = listsInfo();
  return (
    <>
      <section className="split">
        <div>
          <p className="eyebrow">XRPL payment safety &amp; crypto compliance</p>
          <h1>Every crypto payment, checked <em>before</em> it costs you.</h1>
          <p className="lead">Payments that fail or vanish, tokens that only look like dollars, issuers that can freeze you, counterparties under sanctions. {SITE_NAME} reads the validated XRP Ledger and {info.totalRecords.toLocaleString()} official sanctions records, including {walletCount().toLocaleString()} sanctioned crypto wallets, and answers in one call.</p>
          <div className="cta">
            <Link className="btn" href="/xrpl/preflight">Try a free check <span className="arrow">↗</span></Link>
            <Link className="btn ghost" href="/api-docs">API &amp; pricing <span className="arrow">→</span></Link>
          </div>
          <p className="small muted">Free public tools · No account or wallet connection · Read only</p>
        </div>
        <figure className="fig" style={{ margin: 0 }}>
          <div className="fig-head"><span className="label">Fig. 01 / Three checks, one ledger</span><span className="label">Explanatory</span></div>
          <Plates />
          <figcaption className="fig-head"><span className="label">Read → check → decide</span><span className="label">N / XRPL</span></figcaption>
          <p className="label" style={{ marginTop: 10 }}>Explanatory geometry. Not a measured chart.</p>
        </figure>
      </section>

      <div className="cols">
        {STEPS.map((s) => (
          <Link key={s.n} href={s.href} className="cols-item">
            <span className="label">{s.n}</span>
            <h3>{s.q}</h3>
            <p>{s.body}</p>
            <span className="go">{s.cta} →</span>
          </Link>
        ))}
      </div>

      <p className="eyebrow">Account security</p>
      <h2>Protect the <em>account</em>, not just the payment.</h2>
      <div className="cols" style={{ marginTop: 18 }}>
        {[
          { n: "05 / CONTROL", q: "Who can sign?", body: "Keys, multi-signing and recent control changes: the takeover signal to check before a large payment.", href: "/xrpl/control", cta: "Audit control" },
          { n: "06 / INBOX", q: "Is someone baiting you?", body: "Address-poisoning look-alikes, phishing links in memos, dust spam and sanctioned senders.", href: "/xrpl/inbox", cta: "Scan an inbox" },
          { n: "07 / TRUST LINES", q: "Where is your XRP locked?", body: "Empty lines you can remove to recover reserve, plus look-alike and frozen tokens you hold.", href: "/xrpl/trustlines", cta: "Audit trust lines" },
          { n: "08 / ESCROW", q: "When does supply unlock?", body: "Every escrow on an account and how much becomes releasable each month.", href: "/xrpl/escrows", cta: "See the calendar" },
        ].map((s) => (
          <Link key={s.n} href={s.href} className="cols-item"><span className="label">{s.n}</span><h3>{s.q}</h3><p>{s.body}</p><span className="go">{s.cta} →</span></Link>
        ))}
      </div>

      <p className="eyebrow">Who it&apos;s for</p>
      <h2>Built for the desks that move <em>real</em> money.</h2>
      <div className="plans">
        <div className="card"><span className="label">Wallets &amp; payment apps</span><p>Pre-flight every send so users never lose funds to a missing destination tag.</p></div>
        <div className="card"><span className="label">Merchants &amp; exchanges</span><p>Verify settlement before crediting; reject partial payments and counterfeits.</p></div>
        <div className="card"><span className="label">Traders &amp; listing desks</span><p>Grade a token before listing or buying it.</p></div>
        <div className="card"><span className="label">Fintechs &amp; compliance</span><p>Screen customers and wallets, and monitor them daily with webhook alerts.</p></div>
      </div>

      <section className="nosh">
        <div><p className="label">A {PARENT_BRAND.name} product</p><h2 style={{ marginTop: 8 }}>Need the full desk?</h2></div>
        <div>
          <p>{SITE_NAME} is the quick-check layer of <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a>, the XRPL intelligence workstation that answers <em>can this move?</em> and <em>can it actually exit?</em> from the same validated ledger, with SHA-256 evidence for every decision, configurable policies and four-eyes approvals.</p>
          <a className="btn ghost" href={PARENT_BRAND.url} rel="noopener">Explore {PARENT_BRAND.name} <span className="arrow">↗</span></a>
        </div>
      </section>
    </>
  );
}
