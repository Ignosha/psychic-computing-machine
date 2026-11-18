"""NoshGuard API client: zero dependencies, Python 3.8+.

Get a free key: subscribe to the Basic plan on any NoshGuard listing on RapidAPI.
    export RAPIDAPI_KEY=your-key
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

LISTINGS = {
    "sanctions": "noshguard-sanctions-crypto-wallet-screening",
    "payments": "noshguard-xrpl-payment-safety",
    "tokens": "noshguard-xrpl-token-risk",
    "security": "noshguard-xrpl-account-security",
}


class NoshGuardError(Exception):
    def __init__(self, status, code, message):
        super().__init__(f"{status} {code}: {message}")
        self.status, self.code = status, code


class NoshGuard:
    def __init__(self, key=None, base_url=None):
        self.key = key or os.environ.get("RAPIDAPI_KEY")
        self.base_url = base_url or os.environ.get("NOSHGUARD_BASE_URL")  # optional override, e.g. for testing
        if not self.key and not self.base_url:
            raise ValueError("Set RAPIDAPI_KEY (free on RapidAPI).")

    def _call(self, listing, method, path, query=None, body=None):
        host = f"{LISTINGS[listing]}.p.rapidapi.com"
        q = {k: v for k, v in (query or {}).items() if v is not None}
        url = (self.base_url or f"https://{host}") + path + ("?" + urllib.parse.urlencode(q) if q else "")
        headers = {"X-RapidAPI-Key": self.key or "", "X-RapidAPI-Host": host}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["data"]
        except urllib.error.HTTPError as e:
            try:
                err = json.load(e).get("error", {})
            except ValueError:
                err = {}
            raise NoshGuardError(e.code, err.get("code"), err.get("message", e.reason)) from None

    # Sanctions & Crypto Wallet Screening
    def screen_name(self, name, **opts): return self._call("sanctions", "GET", "/sanctions/screen", {"name": name, **opts})
    def screen_names(self, queries): return self._call("sanctions", "POST", "/sanctions/batch", body={"queries": queries})
    def screen_wallet(self, address): return self._call("sanctions", "GET", "/sanctions/wallet", {"address": address})
    def screen_wallets(self, addresses): return self._call("sanctions", "POST", "/sanctions/wallets/batch", body={"addresses": addresses})
    def record(self, record_id): return self._call("sanctions", "GET", "/sanctions/entities/" + urllib.parse.quote(record_id))
    def lists(self): return self._call("sanctions", "GET", "/sanctions/lists")

    # XRPL Payment Safety
    def preflight(self, to, amount, currency=None, issuer=None, destination_tag=None, sender=None):
        return self._call("payments", "GET", "/xrpl/preflight", {"to": to, "amount": amount, "currency": currency, "issuer": issuer, "destinationTag": destination_tag, "from": sender})
    def verify_payment(self, tx, to=None, destination_tag=None, amount=None, currency=None, issuer=None):
        return self._call("payments", "GET", "/xrpl/verify", {"tx": tx, "expectTo": to, "expectDestinationTag": destination_tag, "expectAmount": amount, "expectCurrency": currency, "expectIssuer": issuer})
    def counterparty(self, address): return self._call("payments", "GET", "/xrpl/check", {"address": address})

    # XRPL Token Risk
    def token_report(self, currency, issuer): return self._call("tokens", "GET", "/xrpl/token", {"currency": currency, "issuer": issuer})

    # XRPL Account Security
    def control_audit(self, address): return self._call("security", "GET", "/xrpl/control", {"address": address})
    def inbox_scan(self, address): return self._call("security", "GET", "/xrpl/inbox", {"address": address})
    def trustline_audit(self, address): return self._call("security", "GET", "/xrpl/trustlines", {"address": address})
    def escrow_calendar(self, address): return self._call("security", "GET", "/xrpl/escrows", {"address": address})
