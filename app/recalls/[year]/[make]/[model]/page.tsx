import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VehicleReport from "@/components/VehicleReport";
import VinForm from "@/components/VinForm";
import { getRecalls, resolveMake, resolveModel, titleCase, validYear } from "@/lib/nhtsa";

export const revalidate = 21600;
export async function generateStaticParams() { return []; } // render on first visit, then cache (ISR)
type P = { params: Promise<{ year: string; make: string; model: string }> };

async function resolve(p: Awaited<P["params"]>) {
  const y = validYear(p.year);
  const make = y && (await resolveMake(y, p.make));
  const model = y && make && (await resolveModel(y, make, p.model));
  return y && make && model ? { y, make, model } : null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await params;
  const v = await resolve(p);
  if (!v) return {};
  const n = (await getRecalls(v.y, v.make, v.model)).length;
  const name = `${v.y} ${titleCase(v.make)} ${titleCase(v.model)}`;
  return {
    title: `${name} Recalls (${n}) & Complaints`,
    description: `${name}: ${n} NHTSA safety recall${n === 1 ? "" : "s"}, owner complaints and crash-test ratings. Live government data, updated every 6 hours.`,
    alternates: { canonical: `/recalls/${p.year}/${p.make}/${p.model}` },
  };
}

export default async function ModelPage({ params }: P) {
  const p = await params;
  const v = await resolve(p);
  if (!v) notFound();
  const mk = titleCase(v.make), md = titleCase(v.model);
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / <Link href={`/recalls/${v.y}`}>{v.y}</Link> / <Link href={`/recalls/${v.y}/${p.make}`}>{mk}</Link> / {md}</p>
      <h1>{v.y} {mk} {md} recalls</h1>
      <p className="muted">Recalls apply to some vehicles in a model line, not always every one. Enter your VIN to see your exact vehicle.</p>
      <div className="panel"><VinForm /></div>
      <VehicleReport year={v.y} make={v.make} model={v.model} />
      <h2>Other years</h2>
      <ul className="grid">{[v.y + 1, v.y - 1, v.y - 2].filter((x) => validYear(String(x))).map((x) => (
        <li key={x}><Link href={`/recalls/${x}/${p.make}/${p.model}`}>{x} {mk} {md}</Link></li>))}</ul>
    </>
  );
}
