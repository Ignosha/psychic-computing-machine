"""Run: RAPIDAPI_KEY=your-key python3 examples.py [example]
Examples: screen, wallet, preflight, token, escrows, trustlines, all (default)"""
import sys

from noshguard import NoshGuard, NoshGuardError

ng = NoshGuard()
RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"


def screen():  # Onboarding: screen a customer before opening an account.
    r = ng.screen_name("Vladimir Putin", country="Russia")
    print(f"decision: {r['decision']} ({r['matchCount']} match{'' if r['matchCount'] == 1 else 'es'})")
    for m in r["matches"]:
        print(f"  {m['score']:.2f}  {m['name']}  [{m['source']}] {', '.join(m['programs'])}")
    print(f"  keep for your audit trail: screeningId={r['screeningId']} listsVersion={r['listsVersion']}")


def wallet():  # Crypto withdrawals: block sanctioned destination wallets.
    r = ng.screen_wallet("0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB")
    print(f"sanctioned: {r['sanctioned']}", "; ".join(m["name"] for m in r["matches"]))


def preflight():  # Wallets: check a payment before the user signs it.
    r = ng.preflight(to="rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv", amount="25")
    print(f"verdict: {r['verdict']} at ledger {r['validatedLedgerIndex']}")
    for c in r["checks"]:
        if c["status"] != "pass":
            print(f"  {c['status']}: {c['message']}")


def token():  # Listing desks and traders: grade a token before touching it.
    r = ng.token_report("RLUSD", RLUSD_ISSUER)
    print(f"{r['token']['currency']}: grade {r['grade']} ({r['score']}/100)")
    for f in r["factors"]:
        print(f"  {f['points']:+d}  {f['detail']}")


def escrows():  # Treasury and research: when does supply unlock?
    s = ng.escrow_calendar("r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp")["summary"]
    print(f"{s['escrows']} escrows, {s['totalXrpLocked']:,} XRP locked")
    if s.get("nextRelease"):
        print(f"  next: {s['nextRelease']['amount']['value']:,} XRP on {s['nextRelease']['date'][:10]}")


def trustlines():  # Wallet apps: show users how much XRP reserve they can recover.
    s = ng.trustline_audit("rKyvBTU7UqAoHbQe3jgZee2W1SxgrK6b7m")["summary"]
    print(f"{s['removableEmptyLines']} empty trust lines, {s['reserveRecoverableXrp']} XRP recoverable")


EXAMPLES = {f.__name__: f for f in (screen, wallet, preflight, token, escrows, trustlines)}

if __name__ == "__main__":
    pick = sys.argv[1] if len(sys.argv) > 1 else "all"
    for name, fn in EXAMPLES.items():
        if pick in ("all", name):
            print(f"\n== {name}")
            try:
                fn()
            except NoshGuardError as e:
                print(f"  error {e}")
