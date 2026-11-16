"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function VehiclePicker({ years }: { years: number[] }) {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [make, setMake] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMake(""); setMakes([]); setModels([]); setModel("");
    if (!year) return;
    setLoading(true);
    fetch(`/api/makes?year=${year}`).then((r) => r.json()).then((d) => setMakes(d.makes ?? [])).finally(() => setLoading(false));
  }, [year]);
  useEffect(() => {
    setModels([]); setModel("");
    if (!make) return;
    setLoading(true);
    fetch(`/api/models?year=${year}&make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setModels(d.models ?? [])).finally(() => setLoading(false));
  }, [make, year]);

  return (
    <form className="picker" onSubmit={(e) => { e.preventDefault(); if (model) router.push(`/recalls/${year}/${slugify(make)}/${slugify(model)}`); }}>
      <select aria-label="Model year" value={year} onChange={(e) => setYear(e.target.value)}>
        <option value="">Year</option>
        {years.map((y) => <option key={y}>{y}</option>)}
      </select>
      <select aria-label="Make" value={make} onChange={(e) => setMake(e.target.value)} disabled={!makes.length}>
        <option value="">{loading && year && !makes.length ? "Loading…" : "Make"}</option>
        {makes.map((m) => <option key={m}>{m}</option>)}
      </select>
      <select aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length}>
        <option value="">{loading && make && !models.length ? "Loading…" : "Model"}</option>
        {models.map((m) => <option key={m}>{m}</option>)}
      </select>
      <button type="submit" disabled={!model}>Show recalls</button>
    </form>
  );
}
