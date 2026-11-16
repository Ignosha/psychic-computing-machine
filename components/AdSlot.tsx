import { ADSENSE_CLIENT } from "@/lib/site";
import AdPush from "./AdPush";

// Renders nothing until an AdSense publisher ID is configured.
export default function AdSlot({ slot }: { slot?: string }) {
  if (!ADSENSE_CLIENT) return null;
  return (
    <div className="ad">
      <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot || process.env.NEXT_PUBLIC_ADSENSE_SLOT || ""} data-ad-format="auto" data-full-width-responsive="true" />
      <AdPush />
    </div>
  );
}
