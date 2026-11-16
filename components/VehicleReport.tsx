import RecallCard from "./RecallCard";
import AdSlot from "./AdSlot";
import { getComplaintSummary, getRecalls, getSafetyRatings, titleCase } from "@/lib/nhtsa";

const stars = (v: string) => (/^\d$/.test(v) ? "★".repeat(+v) + "☆".repeat(5 - +v) : "Not rated");

export default async function VehicleReport({ year, make, model }: { year: string | number; make: string; model: string }) {
  const [recalls, complaints, ratings] = await Promise.all([
    getRecalls(year, make, model),
    getComplaintSummary(year, make, model),
    getSafetyRatings(year, make, model),
  ]);
  const name = `${year} ${titleCase(make)} ${titleCase(model)}`;
  const urgent = recalls.filter((r) => r.parkIt || r.parkOutSide).length;
  const maxC = complaints.byComponent[0]?.count || 1;
  const faq = [
    { q: `How many recalls does the ${name} have?`, a: `NHTSA lists ${recalls.length} safety recall campaign${recalls.length === 1 ? "" : "s"} for the ${name}${urgent ? `, including ${urgent} with a do-not-drive or park-outside warning` : ""}.` },
    { q: `How many complaints have owners filed about the ${name}?`, a: `Owners have filed ${complaints.total} complaints with NHTSA${complaints.byComponent[0] ? `; the most-reported area is ${titleCase(complaints.byComponent[0].component)}` : ""}.` },
    { q: "Do recall repairs cost money?", a: "No. Safety recall repairs are performed free of charge by authorized dealers." },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }).replace(/</g, "\\u003c") }} />
      <div className="stats">
        <div className={`stat${recalls.length ? " hot" : ""}`}><b>{recalls.length}</b><span>Recalls</span></div>
        <div className={`stat${urgent ? " hot" : ""}`}><b>{urgent}</b><span>Do-not-drive / park-outside</span></div>
        <div className="stat"><b>{complaints.total.toLocaleString()}</b><span>Owner complaints</span></div>
        <div className="stat"><b>{complaints.crashes}</b><span>Complaints w/ crash</span></div>
        <div className="stat"><b>{complaints.fires}</b><span>Complaints w/ fire</span></div>
      </div>

      <h2>Safety recalls</h2>
      {recalls.length === 0
        ? <div className="card ok">No NHTSA recalls found for the {name}.</div>
        : recalls.map((r) => <RecallCard key={r.NHTSACampaignNumber} r={r} />)}

      <AdSlot />

      {complaints.total > 0 && <>
        <h2>What owners complain about</h2>
        <div className="card">
          <ul className="bars">
            {complaints.byComponent.map((c) => (
              <li key={c.component}><div>{titleCase(c.component)}<div className="bar" style={{ width: `${(c.count / maxC) * 100}%` }} /></div><b>{c.count}</b></li>
            ))}
          </ul>
          <p className="muted small">{complaints.injuries} injuries and {complaints.deaths} deaths were reported across all complaints. Complaints are unverified owner reports.</p>
        </div>
        <h2>Latest owner complaints</h2>
        {complaints.recent.map((c) => (
          <article className="card" key={c.odiNumber}>
            <div className="tags"><span className="tag">{titleCase(c.components.split(/,(?! )/)[0])}</span>{c.crash && <span className="tag red">Crash</span>}{c.fire && <span className="tag red">Fire</span>}</div>
            <p className="small">{c.summary.length > 600 ? c.summary.slice(0, 600) + "…" : c.summary}</p>
            <p className="muted small">Filed {c.dateComplaintFiled} · NHTSA #{c.odiNumber}</p>
          </article>
        ))}
      </>}

      {ratings.length > 0 && <>
        <h2>Crash-test ratings (NHTSA 5-Star)</h2>
        <div className="card tablewrap">
          <table>
            <thead><tr><th>Version</th><th>Overall</th><th>Frontal</th><th>Side</th><th>Rollover</th></tr></thead>
            <tbody>{ratings.map((r) => (
              <tr key={r.VehicleDescription}><td>{r.VehicleDescription}</td><td className="stars">{stars(r.OverallRating)}</td>
                <td>{r.OverallFrontCrashRating}</td><td>{r.OverallSideCrashRating}</td><td>{r.RolloverRating}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </>}

      <h2>FAQ</h2>
      {faq.map((f) => <div className="card" key={f.q}><b>{f.q}</b><p className="small" style={{ margin: "6px 0 0" }}>{f.a}</p></div>)}
    </>
  );
}
