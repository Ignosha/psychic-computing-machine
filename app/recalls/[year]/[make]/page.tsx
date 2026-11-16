import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getModels, resolveMake, slugify, titleCase, validYear } from "@/lib/nhtsa";

export const revalidate = 21600;
export async function generateStaticParams() { return []; } // render on first visit, then cache (ISR)
type P = { params: Promise<{ year: string; make: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { year, make } = await params;
  const y = validYear(year);
  const m = y && (await resolveMake(y, make));
  if (!m) return {};
  return { title: `${year} ${titleCase(m)} Recalls`, description: `All ${year} ${titleCase(m)} models with NHTSA safety recalls. Select a model for recall details, owner complaints and crash ratings.`, alternates: { canonical: `/recalls/${year}/${make}` } };
}

export default async function MakePage({ params }: P) {
  const { year, make } = await params;
  const y = validYear(year);
  const m = y && (await resolveMake(y, make));
  if (!y || !m) notFound();
  const models = await getModels(y, m);
  const name = titleCase(m);
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / <Link href={`/recalls/${y}`}>{y}</Link> / {name}</p>
      <h1>{y} {name} recalls</h1>
      <p className="muted">{models.length} {y} {name} model{models.length === 1 ? "" : "s"} with NHTSA recalls. Choose yours:</p>
      <ul className="grid">{models.map((mo) => <li key={mo}><Link href={`/recalls/${y}/${make}/${slugify(mo)}`}>{titleCase(mo)}</Link></li>)}</ul>
      <h2>Other years</h2>
      <ul className="grid">{[y + 1, y - 1, y - 2, y - 3].filter((v) => validYear(String(v))).map((v) => <li key={v}><Link href={`/recalls/${v}/${make}`}>{v} {name}</Link></li>)}</ul>
    </>
  );
}
