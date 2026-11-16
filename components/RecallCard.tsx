import Link from "next/link";
import { fmtDmy, titleCase, type Recall } from "@/lib/nhtsa";

export default function RecallCard({ r }: { r: Recall }) {
  return (
    <article className={`card recall${r.parkIt || r.parkOutSide ? " danger" : ""}`}>
      <header>
        <div className="tags">
          {r.parkIt && <span className="tag red">Do not drive</span>}
          {r.parkOutSide && <span className="tag red">Park outside — fire risk</span>}
          {r.overTheAirUpdate && <span className="tag blue">Over-the-air fix</span>}
          <span className="tag">{titleCase(r.Component.split(":")[0])}</span>
        </div>
        <span className="muted small">
          <Link href={`/campaign/${r.NHTSACampaignNumber}`}>#{r.NHTSACampaignNumber}</Link> · {fmtDmy(r.ReportReceivedDate)}
        </span>
      </header>
      <p>{r.Summary}</p>
      <dl>
        <dt>Risk</dt><dd>{r.Consequence}</dd>
        <dt>Fix</dt><dd>{r.Remedy}</dd>
      </dl>
    </article>
  );
}
