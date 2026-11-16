import Link from "next/link";
import { fmtDmy, titleCase, type Recall } from "@/lib/nhtsa";
import { classifyRemedy } from "@/lib/insights";

const REMEDY_LABEL: Record<string, string> = { over_the_air: "Over-the-air fix", software: "Software fix", replace: "Part replacement", inspect: "Inspect & repair", repair: "Repair", refund: "Refund / buyback", other: "" };

export default function RecallCard({ r }: { r: Recall }) {
  const rem = classifyRemedy(r);
  return (
    <article className={`card recall${r.parkIt || r.parkOutSide ? " danger" : ""}`}>
      <header>
        <div className="tags">
          {r.parkIt && <span className="tag red">Do not drive</span>}
          {r.parkOutSide && <span className="tag red">Park outside — fire risk</span>}
          {REMEDY_LABEL[rem.type] && <span className="tag blue">{REMEDY_LABEL[rem.type]}</span>}
          {rem.phased && <span className="tag">Phased rollout</span>}
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
