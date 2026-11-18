export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "NoshGuard";
export const PARENT_BRAND = { name: "NOSHASHI", url: "https://www.noshashi.app" };
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
// Public support contact shown in the footer and on the legal pages (override with NEXT_PUBLIC_CONTACT_EMAIL).
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "noshguard.support@gmail.com";
export const LEGAL_UPDATED = "2026-11-18";
// Public RapidAPI listing pages, one per product. Fill in as each listing goes live.
export const LISTING_URLS: Record<"sanctions" | "xrpl-payments" | "xrpl-tokens" | "xrpl-security", string> = {
  sanctions: "https://rapidapi.com/Ignosha/api/noshguard-sanctions-crypto-wallet-screening",
  "xrpl-payments": "https://rapidapi.com/Ignosha/api/noshguard-xrpl-payment-safety",
  "xrpl-tokens": "https://rapidapi.com/Ignosha/api/noshguard-xrpl-token-risk",
  "xrpl-security": "https://rapidapi.com/Ignosha/api/noshguard-xrpl-account-security",
};
export const LISTING_LABELS = { sanctions: "Sanctions & Crypto Wallet Screening", "xrpl-payments": "XRPL Payment Safety", "xrpl-tokens": "XRPL Token Risk", "xrpl-security": "XRPL Account Security" } as const;
