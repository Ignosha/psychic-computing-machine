import Link from "next/link";
import type { Metadata } from "next";
import { listsInfo, parseQuery, runScreen } from "@/lib/sanctions/api";

type P = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Free Sanctions Check: OFAC, UN, EU & UK Lists",
    description: "Search a person or company against the official OFAC SDN, UN, EU and UK sanctions lists. Fuzzy matching handles misspellings, aliases and Cyrillic names.",
    alternates: { canonical: "/sanctions" },
    ...(sp.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SanctionsPage({ searchParams }: P) {
  const sp = await searchParams;
  const info = listsInfo();
  const q = sp.q ? parseQuery({ name: sp.q, dob: sp.dob || undefined, country: sp.country || undefined, limit: 5 }) : null;
  const result = q && typeof q !== "string" ? runScreen(q) : null;
  return (
    <>
      <section className="hero">
        <h1>Free sanctions check</h1>
        <p className="lead">Search {info.totalRecords.toLocaleString()} sanctioned people, companies, vessels and aircraft on the official U.S. OFAC, UN, EU and UK lists. Handles misspellings, aliases, reordered and Cyrillic names.</p>
      </section>
      <form className="panel picker sform" method="get">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Full name or company" aria-label="Name" required minLength={2} maxLength={200} />
        <input name="dob" defaultValue={sp.dob ?? ""} placeholder="Birth year" aria-label="Date of birth" pattern="\d{4}(-\d{2}(-\d{2})?)?" />
        <input name="country" defaultValue={sp.country ?? ""} placeholder="Country" aria-label="Country" />
        <button type="submit">Check</button>
      </form>
      {typeof q === "string" && <div className="card danger">{q}</div>}
      {result && (
        <>
          <div className={`card ${result.decision === "clear" ? "ok" : "danger"}`}>
            <b>{result.decision === "clear" ? "No matches found" : result.decision === "strong_match" ? "Strong match: review required" : "Potential match: review required"}</b>
            <p className="small muted" style={{ margin: "4px 0 0" }}>Screened {new Date(result.screenedAt).toUTCString()} against lists fetched {new Date(result.listsVersion).toUTCString()}.</p>
          </div>
          {result.matches.map((m) => (
            <article className="card" key={m.id}>
              <div className="tags"><span className="tag red">{Math.round(m.score * 100)}% match</span><span className="tag">{m.source.replace("_", " ")}</span><span className="tag">{m.type}</span>
                {m.dobMatch === false && <span className="tag blue">DOB differs</span>}{m.dobMatch && <span className="tag red">DOB matches</span>}</div>
              <p style={{ margin: "8px 0 4px" }}><b>{m.name}</b>{m.matchedName !== m.name && <span className="muted small"> (matched alias “{m.matchedName}”)</span>}</p>
              <p className="small muted" style={{ margin: 0 }}>
                {[m.datesOfBirth.length && `Born ${m.datesOfBirth.join(", ")}`, m.nationalities.length && m.nationalities.join(", "), m.programs.length && `Programs: ${m.programs.join(", ")}`].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
          <p className="small muted">Free search shows up to 5 matches. A match is a potential match for human review, not a determination; this is not legal advice.</p>
        </>
      )}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Screening customers or payments?</h2>
        <p>Automate it: the <Link href="/sanctions/api">Sanctions Screening API</Link> screens one name or 100 per call, with DOB and country filters, alias coverage and an audit ID for every screening.</p>
      </div>
      <h2>Lists covered</h2>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>List</th><th>Publisher</th><th>Records</th><th>Published</th></tr></thead>
          <tbody>{info.sources.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.publisher}</td><td>{s.count.toLocaleString()}</td><td>{s.publishedAt}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
