import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { creditPaidOrder } from "@/lib/orders/credit-order";
import { gatewayForPaymentMethod } from "@/lib/payments/gateways";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 7;

/**
 * Filet de sécurité appelé au retour de l'utilisateur dans l'application : revérifie ses commandes récentes non payées
 * auprès de la passerelle (si elle sait répondre, voir PaymentGateway.checkStatus) et crédite celles qui l'ont été.
 * Sûr par construction : le crédit est atomique (fonction SQL credit_paid_order), jamais de double crédit.
 */
export async function POST() {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: "Non connecté." }, { status: 401 });

    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "failed"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    let creditedCount = 0;
    for (const order of orders || []) {
      const gateway = gatewayForPaymentMethod(order.payment_method);
      if (!gateway?.checkStatus) continue;
      if ((await gateway.checkStatus({ id: order.id, payment_ref: order.payment_ref }).catch(() => 'unknown' as const)) === "paid" && (await creditPaidOrder(supabase, order))) {
        creditedCount += 1;
      }
    }
    return NextResponse.json({ success: true, creditedCount, checked: orders?.length || 0 });
  } catch (error) {
    console.error("reconcile-pending error:", error);
    // Une réconciliation ratée ne doit jamais empêcher l'application de s'ouvrir.
    return NextResponse.json({ success: false, creditedCount: 0 }, { status: 200 });
  }
}
