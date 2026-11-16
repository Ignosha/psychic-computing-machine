// Pricing tiers. Keep these in sync with the plans you create on RapidAPI.
// RapidAPI sends the caller's plan in the X-RapidAPI-Subscription header (BASIC, PRO, ULTRA, MEGA).
export const PLAN_ORDER = ["BASIC", "PRO", "ULTRA", "MEGA"] as const;
export type Plan = (typeof PLAN_ORDER)[number];

export const PLANS: { id: Plan; name: string; price: string; quota: string; features: string[] }[] = [
  { id: "BASIC", name: "Starter", price: "Free", quota: "100 requests / month",
    features: ["VIN & vehicle safety reports", "Safety score + grade", "Remedy classification", "Recall campaign lookup"] },
  { id: "PRO", name: "Pro", price: "$79 / month", quota: "15,000 requests / month",
    features: ["Everything in Starter", "Defect signals: unrecalled complaint clusters with trends", "Model-year history with best & worst years"] },
  { id: "ULTRA", name: "Business", price: "$249 / month", quota: "100,000 requests / month",
    features: ["Everything in Pro", "Fleet & inventory batch screening (50 VINs per call)", "Higher rate limits"] },
  { id: "MEGA", name: "Enterprise", price: "$799 / month", quota: "1,000,000 requests / month",
    features: ["Everything in Business", "Highest rate limits", "Priority email support"] },
];

export const planRank = (p: string | null | undefined) => {
  const i = PLAN_ORDER.indexOf((p || "").toUpperCase() as Plan);
  return i < 0 ? 0 : i;
};
export const planName = (p: Plan) => PLANS.find((x) => x.id === p)!.name;
