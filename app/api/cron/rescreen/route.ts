import { timingSafeEqual } from "node:crypto";
import { deliverPending, rescreenDue } from "@/lib/sanctions/monitor";
import { monitoringConfigured } from "@/lib/sanctions/store";

// Vercel Cron calls this daily (vercel.json) with "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;

export async function GET(req: Request) {
  const want = process.env.CRON_SECRET || "";
  const got = req.headers.get("authorization") || "";
  const ok = want && got.length === want.length + 7 && timingSafeEqual(Buffer.from(got), Buffer.from(`Bearer ${want}`));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!monitoringConfigured()) return Response.json({ skipped: "monitoring not configured" });
  const start = Date.now();
  const rescreen = await rescreenDue(start + 220_000);
  const delivery = await deliverPending(start + 280_000);
  return Response.json({ ...rescreen, ...delivery, ms: Date.now() - start });
}
