import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VehicleReport from "@/components/VehicleReport";
import VinForm from "@/components/VinForm";
import { decodeVin, slugify, titleCase, VIN_RE } from "@/lib/nhtsa";

type P = { params: Promise<{ vin: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { vin } = await params;
  return { title: `VIN ${vin.toUpperCase()} Recall Check`, robots: { index: false, follow: true } };
}

export default async function VinPage({ params }: P) {
  const vin = (await params).vin.toUpperCase();
  if (!VIN_RE.test(vin)) notFound();
  const v = await decodeVin(vin);
  if (!v || !v.make || !v.model || !v.year) {
    return (
      <>
        <h1>We couldn’t decode that VIN</h1>
        <p className="muted">{v?.error || "NHTSA did not return a vehicle for this VIN."} Double-check the characters and try again.</p>
        <div className="panel"><VinForm initial={vin} /></div>
      </>
    );
  }
  const name = `${v.year} ${titleCase(v.make)} ${titleCase(v.model)}`;
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / VIN check</p>
      <h1>{name}</h1>
      <div className="card">
        <dl className="recall" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: 0 }}>
          <dt>VIN</dt><dd style={{ fontFamily: "ui-monospace,monospace" }}>{vin}</dd>
          {v.trim && <><dt>Trim</dt><dd>{v.trim}</dd></>}
          {v.body && <><dt>Body</dt><dd>{v.body}</dd></>}
          {v.engine && <><dt>Engine</dt><dd>{v.engine}{v.fuel ? ` · ${v.fuel}` : ""}</dd></>}
          {v.plant && <><dt>Built in</dt><dd>{titleCase(v.plant)}</dd></>}
        </dl>
      </div>
      <div className="card small">
        Below are all recalls for the {name} model line. To confirm whether <b>this specific VIN</b> still has an unrepaired recall, use
        NHTSA’s official VIN lookup at <a href="https://www.nhtsa.gov/recalls" rel="noopener">nhtsa.gov/recalls</a> or call a {titleCase(v.make)} dealer.
        {" "}<Link href={`/recalls/${v.year}/${slugify(v.make)}/${slugify(v.model)}`}>Model overview page →</Link>
      </div>
      <VehicleReport year={v.year} make={v.make} model={v.model} />
    </>
  );
}
