"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <>
      <h1>Government data is temporarily unavailable</h1>
      <p className="muted">We couldn’t reach NHTSA just now, so we’re not showing results rather than risk showing incomplete recall data.</p>
      <button onClick={reset}>Try again</button>
    </>
  );
}
