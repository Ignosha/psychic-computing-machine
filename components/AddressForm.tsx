export default function AddressForm({ label, value }: { label: string; value: string }) {
  return (
    <form className="panel vinform" method="get">
      <div className="io-head" style={{ flexBasis: "100%" }}><span>Input / {label}</span><span>Read only</span></div>
      <label htmlFor="address" className="sr">XRPL address</label>
      <input id="address" name="address" defaultValue={value} placeholder="r... XRP Ledger address" required pattern="r[1-9A-HJ-NP-Za-km-z]{24,34}" autoComplete="off" spellCheck={false} />
      <button type="submit">Run check</button>
    </form>
  );
}
