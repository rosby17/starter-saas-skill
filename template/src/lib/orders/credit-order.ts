import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/brevo";
import { rechargeConfirmationTemplate } from "@/lib/email/templates";

export type OrderRow = {
  id: string;
  user_id: string;
  plan_name: string | null;
  credits: number;
  amount_local: number | null;
  currency: string | null;
};

/**
 * Call this when the credits insert fails AFTER the order was atomically
 * marked "success". This is a rare but serious case: the customer paid, the
 * order will never be retried again (every entry point now skips it because
 * it's "success"), but no credits were added. We don't try to auto-repair —
 * a botched repair could double-credit — we just make the incident loud and
 * traceable for manual follow-up.
 */
export async function flagCreditInsertFailure(
  supabase: SupabaseClient,
  params: { orderId: string; userId: string; credits: number; error: unknown; source: string }
): Promise<void> {
  console.error(
    `[ACTION REQUIRED] Credit insert failed after payment was confirmed — order ${params.orderId} ` +
    `(user ${params.userId}, ${params.credits} credits owed, source: ${params.source}). ` +
    `Order is marked "success" but NO credits were added. Manual review required.`,
    params.error
  );
}

/**
 * Marks the order as paid and credits the user (ledger insert + confirmation
 * email). The status transition is atomic: if the order is already "success"
 * (webhook, admin action, or a concurrent call already claimed it), this is a
 * no-op. Returns true only if THIS call performed the crediting.
 */
export async function creditPaidOrder(
  supabase: SupabaseClient,
  order: OrderRow,
  noteSuffix = "via TaraMoney"
): Promise<boolean> {
  const { data: claimedOrder } = await supabase
    .from("orders")
    .update({ status: "success" })
    .eq("id", order.id)
    .neq("status", "success")
    .select("id")
    .single();

  if (!claimedOrder) return false;

  const { error: creditError } = await supabase.from("credits").insert({
    user_id: order.user_id,
    amount: order.credits,
    source: "purchase",
    order_id: order.id,
  });
  if (creditError) {
    await flagCreditInsertFailure(supabase, {
      orderId: order.id,
      userId: order.user_id,
      credits: order.credits,
      error: creditError,
      source: `creditPaidOrder (${noteSuffix})`,
    });
  }

  try {
    const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
    if (userData?.user?.email) {
      const amountStr = `${order.amount_local || 0} ${order.currency || "XOF"}`;
      await sendEmail({
        to: { email: userData.user.email },
        subject: "Your purchase is confirmed",
        html: rechargeConfirmationTemplate({
          credits: order.credits,
          amount: amountStr,
          planName: order.plan_name || "Credits",
        }),
      });
    }
  } catch (emailErr) {
    console.error("Error sending confirmation email:", emailErr);
  }

  return true;
}
