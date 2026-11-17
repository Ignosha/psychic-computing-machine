import { envelope, handler, json, options , SANCTIONS_SOURCE } from "@/lib/api";
import { listsInfo } from "@/lib/sanctions/api";

export const OPTIONS = options;
export const GET = handler<unknown>(async () => json(envelope(listsInfo(), SANCTIONS_SOURCE)), { cost: 0 });
