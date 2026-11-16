import { envelope, error, formatRecall, getCampaign, handler, json, options } from "@/lib/api";

export const OPTIONS = options;
export const GET = handler<{ params: Promise<{ campaign: string }> }>(async (req, { params }) => {
  const id = (await params).campaign.toUpperCase();
  if (!/^[0-9]{2}[A-Z][0-9]{6}$/.test(id)) return error(400, "invalid_campaign", "Campaign numbers look like 20V314000.");
  const rows = await getCampaign(id);
  if (!rows.length) return error(404, "not_found", "No recall with that campaign number.");
  const affected = [...new Map(rows.filter((r) => r.Make).map((r) => [`${r.ModelYear}|${r.Make}|${r.Model}`, { year: Number(r.ModelYear), make: r.Make, model: r.Model }])).values()];
  return json(envelope({ ...formatRecall(rows[0]), affectedVehicles: affected }));
});
