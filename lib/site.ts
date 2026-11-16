export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "RecallRadar";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
// Optional monetization: set NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-XXXX) in Vercel to turn on Google AdSense.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
