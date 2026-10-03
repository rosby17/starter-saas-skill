import type { SupabaseClient } from "@supabase/supabase-js";

/** Sums every credit ledger row for a user into a single balance. */
export async function getCreditsBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin.from("credits").select("amount").eq("user_id", userId);
  if (error) throw error;
  return (data || []).reduce((sum: number, row: { amount: number }) => sum + (row.amount || 0), 0);
}

/**
 * Débite `amount` crédits AVANT le travail payant (IA, SMS…). Atomique : contrôle du solde et débit dans la même
 * transaction, sous un verrou par client (migration 0009) ; deux demandes simultanées ne dépensent jamais deux fois.
 * Lève une erreur si le solde est insuffisant.
 */
export async function debitCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const { data: debited, error } = await admin.rpc("debit_credits", { p_user_id: userId, p_amount: amount, p_reason: reason });
  if (error) throw error;
  if (!debited) throw new Error("Insufficient credits");
}
