import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { expirePendingOrders } from "@/lib/orders/expire-pending";
import { creditPaidOrder } from "@/lib/orders/credit-order";
import { fetchGeniusPayPayment, settleGeniusPayOrder } from "@/lib/payments/geniuspay-settle";
import { markFailed, settlePaid } from "@/lib/payments/settle";
import { gatewayForPaymentMethod } from "@/lib/payments/gateways";

/**
 * Polled by the client-side billing success page while it waits for payment
 * confirmation.
 *
 * - TaraMoney: the webhook is the source of truth for crediting; this route
 *   just reports current order status.
 * - Maketou: has no webhook at all, so this route actively polls Maketou's
 *   cart-status API and credits the order itself when it sees "completed".
 *   (Also backed up by the reverify-maketou-orders cron for users who close
 *   the tab before this ever runs.)
 */
export async function GET(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Your session has expired. Please log in again." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cartId = searchParams.get("cartId");
    if (!cartId) {
      return NextResponse.json({ success: false, message: "cartId is required." }, { status: 400 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: orderData } = await supabase
      .from("orders")
      .select("*")
      .eq("id", cartId)
      .eq("user_id", user.id)
      .single();

    if (!orderData) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    // Passerelle sans webhook (ex. Maketou) : on l'interroge pour toute commande pas encore créditée (pending OU failed :
    // un paiement peut aboutir chez elle après l'expiration locale). Le crédit reste atomique.
    if (orderData.status !== "success" && orderData.status !== "completed") {
      const gateway = gatewayForPaymentMethod(orderData.payment_method);
      if (gateway?.checkStatus) {
        const state = await gateway.checkStatus({ id: orderData.id, payment_ref: orderData.payment_ref });
        if (state === "paid") {
          await creditPaidOrder(supabase, orderData);
          orderData.status = "success"; // crédité par cet appel ou déjà crédité par un autre : dans les deux cas c'est payé
        }
      }
    }

    // Warappay : le webhook fait foi, mais on relit aussi le paiement au retour du client (webhook en retard ou perdu).
    if (orderData.payment_method === "Warappay" && orderData.status !== "success" && orderData.status !== "completed" && process.env.WARAPPAY_API_KEY) {
      const response = await fetch(`https://api.warappay.com/api/v1/checkout/${orderData.payment_ref || cartId}`, {
        headers: { Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "completed") orderData.status = await settlePaid(supabase, orderData, Number(data.amount), "local", "Warappay");
        else if (data.status === "failed") { await markFailed(supabase, cartId); orderData.status = "failed"; }
      }
    }

    // GeniusPay : relecture du paiement par l'API (source de vérité).
    if (orderData.payment_method === "GeniusPay" && orderData.payment_ref && orderData.status !== "success" && orderData.status !== "completed") {
      const payment = await fetchGeniusPayPayment(orderData.payment_ref);
      if (payment) orderData.status = await settleGeniusPayOrder(supabase, orderData, payment);
    }

    if (orderData.status === "pending") {
      const { expiredIds } = await expirePendingOrders(supabase, { orderId: cartId, userId: user.id });
      if (expiredIds.includes(cartId)) orderData.status = "failed";
    }

    const isCompleted = orderData.status === "success" || orderData.status === "completed";

    return NextResponse.json({
      success: true,
      cart: { id: cartId, status: isCompleted ? "completed" : "waiting_payment" },
      order: {
        amount: orderData.amount_local || 0,
        currency: orderData.currency || "XOF",
        plan_name: orderData.plan_name || "Credits",
      },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { success: false, message: "The service is temporarily unavailable. Please try again shortly." },
      { status: 500 }
    );
  }
}
