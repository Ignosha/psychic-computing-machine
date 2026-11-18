import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/sanctions", "/xrpl", "/xrpl/preflight", "/xrpl/verify", "/xrpl/token", "/xrpl/control", "/xrpl/inbox", "/xrpl/trustlines", "/xrpl/escrows", "/api-docs", "/terms", "/privacy"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p ? 0.8 : 1 }));
}
