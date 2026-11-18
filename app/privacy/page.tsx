import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: `What ${SITE_NAME} collects, why, and how long it keeps it.`,
  alternates: { canonical: "/privacy" },
};

const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <>the support channel on the API marketplace listing you subscribed through</>;

export default function Privacy() {
  return (
    <article className="legal">
      <p className="eyebrow">Legal · last updated {LEGAL_UPDATED}</p>
      <h1>Privacy <em>Notice</em></h1>
      <p className="lead">{SITE_NAME} collects as little as it can. No advertising trackers, no selling of data, no wallet connections.</p>

      <h2>What we process</h2>
      <ul>
        <li><b>What you submit to check:</b> addresses, transaction hashes, token codes and names. Free-tool and one-off API checks are processed to produce the answer and are not stored in a database.</li>
        <li><b>Monitoring, if you use it:</b> the names, optional dates of birth, countries and your own reference IDs you add for daily re-screening, the resulting alerts, and your webhook URL. Kept until you delete the monitor or close your account.</li>
        <li><b>API keys and credits:</b> a one-way hash of each key (never the key itself), your credit balance and usage counts, and the public blockchain transactions you paid with.</li>
        <li><b>Marketplace subscribers:</b> the marketplace passes us an anonymous user ID and plan name. Your name, email and billing details stay with the marketplace.</li>
        <li><b>Operational logs:</b> our host (Vercel) keeps standard request logs, including IP addresses, for a short period for security and debugging.</li>
      </ul>

      <h2>Why</h2>
      <p>Only to run the Service: answer requests, run the monitoring you asked for, count usage and credits, stop abuse, and meet legal duties. If you add other people&apos;s details to monitoring, you are responsible for having a lawful basis to screen them.</p>

      <h2>Who else handles it</h2>
      <p>Vercel (hosting), Supabase (database, for monitoring and credits), and the API marketplace you subscribed through. Checks query public XRP Ledger nodes and issuers&apos; websites with the address or token being checked; this site and the blockchain are public by nature. We do not sell or share personal data for advertising.</p>

      <h2>Your choices</h2>
      <p>You can delete monitors yourself through the API at any time. To get a copy of, correct or delete the data tied to your key or account, contact {contact}. Data on public blockchains cannot be changed or deleted by anyone.</p>

      <p className="small muted">See also the <Link href="/terms">Terms of Service</Link>.</p>
    </article>
  );
}
