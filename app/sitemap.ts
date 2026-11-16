import type { MetadataRoute } from "next";
import { getMakes, getModels, maxYear, MIN_YEAR, POPULAR, slugify } from "@/lib/nhtsa";
import { SITE_URL } from "@/lib/site";

export const revalidate = 86400;

// Years, every make per year, and model pages for popular brands in recent years (built from live NHTSA listings).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const top = maxYear();
  const years = Array.from({ length: top - MIN_YEAR + 1 }, (_, i) => top - i);
  const out: MetadataRoute.Sitemap = [{ url: SITE_URL, changeFrequency: "daily", priority: 1 }, { url: `${SITE_URL}/recalls` }];
  const makesByYear = await Promise.all(years.map(async (y) => [y, await getMakes(y).catch(() => [] as string[])] as const));
  for (const [y, makes] of makesByYear) {
    if (!makes.length) continue;
    out.push({ url: `${SITE_URL}/recalls/${y}` });
    for (const m of makes) out.push({ url: `${SITE_URL}/recalls/${y}/${slugify(m)}` });
  }
  const jobs = makesByYear.slice(0, 12).flatMap(([y, makes]) => POPULAR.filter((m) => makes.includes(m)).map((m) => [y, m] as const));
  for (let i = 0; i < jobs.length; i += 10) {
    const chunk = await Promise.all(jobs.slice(i, i + 10).map(async ([y, m]) => (await getModels(y, m).catch(() => [] as string[])).map((mo) => `${SITE_URL}/recalls/${y}/${slugify(m)}/${slugify(mo)}`)));
    for (const urls of chunk) for (const url of urls) out.push({ url, changeFrequency: "weekly", priority: 0.8 });
  }
  return out;
}
