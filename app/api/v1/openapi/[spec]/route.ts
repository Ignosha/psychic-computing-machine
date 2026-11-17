import { LISTING_IDS, specFor, type ListingId } from "@/lib/sanctions/openapi";

// /api/v1/openapi/all.json, sanctions.json, xrpl-payments.json, xrpl-tokens.json
export async function GET(_req: Request, { params }: { params: Promise<{ spec: string }> }) {
  const id = (await params).spec.replace(/\.json$/, "") as ListingId;
  if (!LISTING_IDS.includes(id)) return Response.json({ error: { code: "not_found", message: `Specs: ${LISTING_IDS.map((x) => `${x}.json`).join(", ")}` } }, { status: 404 });
  return Response.json(specFor(id), { headers: { "Access-Control-Allow-Origin": "*" } });
}
