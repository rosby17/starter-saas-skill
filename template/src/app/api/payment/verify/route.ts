import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/auth/service-client";
import { expirePendingOrders } from "@/lib/orders/expire-pending";
import { creditPaidOrder } from "@/lib/orders/credit-order";
import { markFailed, settlePaid } from "@/lib/payments/settle";
import { gatewayForPaymentMethod } from "@/lib/payments/gateways";
import { readOrderCookie } from "@/lib/orders/order-cookie";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Interrogée par la page /paiement/succes en attendant la confirmation du paiement.
 * Accès : le propriétaire connecté de la commande, OU le navigateur qui l'a lancée (cookie signé, achat sans compte).
 * Le webhook de la passerelle fait foi ; ici on relit aussi la passerelle quand elle le permet (webhook en retard ou perdu).
 */
export async function GET(request: Request) {
  try {
    if (!checkRateLimit(`verify:${clientIp(request)}`, 60, 60_000).success) {
      return NextResponse.json({ success: false, message: "Trop de requêtes." }, { status: 429 });
    }
    const cartId = new URL(request.url).searchParams.get("cartId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(cartId)) {
      return NextResponse.json({ success: false, message: "Commande inconnue." }, { status: 400 });
    }

    const { data: { user } } = await (await createClient()).auth.getUser();
    const cookieOrderId = await readOrderCookie();
    const supabase = serviceClient();
    const { data: orderData } = await supabase.from("orders").select("*").eq("id", cartId).maybeSingle();

    // Même réponse pour « n'existe pas » et « pas à toi ».
    const ownsBySession = !!user && orderData?.user_id === user.id;
    const ownsByCookie = cookieOrderId === cartId;
    if (!orderData || (!ownsBySession && !ownsByCookie)) {
      return NextResponse.json({ success: false, message: "Commande introuvable." }, { status: 404 });
    }

    const done = (s: string) => s === "success" || s === "completed";

    // Passerelle qui sait répondre à « est-ce payé ? » : on l'interroge pour toute commande pas encore livrée.
    if (!done(orderData.status) && !orderData.status.startsWith("flagged")) {
      const gateway = gatewayForPaymentMethod(orderData.payment_method);
      if (gateway?.checkStatus) {
        const state = await gateway.checkStatus({ id: orderData.id, payment_ref: orderData.payment_ref });
        if (state === "paid") {
          await creditPaidOrder(supabase, orderData);
          orderData.status = "success";
        }
      }
    }

    // Warappay : relecture du paiement au retour du client.
    if (orderData.payment_method === "Warappay" && !done(orderData.status) && !orderData.status.startsWith("flagged") && process.env.WARAPPAY_API_KEY) {
      const response = await fetch(`https://api.warappay.com/api/v1/checkout/${orderData.payment_ref || cartId}`, {
        headers: { Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "completed") orderData.status = await settlePaid(supabase, orderData, Number(data.amount), "fcfa", "Warappay");
        else if (data.status === "failed") { await markFailed(supabase, cartId); orderData.status = "failed"; }
      }
    }

    // Binance (manuel) : jamais expirée automatiquement, elle attend la validation de l'administrateur.
    if (orderData.status === "pending" && orderData.payment_method !== "Binance Pay (manuel)") {
      const { expiredIds } = await expirePendingOrders(supabase, { orderId: cartId, userId: orderData.user_id });
      if (expiredIds.includes(cartId)) orderData.status = "failed";
    }

    const completed = done(orderData.status);
    return NextResponse.json({
      success: true,
      cart: { id: cartId, status: completed ? "completed" : orderData.status.startsWith("flagged") ? "review" : orderData.status === "failed" ? "failed" : "waiting_payment" },
      order: {
        amount: orderData.amount_local || 0,
        currency: orderData.currency || "XOF",
        plan_name: orderData.plan_name || "Ton achat",
        email: orderData.customer_email,
        manual: orderData.payment_method === "Binance Pay (manuel)",
      },
      signedIn: ownsBySession,
      // Compte créé par CET achat, dans CE navigateur : on peut l'ouvrir directement (voir /api/payment/enter).
      canEnter: completed && !ownsBySession && ownsByCookie && !!orderData.new_account,
    });
  } catch (error) {
    console.error("Erreur verify :", error);
    return NextResponse.json({ success: false, message: "Le service est momentanément indisponible. Réessaie dans un instant." }, { status: 500 });
  }
}
