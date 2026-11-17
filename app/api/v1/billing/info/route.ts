import { json, options } from "@/lib/api";
import { billingEnabled } from "@/lib/billing/accounts";
import { CHAINS, claimMessage, CREDIT_PRICE_MICROS, RECEIVER } from "@/lib/billing/crypto";

export const OPTIONS = options;
const usd = (micros: bigint) => Number(micros) / 1e6;

// Public: how to buy prepaid API credits with USDC.
export function GET() {
  return json({
    enabled: billingEnabled(),
    currency: "USDC",
    receivingAddress: RECEIVER || null,
    chains: Object.entries(CHAINS).map(([name, c]) => ({ name, chainId: c.chain.id, usdcContract: c.usdc, confirmationsRequired: c.confirmations })),
    pricePerCreditUsdc: usd(CREDIT_PRICE_MICROS),
    creditCosts: {
      "sanctions screen / wallet check / entity / vehicle report": 1,
      "batch requests": "1 per item",
      "adding monitored names": "1 per name (daily re-screening and alerts included)",
      "lists, balance, monitor/alert/webhook management": 0,
    },
    steps: [
      "1. From a wallet you control (MetaMask, Rabby, Coinbase Wallet, a Safe...), send USDC to receivingAddress on one of the listed chains. Base has the lowest fees.",
      "2. Sign this exact message with the same wallet: " + JSON.stringify(claimMessage("base", "<txHash>", null)) + " (use your chain and transaction hash; for a top-up, replace 'new' with your account id from /billing/balance).",
      "3. POST /api/v1/billing/claim with {chain, txHash, signature}. New buyers receive an API key (shown once); to top up, send your key in the X-API-Key header.",
      "4. Call any endpoint with header X-API-Key. Responses include X-Credits-Remaining. Failed calls (4xx/5xx) are refunded.",
    ],
    notes: [
      "Pay from a wallet you can sign messages with. Withdrawals sent directly from an exchange can't be claimed because the exchange controls the sending wallet.",
      "Payments from wallets on the OFAC sanctions list are not credited.",
      "Each transaction can be claimed once. Credits don't expire.",
    ],
  }, 200, { "Cache-Control": "public, max-age=300" });
}
