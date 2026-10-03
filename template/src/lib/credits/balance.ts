import type { SupabaseClient } from "@supabase/supabase-js";

/** Sums every credit ledger row for a user into a single balance. */
export async function getCreditsBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from("credits").select("amount").eq("user_id", userId);
  return (data || []).reduce((sum: number, row: { amount: number }) => sum + (row.amount || 0), 0);
}

/** Debits `amount` credits from a user by inserting a negative ledger row. Throws if insufficient balance. */
export async function debitCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const balance = await getCreditsBalance(admin, userId);
  if (balance < amount) {
    throw new Error("Insufficient credits");
  }
  const { error } = await admin.from("credits").insert({
    user_id: userId,
    amount: -amount,
    source: reason,
  });
  if (error) throw error;
}
