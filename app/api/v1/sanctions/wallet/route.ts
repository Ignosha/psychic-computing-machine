import { envelope, error, handler, json, options , SANCTIONS_SOURCE } from "@/lib/api";
import { DISCLAIMER } from "@/lib/sanctions/api";
import { screenWallet, validAddress } from "@/lib/sanctions/wallets";

export const OPTIONS = options;
const run = (raw: unknown) => {
  const a = validAddress(raw);
  return a ? json({ ...envelope(screenWallet(a), SANCTIONS_SOURCE), disclaimer: DISCLAIMER })
    : error(400, "invalid_address", "address is required: a crypto wallet address (20-120 letters and digits).");
};
export const GET = handler<unknown>(async (req) => run(new URL(req.url).searchParams.get("address")));
export const POST = handler<unknown>(async (req) => {
  try { return run((await req.json())?.address); } catch { return error(400, "invalid_json", 'Send JSON: {"address": "0x..."}'); }
});
