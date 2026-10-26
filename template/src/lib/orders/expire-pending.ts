import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_ORDER_EXPIRY_MINUTES = 30;

function pendingOrderCutoffIso(minutes = PENDING_ORDER_EXPIRY_MINUTES): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

type ExpirePendingOrdersOptions = {
  userId?: string;
  orderId?: string;
};

/** Marks pending orders older than PENDING_ORDER_EXPIRY_MINUTES as "failed". */
export async function expirePendingOrders(
  supabase: SupabaseClient,
  options: ExpirePendingOrdersOptions = {}
): Promise<{ expiredCount: number; expiredIds: string[] }> {
  const cutoff = pendingOrderCutoffIso();

  let query = supabase
    .from("orders")
    .update({ status: "failed" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    // Binance Pay et Mobile Money direct sont manuels : la commande attend la validation de l'administrateur (le client
    // ou un proche peut payer plus tard), elle n'expire pas toute seule.
    .neq("payment_method", "Binance Pay (manuel)")
    .neq("payment_method", "Mobile Money direct (manuel)")
    .select("id");

  if (options.userId) query = query.eq("user_id", options.userId);
  if (options.orderId) query = query.eq("id", options.orderId);

  const { data, error } = await query;
  if (error) {
    console.error("[orders] Failed to expire pending orders:", error);
    throw error;
  }

  const expiredIds = (data || []).map((row: { id: string }) => row.id);
  return { expiredCount: expiredIds.length, expiredIds };
}
