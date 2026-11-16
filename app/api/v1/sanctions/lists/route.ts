import { envelope, handler, json, options } from "@/lib/api";
import { listsInfo } from "@/lib/sanctions/api";

export const OPTIONS = options;
export const GET = handler<unknown>(async () => json(envelope(listsInfo())));
