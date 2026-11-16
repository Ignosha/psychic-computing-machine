import { getModels, validYear } from "@/lib/nhtsa";
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const y = validYear(p.get("year") || "");
  const make = (p.get("make") || "").slice(0, 60);
  if (!y || !make) return Response.json({ models: [] }, { status: 400 });
  return Response.json({ models: await getModels(y, make) }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
