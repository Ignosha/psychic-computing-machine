import { getMakes, validYear } from "@/lib/nhtsa";
export async function GET(req: Request) {
  const y = validYear(new URL(req.url).searchParams.get("year") || "");
  if (!y) return Response.json({ makes: [] }, { status: 400 });
  return Response.json({ makes: await getMakes(y) }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
