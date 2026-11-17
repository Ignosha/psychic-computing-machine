import Link from "next/link";
export default function NotFound() {
  return (<><h1>Not found</h1><p className="muted">That page doesn&apos;t exist.</p><p><Link href="/">Back to NoshGuard →</Link></p></>);
}
