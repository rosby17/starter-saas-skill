import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { expirePendingOrders } from "@/lib/orders/expire-pending";
import { creditPaidOrder } from "@/lib/orders/credit-order";

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

    // Maketou has no webhook: poll for any order not yet credited (pending OR
    // failed) — a payment can complete on Maketou's side after the order was
    // already expired locally.
    if (orderData.payment_method === "Maketou Checkout" && orderData.status !== "success" && orderData.status !== "completed") {
      const apiKey = process.env.MAKETOU_API_KEY;
      if (apiKey) {
        const response = await fetch(`https://api.maketou.net/api/v1/stores/cart/${cartId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after") || "10";
            return NextResponse.json(
              { success: false, message: "The Maketou payment service is temporarily overloaded. Please try again shortly.", retryAfter },
              { status: 429, headers: { "Retry-After": retryAfter } }
            );
          }
          let errMsg = "Unable to verify the payment with Maketou.";
          try {
            const errData = await response.json();
            if (errData?.message) errMsg = errData.message;
          } catch {}
          return NextResponse.json({ success: false, message: errMsg }, { status: response.status });
        }

        const data = await response.json();
        if (data.cart?.status === "completed") {
          const wasCredited = await creditPaidOrder(supabase, orderData, "via Maketou");
          if (wasCredited) orderData.status = "success";
          else orderData.status = "success"; // already claimed elsewhere (webhook-less race), report as success
        }
      }
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
