export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "NoshGuard";
export const PARENT_BRAND = { name: "NOSHASHI", url: "https://www.noshashi.app" };
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
