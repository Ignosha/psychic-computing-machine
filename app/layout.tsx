import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { validatedLedger } from "@/lib/ledger-status";
import { PARENT_BRAND, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: Crypto Compliance & XRPL Payment Safety`, template: `%s | ${SITE_NAME}` },
  description: "Sanctions and wallet screening, XRPL payment pre-flight, settlement verification with counterfeit-token detection, and token risk reports. Free tools and APIs, a NOSHASHI product.",
  openGraph: { siteName: SITE_NAME, type: "website" },
};

// Applies a saved theme before first paint so the page doesn't flash.
const themeScript = `try{var t=localStorage.getItem("ng-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function Monogram() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="12.2" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".55" />
      <text x="16" y="21.2" textAnchor="middle" fontFamily="Instrument Serif, Georgia, serif" fontSize="16" fill="currentColor">G</text></svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ledger = await validatedLedger();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo"><Monogram /> {SITE_NAME}</Link>
            <nav>
              <Link href="/xrpl/preflight">Pre-flight</Link><Link href="/xrpl/verify">Verify</Link><Link href="/xrpl/token">Token risk</Link>
              <Link href="/xrpl">Counterparty</Link><Link href="/sanctions">Sanctions</Link>
            </nav>
            <div className="hdr-actions">
              <ThemeToggle />
              <a className="btn ghost" href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a>
              <Link className="btn" href="/api-docs">Get API access</Link>
            </div>
          </div>
        </header>
        <div className="wrap desk">
          <span className="name"><span className={`dot${ledger ? "" : " off"}`} aria-hidden /> The Ledger Desk</span>
          <span>Ledger connection / {ledger ? "OPERATIONAL" : "UNAVAILABLE"}</span>
          <span>{ledger ? <>Validated ledger <b>#{ledger.toLocaleString("en-US")}</b> · </> : null}{today}</span>
        </div>
        <main className="wrap">{children}</main>
        <footer className="wrap foot">
          <p>Data: sanctions from OFAC (U.S. Treasury), the UN Security Council, the EU and the UK FCDO, refreshed every 6 hours; XRP Ledger facts from public
            validated nodes at the ledger index shown; issuer identity from each issuer&apos;s own xrp-ledger.toml; issuer authority certificates by{" "}
            <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a>. Read only: {SITE_NAME} never asks for keys and never signs. Results are information for your own review, not legal or financial advice.</p>
          <p>{SITE_NAME} · a <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a> product · <Link href="/api-docs">API &amp; pricing</Link></p>
        </footer>
      </body>
    </html>
  );
}
