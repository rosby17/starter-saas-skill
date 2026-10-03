import { NextResponse } from "next/server";
import { getPlanById } from "@/lib/pricing";

/**
 * Creates a payment link (TaraMoney or Maketou) and records a "pending"
 * order. `provider` in the request body selects which one — defaults to
 * 'taramoney'. Add more providers by branching the same way, before the
 * TaraMoney block (which stays the fallback/default).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, phone, userId, planId, currency, provider } = body;

    if (!email || !firstName || !lastName || !planId) {
      return NextResponse.json(
        { success: false, message: "Name, email and planId are required." },
        { status: 400 }
      );
    }

    const plan = getPlanById(planId);
    if (!plan || plan.amountLocal <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid or free plan — no payment required." },
        { status: 400 }
      );
    }

    let origin = request.headers.get("origin") || "http://127.0.0.1:3000";
    if (origin.includes("localhost")) origin = origin.replace("localhost", "127.0.0.1");
    const cleanOrigin = origin.replace(/\/$/, "");
    const paymentCurrency = (currency || plan.currency || "XOF").toUpperCase();

    // ------------------------------------------
    // MAKETOU
    // ------------------------------------------
    if (provider === "maketou") {
      const apiKey = process.env.MAKETOU_API_KEY;
      const productId = process.env.MAKETOU_PRODUCT_ID;

      if (!apiKey || !productId) {
        return NextResponse.json(
          { success: false, message: "Mobile money payment is temporarily unavailable. Please try again later or choose another payment method." },
          { status: 500 }
        );
      }

      // Maketou has no webhook: crediting relies on the client returning to
      // /billing/success (verify route below), backed up by the
      // reverify-maketou-orders cron for abandoned/backgrounded checkouts.
      const redirectURL = `${cleanOrigin}/billing/success`;

      const payload: any = {
        productDocumentId: productId,
        email,
        firstName,
        lastName,
        redirectURL,
        customerPrice: Math.round(plan.amountLocal),
        meta: {
          source: "saas-starter-kit",
          planId,
          currency: paymentCurrency,
        },
      };
      if (phone && String(phone).trim() !== "") payload.phone = String(phone).trim();

      const response = await fetch("https://api.maketou.net/api/v1/stores/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Maketou error:", data);
        let errMsg = data.message || "Failed to initialize payment.";
        if (Array.isArray(errMsg)) errMsg = errMsg.map((e: any) => JSON.stringify(e)).join(" | ");
        return NextResponse.json({ success: false, message: errMsg }, { status: response.status });
      }

      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        if (userId && data.cart?.id) {
          await supabase.from("orders").insert({
            id: data.cart.id,
            user_id: userId,
            plan_name: plan.name,
            credits: plan.credits,
            amount_local: plan.amountLocal,
            currency: paymentCurrency,
            payment_method: "Maketou Checkout",
            payment_ref: data.cart.id,
            status: "pending",
          });
        }
      } catch (dbErr) {
        console.error("Failed to insert pending order:", dbErr);
      }

      return NextResponse.json({ success: true, cartId: data.cart?.id, redirectUrl: data.redirectUrl });
    }

    // ------------------------------------------
    // TARA MONEY (default)
    // ------------------------------------------
    const apiKey = process.env.TARA_API_KEY;
    const businessId = process.env.TARA_BUSINESS_ID;
    const webhookSecret = process.env.TARA_WEBHOOK_SECRET;

    if (!apiKey || !businessId || !webhookSecret) {
      // Refuse to create a payment link if we can't authenticate the webhook
      // callback — better a visibly broken checkout than a silent security hole.
      console.error("TaraMoney checkout misconfigured: missing TARA_API_KEY, TARA_BUSINESS_ID or TARA_WEBHOOK_SECRET");
      return NextResponse.json(
        { success: false, message: "Payments are temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }

    const orderId = crypto.randomUUID();
    let redirectURL = `${cleanOrigin}/billing/success?cartId=${orderId}`;
    // TaraMoney doesn't sign its webhooks (no documented HMAC), so we embed a
    // shared secret in the callback URL itself, which is never exposed to the
    // client. The webhook handler verifies this before trusting a "SUCCESS".
    let webhookURL = `${cleanOrigin}/api/payment/webhook/taramoney?key=${encodeURIComponent(webhookSecret)}`;
    if (redirectURL.startsWith("http://")) redirectURL = redirectURL.replace("http://", "https://");
    if (webhookURL.startsWith("http://")) webhookURL = webhookURL.replace("http://", "https://");

    const amountLocal = plan.amountLocal;
    const formattedPrice = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amountLocal);

    // TaraMoney always settles in FCFA regardless of the currency shown to
    // the customer. If you support EUR/USD display prices, convert here
    // before sending `productPrice` — see this file's history for a worked
    // example of the FX-conversion pitfall this guards against.
    const productPriceFcfa = Math.round(amountLocal);

    const payload = {
      apiKey,
      businessId,
      productId: orderId,
      productName: `${plan.name} plan — ${formattedPrice} ${paymentCurrency}`,
      productPrice: productPriceFcfa,
      productDescription: `Total due: ${formattedPrice} ${paymentCurrency}. No amount above this will be charged.`,
      returnUrl: redirectURL,
      webHookUrl: webhookURL,
    };

    const response = await fetch("https://www.dklo.co/api/tara/paymentlinks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const isSuccess = data.status === "success" || data.status === "SUCCESS";

    if (!response.ok || !isSuccess) {
      console.error("TaraMoney error:", data);
      return NextResponse.json(
        { success: false, message: data.message || data.status || "Failed to initialize payment." },
        { status: response.ok ? 400 : response.status }
      );
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      if (userId) {
        await supabase.from("orders").insert({
          id: orderId,
          user_id: userId,
          plan_name: plan.name,
          credits: plan.credits,
          amount_local: amountLocal,
          currency: paymentCurrency,
          payment_method: "TaraMoney",
          payment_ref: orderId,
          status: "pending",
        });
      }
    } catch (dbErr) {
      console.error("Failed to insert pending order:", dbErr);
    }

    return NextResponse.json({
      success: true,
      cartId: orderId,
      redirectUrl: data.generalLink || data.cardLink,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { success: false, message: "The service is temporarily unavailable. Please try again shortly." },
      { status: 500 }
    );
  }
}
