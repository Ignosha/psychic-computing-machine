"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VinForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [vin, setVin] = useState(initial);
  const clean = vin.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ok = /^[A-HJ-NPR-Z0-9]{17}$/.test(clean);
  return (
    <form className="vinform" onSubmit={(e) => { e.preventDefault(); if (ok) router.push(`/vin/${clean}`); }}>
      <label htmlFor="vin" className="sr">VIN</label>
      <input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} maxLength={20} autoComplete="off"
        spellCheck={false} placeholder="Enter 17-character VIN" aria-describedby="vinhelp" />
      <button type="submit" disabled={!ok}>Check VIN</button>
      <p id="vinhelp" className="muted small">
        {clean.length > 0 && !ok ? `${clean.length}/17 characters (VINs never use I, O or Q)` : "Find it on your dashboard (driver side), door jamb, registration or insurance card."}
      </p>
    </form>
  );
}
