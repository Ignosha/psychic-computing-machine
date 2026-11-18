export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "NoshGuard";
export const PARENT_BRAND = { name: "NOSHASHI", url: "https://www.noshashi.app" };
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
// Public support contact shown on the legal pages. Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel; until then the pages point to the marketplace support channel.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
export const LEGAL_UPDATED = "2026-11-18";
// Public RapidAPI listing pages, one per product. Fill in as each listing goes live.
export const LISTING_URLS: Record<"sanctions" | "xrpl-payments" | "xrpl-tokens" | "xrpl-security", string> = {
  sanctions: "https://rapidapi.com/Ignosha/api/noshguard-sanctions-crypto-wallet-screening",
  "xrpl-payments": "",
  "xrpl-tokens": "",
  "xrpl-security": "",
};
export const LISTING_LABELS = { sanctions: "Sanctions & Crypto Wallet Screening", "xrpl-payments": "XRPL Payment Safety", "xrpl-tokens": "XRPL Token Risk", "xrpl-security": "XRPL Account Security" } as const;
