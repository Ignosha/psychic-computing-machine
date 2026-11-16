import { envelope, error, handler, json, options } from "@/lib/api";
import { formatEntry } from "@/lib/sanctions/api";
import { loadDb } from "@/lib/sanctions/match";

export const OPTIONS = options;
export const GET = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const e = loadDb().byId.get((await params).id.slice(0, 80));
  return e ? json(envelope(formatEntry(e, 1000))) : error(404, "not_found", "No sanctions record with that id.");
});
