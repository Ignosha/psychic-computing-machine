import type { Metadata } from "next";
import Link from "next/link";
import { PARENT_BRAND, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: Crypto Compliance & XRPL Payment Safety APIs`, template: `%s | ${SITE_NAME}` },
  description: "Sanctions and wallet screening, XRPL payment pre-flight, settlement verification with counterfeit-token detection, and token risk reports. Free tools and APIs, by NOSHASHI.",
  openGraph: { siteName: SITE_NAME, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="promo"><div className="wrap">{SITE_NAME} is a <a href={PARENT_BRAND.url} rel="noopener"><b>{PARENT_BRAND.name}</b></a> product. For institutional XRPL compliance and liquidity analysis, <a href={PARENT_BRAND.url} rel="noopener">try {PARENT_BRAND.name} →</a></div></div>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo"><span aria-hidden>◉</span> {SITE_NAME}</Link>
            <nav>
              <Link href="/sanctions">Sanctions</Link> · <Link href="/xrpl">XRPL check</Link> · <Link href="/xrpl/preflight">Pre-flight</Link> · <Link href="/xrpl/verify">Verify</Link> · <Link href="/xrpl/token">Token risk</Link> · <Link href="/api-docs"><b>API</b></Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap foot muted small">
          <p>Data sources: sanctions from OFAC (U.S. Treasury), the UN Security Council, the EU and the UK FCDO, refreshed every 6 hours; XRP Ledger facts from public
            validated nodes at the ledger index shown; issuer identity from each issuer&apos;s own xrp-ledger.toml; issuer authority certificates by{" "}
            <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a>. Results are information for your own review, not legal or financial advice.</p>
          <p>{SITE_NAME} by <a href={PARENT_BRAND.url} rel="noopener">{PARENT_BRAND.name}</a> · <Link href="/api-docs">API &amp; pricing</Link></p>
        </footer>
      </body>
    </html>
  );
}
