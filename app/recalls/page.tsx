import Link from "next/link";
import type { Metadata } from "next";
import { maxYear, MIN_YEAR } from "@/lib/nhtsa";

export const metadata: Metadata = { title: "Vehicle Recalls by Model Year", alternates: { canonical: "/recalls" } };

export default function Years() {
  const top = maxYear();
  const years = Array.from({ length: top - MIN_YEAR + 1 }, (_, i) => top - i);
  return (
    <>
      <h1>Vehicle recalls by model year</h1>
      <ul className="grid">{years.map((y) => <li key={y}><Link href={`/recalls/${y}`}>{y} recalls</Link></li>)}</ul>
    </>
  );
}
