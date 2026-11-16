import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RecallCard from "@/components/RecallCard";
import AdSlot from "@/components/AdSlot";
import { getCampaign, slugify, titleCase } from "@/lib/nhtsa";

export const revalidate = 21600;
export async function generateStaticParams() { return []; } // render on first visit, then cache (ISR)
type P = { params: Promise<{ id: string }> };
const ok = (id: string) => /^[0-9]{2}[A-Z][0-9]{6}$/.test(id);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const id = (await params).id.toUpperCase();
  const rows = ok(id) ? await getCampaign(id) : [];
  if (!rows.length) return {};
  return { title: `Recall ${id}: ${titleCase(rows[0].Component.split(":")[0])} — ${rows[0].Manufacturer}`, description: rows[0].Summary.slice(0, 155), alternates: { canonical: `/campaign/${id}` } };
}

export default async function Campaign({ params }: P) {
  const id = (await params).id.toUpperCase();
  if (!ok(id)) notFound();
  const rows = await getCampaign(id);
  if (!rows.length) notFound();
  const vehicles = [...new Map(rows.filter((r) => r.Make && r.Model).map((r) => [`${r.ModelYear}|${r.Make}|${r.Model}`, r])).values()]
    .sort((a, b) => Number(b.ModelYear) - Number(a.ModelYear) || (a.Make! + a.Model).localeCompare(b.Make! + b.Model!));
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / Recall {id}</p>
      <h1>Recall #{id}</h1>
      <p className="muted">{rows[0].Manufacturer} · {vehicles.length} affected vehicle model{vehicles.length === 1 ? "" : "s"}{rows[0].PotentialNumberofUnitsAffected ? ` · ~${rows[0].PotentialNumberofUnitsAffected.toLocaleString()} units affected` : ""}</p>
      <RecallCard r={rows[0]} />
      {rows[0].Notes && <p className="small muted">{rows[0].Notes}</p>}
      <AdSlot />
      <h2>Affected vehicles</h2>
      <ul className="grid">{vehicles.map((r) => (
        <li key={`${r.ModelYear}${r.Make}${r.Model}`}><Link href={`/recalls/${r.ModelYear}/${slugify(r.Make!)}/${slugify(r.Model!)}`}>{r.ModelYear} {titleCase(r.Make!)} {titleCase(r.Model!)}</Link></li>
      ))}</ul>
    </>
  );
}
