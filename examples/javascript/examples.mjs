// Run: RAPIDAPI_KEY=your-key node examples.mjs [example]
// Examples: screen, wallet, preflight, token, escrows, trustlines, all (default)
import { NoshGuard } from "./noshguard.mjs";

const ng = new NoshGuard();
const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

const examples = {
  // Onboarding: screen a customer before opening an account.
  async screen() {
    const r = await ng.screenName("Vladimir Putin", { country: "Russia" });
    console.log(`decision: ${r.decision} (${r.matchCount} match${r.matchCount === 1 ? "" : "es"})`);
    for (const m of r.matches) console.log(`  ${m.score.toFixed(2)}  ${m.name}  [${m.source}] ${m.programs.join(", ")}`);
    console.log(`  keep for your audit trail: screeningId=${r.screeningId} listsVersion=${r.listsVersion}`);
  },
  // Crypto withdrawals: block sanctioned destination wallets.
  async wallet() {
    const r = await ng.screenWallet("0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB");
    console.log(`sanctioned: ${r.sanctioned}${r.sanctioned ? ` (${r.matches.map((m) => m.name).join("; ")})` : ""}`);
  },
  // Wallets: check a payment before the user signs it.
  async preflight() {
    const r = await ng.preflight({ to: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv", amount: "25" });
    console.log(`verdict: ${r.verdict} at ledger ${r.validatedLedgerIndex}`);
    for (const c of r.checks.filter((c) => c.status !== "pass")) console.log(`  ${c.status}: ${c.message}`);
  },
  // Listing desks and traders: grade a token before touching it.
  async token() {
    const r = await ng.tokenReport("RLUSD", RLUSD_ISSUER);
    console.log(`${r.token.currency}: grade ${r.grade} (${r.score}/100)`);
    for (const f of r.factors) console.log(`  ${f.points >= 0 ? "+" : ""}${f.points}  ${f.detail}`);
  },
  // Treasury and research: when does supply unlock?
  async escrows() {
    const r = await ng.escrowCalendar("r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp");
    const s = r.summary;
    console.log(`${s.escrows} escrows, ${s.totalXrpLocked.toLocaleString()} XRP locked`);
    if (s.nextRelease) console.log(`  next: ${s.nextRelease.amount.value.toLocaleString()} XRP on ${s.nextRelease.date.slice(0, 10)}`);
  },
  // Wallet apps: show users how much XRP reserve they can recover.
  async trustlines() {
    const r = await ng.trustlineAudit("rKyvBTU7UqAoHbQe3jgZee2W1SxgrK6b7m");
    console.log(`${r.summary.removableEmptyLines} empty trust lines, ${r.summary.reserveRecoverableXrp} XRP recoverable`);
  },
};

const pick = process.argv[2] ?? "all";
for (const [name, fn] of Object.entries(examples)) {
  if (pick !== "all" && pick !== name) continue;
  console.log(`\n== ${name}`);
  try { await fn(); } catch (e) { console.log(`  error ${e.status ?? ""} ${e.code ?? ""}: ${e.message}`); }
}
