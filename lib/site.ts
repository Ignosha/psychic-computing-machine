export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "NoshGuard";
export const PARENT_BRAND = { name: "NOSHASHI", url: "https://www.noshashi.app" };
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
// Public support contact shown on the legal pages. Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel; until then the pages point to the marketplace support channel.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
export const LEGAL_UPDATED = "2026-11-18";
