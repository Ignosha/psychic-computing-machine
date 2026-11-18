// NoshGuard API client: zero dependencies, Node 18+ (built-in fetch).
// Get a free key: subscribe to the Basic plan on any NoshGuard listing on RapidAPI.
//   export RAPIDAPI_KEY=your-key
const LISTINGS = {
  sanctions: "noshguard-sanctions-crypto-wallet-screening",
  payments: "noshguard-xrpl-payment-safety",
  tokens: "noshguard-xrpl-token-risk",
  security: "noshguard-xrpl-account-security",
};

export class NoshGuard {
  constructor({ key = process.env.RAPIDAPI_KEY, baseUrl = process.env.NOSHGUARD_BASE_URL } = {}) {
    if (!key && !baseUrl) throw new Error("Set RAPIDAPI_KEY (free on RapidAPI).");
    this.key = key;
    this.baseUrl = baseUrl; // optional override, e.g. for testing
  }

  async #call(listing, method, path, { query, body } = {}) {
    const host = `${LISTINGS[listing]}.p.rapidapi.com`;
    const url = new URL((this.baseUrl ?? `https://${host}`) + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const res = await fetch(url, {
      method,
      headers: { "X-RapidAPI-Key": this.key ?? "", "X-RapidAPI-Host": host, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error?.message ?? `HTTP ${res.status}`), { status: res.status, code: json.error?.code });
    return json.data;
  }

  // Sanctions & Crypto Wallet Screening
  screenName(name, opts = {}) { return this.#call("sanctions", "GET", "/sanctions/screen", { query: { name, ...opts } }); }
  screenNames(queries) { return this.#call("sanctions", "POST", "/sanctions/batch", { body: { queries } }); }
  screenWallet(address) { return this.#call("sanctions", "GET", "/sanctions/wallet", { query: { address } }); }
  screenWallets(addresses) { return this.#call("sanctions", "POST", "/sanctions/wallets/batch", { body: { addresses } }); }
  record(id) { return this.#call("sanctions", "GET", `/sanctions/entities/${encodeURIComponent(id)}`); }
  lists() { return this.#call("sanctions", "GET", "/sanctions/lists"); }

  // XRPL Payment Safety
  preflight({ to, amount, currency, issuer, destinationTag, from }) { return this.#call("payments", "GET", "/xrpl/preflight", { query: { to, amount, currency, issuer, destinationTag, from } }); }
  verifyPayment(tx, expect = {}) {
    const q = { tx, expectTo: expect.to, expectDestinationTag: expect.destinationTag, expectAmount: expect.amount, expectCurrency: expect.currency, expectIssuer: expect.issuer };
    return this.#call("payments", "GET", "/xrpl/verify", { query: q });
  }
  counterparty(address) { return this.#call("payments", "GET", "/xrpl/check", { query: { address } }); }

  // XRPL Token Risk
  tokenReport(currency, issuer) { return this.#call("tokens", "GET", "/xrpl/token", { query: { currency, issuer } }); }

  // XRPL Account Security
  controlAudit(address) { return this.#call("security", "GET", "/xrpl/control", { query: { address } }); }
  inboxScan(address) { return this.#call("security", "GET", "/xrpl/inbox", { query: { address } }); }
  trustlineAudit(address) { return this.#call("security", "GET", "/xrpl/trustlines", { query: { address } }); }
  escrowCalendar(address) { return this.#call("security", "GET", "/xrpl/escrows", { query: { address } }); }
}
