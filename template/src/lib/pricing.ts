/**
 * Placeholder pricing plans. Replace every number here before shipping —
 * these exist only to wire the checkout flow end-to-end with obviously-fake
 * values. Amounts are expressed in your app's default local currency
 * (defaults to XOF/FCFA below, since the billing routes were built around
 * TaraMoney which settles in FCFA) and in USD for reference/logging.
 */

export type BillingPlan = {
  id: 'free' | 'pro' | 'business';
  name: string;
  /** Price in the app's local currency (e.g. XOF). */
  amountLocal: number;
  /** Reference USD price, used for currency-aware checkout. */
  amountUsd: number;
  currency: 'XOF' | 'USD' | 'EUR';
  /** Whatever unit your product meters usage in (credits, seats, etc). */
  credits: number;
  /** Durée de validité des crédits achetés, en jours. Absent = ils n'expirent jamais. */
  validityDays?: number;
  features: string[];
};

export const PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    amountLocal: 0,
    amountUsd: 0,
    currency: 'XOF',
    credits: 1000,
    features: ['1,000 credits / month', 'Community support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    amountLocal: 5000, // TODO: replace placeholder price
    amountUsd: 9,
    currency: 'XOF',
    credits: 50000,
    features: ['50,000 credits / month', 'Email support', 'Priority processing'],
  },
  {
    id: 'business',
    name: 'Business',
    amountLocal: 20000, // TODO: replace placeholder price
    amountUsd: 29,
    currency: 'XOF',
    credits: 250000,
    features: ['250,000 credits / month', 'Priority support', 'Team seats'],
  },
];

export function getPlanById(id: string): BillingPlan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getPlanByName(name: string | null | undefined): BillingPlan | undefined {
  if (!name) return undefined;
  return PLANS.find((p) => name.startsWith(p.name));
}
