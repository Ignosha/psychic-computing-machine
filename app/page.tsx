import Link from "next/link";
import VinForm from "@/components/VinForm";
import VehiclePicker from "@/components/VehiclePicker";
import AdSlot from "@/components/AdSlot";
import { getMakes, maxYear, MIN_YEAR, POPULAR, slugify, titleCase, REVALIDATE } from "@/lib/nhtsa";

export const revalidate = 21600;

export default async function Home() {
  const top = maxYear();
  const years = Array.from({ length: top - MIN_YEAR + 1 }, (_, i) => top - i);
  const year = new Date().getFullYear();
  const makes = await getMakes(year);
  const popular = POPULAR.filter((m) => makes.includes(m));
  return (
    <>
      <section className="hero">
        <h1>Is your car under recall?</h1>
        <p className="lead">Free, instant check using live U.S. government (NHTSA) safety data: recalls, owner complaints and crash-test ratings for every make and model.</p>
      </section>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Check by VIN</h2>
        <VinForm />
      </section>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Or pick your vehicle</h2>
        <VehiclePicker years={years} />
      </section>
      <AdSlot />
      <h2>{year} recalls by brand</h2>
      <ul className="grid">
        {popular.map((m) => <li key={m}><Link href={`/recalls/${year}/${slugify(m)}`}>{titleCase(m)}</Link></li>)}
        <li><Link href={`/recalls/${year}`}>All {makes.length} makes →</Link></li>
      </ul>
      <h2>Browse by model year</h2>
      <ul className="grid">
        {years.slice(0, 12).map((y) => <li key={y}><Link href={`/recalls/${y}`}>{y}</Link></li>)}
        <li><Link href="/recalls">Older years →</Link></li>
      </ul>
      <p className="muted small">Data refreshed every {REVALIDATE / 3600} hours from NHTSA.</p>
    </>
  );
}
