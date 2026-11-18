// RapidAPI sends the caller's plan in the X-RapidAPI-Subscription header (BASIC, PRO, ULTRA, MEGA).
export const PLAN_ORDER = ["BASIC", "PRO", "ULTRA", "MEGA"] as const;
export type Plan = (typeof PLAN_ORDER)[number];

export const planRank = (p: string | null | undefined) => {
  const i = PLAN_ORDER.indexOf((p || "").toUpperCase() as Plan);
  return i < 0 ? 0 : i;
};

// API plans. RapidAPI plan IDs are BASIC/PRO/ULTRA/MEGA; keep prices here in sync with the marketplace.
export const SANCTIONS_PLANS: { id: Plan; name: string; price: string; quota: string; batch: number; monitors: number; features: string[] }[] = [
  { id: "BASIC", name: "Starter", price: "Free", quota: "200 credits / month", batch: 0, monitors: 10,
    features: ["Every product: sanctions, wallets, Pre-flight, Verify, Counterparty, Token Risk, Control, Inbox, Trust Lines, Escrow", "Monitor 10 names", "No card needed"] },
  { id: "PRO", name: "Growth", price: "$299 / month", quota: "10,000 credits / month", batch: 25, monitors: 1000,
    features: ["Everything in Starter", "Batch calls (25 per call)", "Monitor 1,000 names with webhook alerts"] },
  { id: "ULTRA", name: "Business", price: "$999 / month", quota: "100,000 credits / month", batch: 100, monitors: 25000,
    features: ["Everything in Growth", "Batch calls (100 per call)", "Monitor 25,000 names", "Higher rate limits"] },
  { id: "MEGA", name: "Enterprise", price: "$3,999 / month", quota: "1,000,000 credits / month", batch: 100, monitors: 250000,
    features: ["Everything in Business", "Monitor 250,000 names", "Highest rate limits", "Priority support"] },
];
export const sanctionsBatchLimit = (p: Plan) => SANCTIONS_PLANS.find((x) => x.id === p)!.batch;
export const sanctionsMonitorLimit = (p: Plan) => SANCTIONS_PLANS.find((x) => x.id === p)!.monitors;
export const planName = (p: Plan) => SANCTIONS_PLANS.find((x) => x.id === p)!.name;
