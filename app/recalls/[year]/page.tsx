import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMakes, POPULAR, slugify, titleCase, validYear } from "@/lib/nhtsa";

export const revalidate = 21600;
export async function generateStaticParams() { return []; } // render on first visit, then cache (ISR)
type P = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} Vehicle Recalls by Make`, description: `Every ${year} car, truck and SUV brand with NHTSA safety recalls. Pick a make to see models and open recalls.`, alternates: { canonical: `/recalls/${year}` } };
}

export default async function YearPage({ params }: P) {
  const y = validYear((await params).year);
  if (!y) notFound();
  const makes = await getMakes(y);
  if (!makes.length) notFound();
  const popular = POPULAR.filter((m) => makes.includes(m));
  const rest = makes.filter((m) => !POPULAR.includes(m));
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / <Link href="/recalls">Years</Link> / {y}</p>
      <h1>{y} recalls by make</h1>
      <p className="muted">{makes.length} manufacturers have at least one NHTSA recall on a {y} model-year vehicle or equipment.</p>
      {popular.length > 0 && <><h2>Popular brands</h2>
        <ul className="grid">{popular.map((m) => <li key={m}><Link href={`/recalls/${y}/${slugify(m)}`}>{titleCase(m)}</Link></li>)}</ul></>}
      <h2>All other makes</h2>
      <ul className="grid">{rest.map((m) => <li key={m}><Link href={`/recalls/${y}/${slugify(m)}`}>{titleCase(m)}</Link></li>)}</ul>
    </>
  );
}
