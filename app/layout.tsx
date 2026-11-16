import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ADSENSE_CLIENT, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Free Vehicle Recall & VIN Check`, template: `%s | ${SITE_NAME}` },
  description: "Free car recall lookup by VIN or make and model. Live NHTSA recall, complaint and crash-test data, updated every few hours.",
  openGraph: { siteName: SITE_NAME, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {ADSENSE_CLIENT && (
          <Script async strategy="afterInteractive" crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} />
        )}
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo"><span aria-hidden>◉</span> {SITE_NAME}</Link>
            <nav><Link href="/recalls">Browse by year</Link> · <Link href="/developers">API</Link></nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap foot muted small">
          <p>Data: U.S. National Highway Traffic Safety Administration (NHTSA) public APIs, refreshed every 6 hours. {SITE_NAME} is
            an independent site, not affiliated with NHTSA or any manufacturer. Recall repairs are free at authorized dealers. Always confirm
            open recalls for your exact vehicle at <a href="https://www.nhtsa.gov/recalls" rel="noopener">nhtsa.gov/recalls</a>.</p>
        </footer>
      </body>
    </html>
  );
}
