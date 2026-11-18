import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED, PARENT_BRAND, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${SITE_NAME}'s free tools and API.`,
  alternates: { canonical: "/terms" },
};

const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <>the support channel on the API marketplace listing you subscribed through</>;

export default function Terms() {
  return (
    <article className="legal">
      <p className="eyebrow">Legal · last updated {LEGAL_UPDATED}</p>
      <h1>Terms of <em>Service</em></h1>
      <p className="lead">Plain-language terms for the {SITE_NAME} website, free tools and API (the &quot;Service&quot;) at {SITE_URL}. By using the Service you agree to them. If you use it for a company, you agree for that company.</p>

      <h2>1. What the Service is, and what it is not</h2>
      <p>{SITE_NAME} reports facts read from public sources: the validated XRP Ledger, official government sanctions lists (OFAC, UN, EU, UK FCDO), issuers&apos; own xrp-ledger.toml files, and {PARENT_BRAND.name} authority certificates. It turns them into findings, grades and verdicts using the methodology it publishes.</p>
      <p><b>It is information, not advice.</b> Nothing from the Service is legal, compliance, tax, financial or investment advice, and no result is a recommendation to send, accept, buy, sell or hold anything. Grades and verdicts are automated opinions computed from data that can be incomplete, delayed or wrong.</p>
      <p><b>It does not make your compliance decisions.</b> A &quot;clear&quot; result does not mean a person, wallet or token is safe or lawful to deal with, and a match does not prove that it is not. You remain solely responsible for your own sanctions, AML and KYC obligations, your own review of results, and every decision you make. Use the Service as one input among others, not as your compliance program.</p>
      <p><b>It is read only.</b> The Service never asks for private keys or seed phrases, never signs or submits transactions, and never holds your funds. Anyone asking you for keys on our behalf is a scammer.</p>

      <h2>2. Accounts, keys and acceptable use</h2>
      <ul>
        <li>Keep your API keys secret. You are responsible for all use of your keys until you tell us one has leaked.</li>
        <li>Do not use the Service to break any law, including sanctions law; to harass, stalk or dox anyone; to make decisions about a person&apos;s eligibility for credit, employment, insurance or housing; or to defame anyone by publishing a result as proof of wrongdoing.</li>
        <li>Do not resell raw access to the API as your own API, scrape the free tools at scale, try to get around quotas or credit charges, probe or overload the Service, or point webhooks at systems you do not control.</li>
        <li>You may not use the Service if you are on a sanctions list, are owned or controlled by someone who is, or are located in a country or region under comprehensive U.S., UN, EU or UK sanctions.</li>
      </ul>
      <p>We may rate limit, suspend or end access that breaks these rules or puts the Service or others at risk.</p>

      <h2>3. Plans, payments and credits</h2>
      <ul>
        <li><b>Marketplace subscriptions</b> (for example on RapidAPI) are billed, renewed, cancelled and refunded by that marketplace under its own terms. Quotas reset as the marketplace shows.</li>
        <li><b>Prepaid credits</b> are bought with XRP or RLUSD on the XRP Ledger, or USDC on Base or Ethereum, at the rate shown on <Link href="/api-docs">API &amp; pricing</Link> when the payment is validated. Only the amount the ledger reports as actually delivered counts. Credits are not money, cannot be withdrawn or transferred, and are non-refundable except where the law requires otherwise or a charge was our error.</li>
        <li>A call that fails because of a fault on our side or an upstream outage is not charged, or its credits are returned automatically.</li>
        <li>Blockchain payments are final. Payments sent to the wrong address, without the required destination tag, in the wrong asset or from a sanctioned source may be lost or may not be credited. Double-check before you send.</li>
        <li>Prices may change. A change does not affect credits you already hold or the current period of a subscription you already paid for.</li>
        <li>You are responsible for your own taxes on what you buy.</li>
      </ul>

      <h2>4. Data sources and accuracy</h2>
      <p>Sanctions lists are fetched from official publishers about every 6 hours, so a new listing can take time to appear. Ledger facts come from public XRP Ledger nodes at the ledger index each response states, and can change one ledger later. Issuer identity depends on websites we do not control. Third-party data remains subject to its publishers&apos; own terms. We do not promise the Service will be uninterrupted, error free, complete or current.</p>

      <h2>5. No warranty</h2>
      <p>THE SERVICE AND ALL RESULTS ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY AND NON-INFRINGEMENT, TO THE FULLEST EXTENT THE LAW ALLOWS.</p>

      <h2>6. Limit of liability</h2>
      <p>TO THE FULLEST EXTENT THE LAW ALLOWS: (a) WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST OR STOLEN CRYPTO ASSETS, FAILED OR MISTAKEN PAYMENTS, REGULATORY FINES OR PENALTIES, OR LOST DATA, EVEN IF WE WERE TOLD THEY WERE POSSIBLE; AND (b) OUR TOTAL LIABILITY FOR ALL CLAIMS ABOUT THE SERVICE IS LIMITED TO THE GREATER OF THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 3 MONTHS BEFORE THE CLAIM, OR US$50. Some places do not allow some of these limits, so they apply to you only as far as your law allows.</p>

      <h2>7. Your responsibility to us</h2>
      <p>If someone makes a claim against us because of how you used the Service or its results, or because you broke these terms or the law, you will cover our reasonable losses and costs from that claim.</p>

      <h2>8. Intellectual property and attribution</h2>
      <p>You may use results inside your own products and records. The Service&apos;s software, design, scoring methods and the {SITE_NAME} and {PARENT_BRAND.name} names stay ours. Government sanctions data is public and is credited to its publishers.</p>

      <h2>9. Changes and ending</h2>
      <p>We may change the Service or these terms. If a change to the terms is significant we will update the date above and, where we can, give notice on the site or marketplace listing; continuing to use the Service after that means you accept the change. You can stop using the Service at any time. We may stop offering it; if we do, we will give reasonable notice where possible and refund unused prepaid credits bought in the previous 12 months.</p>

      <h2>10. General</h2>
      <p>If part of these terms cannot be enforced, the rest still applies. Not enforcing a term is not a waiver of it. These terms, the <Link href="/privacy">Privacy Notice</Link> and any marketplace terms you accepted are the whole agreement about the Service. Before starting any formal dispute, contact us and give us 30 days to try to resolve it.</p>

      <h2>Contact</h2>
      <p>Questions, leaked keys or problems: {contact}.</p>
    </article>
  );
}
