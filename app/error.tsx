"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <>
      <h1>A data source is temporarily unavailable</h1>
      <p className="muted">We couldn&apos;t reach the XRP Ledger or another source just now, so we&apos;re showing nothing rather than an incomplete answer.</p>
      <button onClick={reset}>Try again</button>
    </>
  );
}
