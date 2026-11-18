// USDC payments verified directly on-chain through free public RPC nodes; no payment processor.
import { SITE_NAME } from "../site";
import { createPublicClient, http, isAddress, isHex, type Hex, type PublicClient } from "viem";
import { base, mainnet } from "viem/chains";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)

export const CHAINS = {
  base: { chain: base, rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org", usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", confirmations: 10, explorer: "https://basescan.org/tx/" },
  ethereum: { chain: mainnet, rpc: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com", usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", confirmations: 12, explorer: "https://etherscan.io/tx/" },
} as const;
export type ChainName = keyof typeof CHAINS;
export const isChain = (c: unknown): c is ChainName => typeof c === "string" && c in CHAINS;

const rawReceiver = (process.env.CRYPTO_RECEIVING_ADDRESS || "").trim();
export const RECEIVER = isAddress(rawReceiver) ? rawReceiver.toLowerCase() : "";
export const CREDIT_PRICE_MICROS = BigInt(Math.round(Number(process.env.CREDIT_PRICE_USDC || "0.03") * 1e6)); // USDC has 6 decimals
export const MIN_PAYMENT_MICROS = BigInt(Math.round(Number(process.env.MIN_PAYMENT_USDC || "10") * 1e6));

export const claimMessage = (chain: ChainName, tx: string, account: string | null) =>
  `${SITE_NAME} API credit claim\nChain: ${chain}\nTransaction: ${tx.toLowerCase()}\nAccount: ${account ?? "new"}`;

const clients = new Map<ChainName, PublicClient>();
const client = (c: ChainName) => {
  if (!clients.has(c)) clients.set(c, createPublicClient({ chain: CHAINS[c].chain, transport: http(CHAINS[c].rpc, { timeout: 15_000, retryCount: 2 }) }) as unknown as PublicClient);
  return clients.get(c)!;
};

export type Verified = { from: string; amountMicros: bigint; confirmations: number; blockNumber: bigint };
export class PaymentError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

// Confirms the transaction succeeded and transferred USDC to RECEIVER, with enough confirmations.
export async function verifyPayment(chain: ChainName, txHash: string): Promise<Verified> {
  if (!isHex(txHash) || txHash.length !== 66) throw new PaymentError("invalid_tx", "txHash must be a 0x-prefixed 32-byte transaction hash.");
  const c = client(chain);
  const cfg = CHAINS[chain];
  let receipt;
  try {
    receipt = await c.getTransactionReceipt({ hash: txHash as Hex });
  } catch (e) {
    if ((e as Error).name === "TransactionReceiptNotFoundError")
      throw new PaymentError("tx_not_found", `Transaction not found on ${chain} (it may still be pending). Retry in a minute.`, 404);
    throw new PaymentError("rpc_unavailable", "The blockchain node is temporarily unavailable. Please retry.", 503);
  }
  if (receipt.status !== "success") throw new PaymentError("tx_failed", "That transaction failed on-chain.");
  const transfers = receipt.logs.filter((l) =>
    l.address.toLowerCase() === cfg.usdc && l.topics[0] === TRANSFER_TOPIC && l.topics.length === 3 &&
    `0x${l.topics[2]!.slice(-40)}`.toLowerCase() === RECEIVER);
  if (!transfers.length) throw new PaymentError("no_usdc_transfer", `That transaction has no USDC transfer to ${RECEIVER} on ${chain}.`);
  const froms = new Set(transfers.map((l) => `0x${l.topics[1]!.slice(-40)}`.toLowerCase()));
  if (froms.size !== 1) throw new PaymentError("multiple_senders", "That transaction has USDC transfers from more than one sender; pay in a single direct transfer.");
  const amountMicros = transfers.reduce((s, l) => s + BigInt(l.data), 0n);
  const latest = await c.getBlockNumber();
  const confirmations = Number(latest - receipt.blockNumber) + 1;
  if (confirmations < cfg.confirmations)
    throw new PaymentError("not_confirmed", `Waiting for confirmations (${confirmations}/${cfg.confirmations}). Retry shortly.`, 409);
  return { from: [...froms][0], amountMicros, confirmations, blockNumber: receipt.blockNumber };
}

// Proves the claimer controls the paying wallet. Works for normal wallets and smart-contract wallets (EIP-1271).
export async function verifyClaimSignature(chain: ChainName, from: string, message: string, signature: string): Promise<boolean> {
  if (!isHex(signature)) return false;
  try {
    return await client(chain).verifyMessage({ address: from as Hex, message, signature: signature as Hex });
  } catch {
    return false;
  }
}

export const creditsFor = (amountMicros: bigint) => amountMicros / CREDIT_PRICE_MICROS;
