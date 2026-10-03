import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { sendEmail } from "@/lib/email/brevo";
import { rechargeConfirmationTemplate } from "@/lib/email/templates";
import { flagCreditInsertFailure } from "@/lib/orders/credit-order";

// Constant-time comparison: prevents an attacker from guessing the secret
// character-by-character via response-time differences.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  try {
    // TaraMoney doesn't sign webhooks: without this shared secret (embedded
    // in the callback URL at checkout time, see checkout/route.ts), anyone
    // who knows a pending order's UUID could POST a fake "SUCCESS" and get
    // credited without paying.
    const expectedSecret = process.env.TARA_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error("TARA_WEBHOOK_SECRET is not configured — rejecting all TaraMoney webhooks.");
      return NextResponse.json({ success: false, message: "Webhook misconfigured" }, { status: 500 });
    }

    const providedKey = new URL(request.url).searchParams.get("key") || "";
    if (!safeEqual(providedKey, expectedSecret)) {
      console.error("TaraMoney webhook rejected: invalid or missing key");
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const { status, productId, amount, paymentId } = payload;
    const normalizedStatus = String(status || "").toUpperCase();
    const failureStatuses = ["FAILED", "FAIL", "CANCELLED", "CANCELED", "EXPIRED", "ERROR", "DECLINED"];
    // Not documented for this integration and never observed in practice;
    // there is no automated credit-reversal mechanism — see comment below.
    const reversalStatuses = ["REFUND", "REFUNDED", "CHARGEBACK", "DISPUTED", "REVERSED"];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (reversalStatuses.includes(normalizedStatus) && productId) {
      const { data: reversedOrder } = await supabase
        .from("orders")
        .select("id, user_id, credits, status")
        .eq("id", productId)
        .maybeSingle();

      if (reversedOrder?.status === "success") {
        // TODO: decide your product policy here (suspend account? allow
        // negative balance?) — reclaiming already-spent credits automatically
        // is a business decision, not something safe to guess in code.
        console.error(
          `[ACTION REQUIRED] TaraMoney reported "${status}" for order ${productId} ` +
          `(user ${reversedOrder.user_id}, ${reversedOrder.credits} credits already granted). ` +
          `No automatic reversal performed — manual review required.`
        );
        await supabase.from("orders").update({ status: "flagged_reversal" }).eq("id", productId);
      }
      return NextResponse.json({ success: true, message: "Reversal status flagged for manual review." });
    }

    if (normalizedStatus !== "SUCCESS") {
      if (productId && failureStatuses.includes(normalizedStatus)) {
        await supabase.from("orders").update({ status: "failed" }).eq("id", productId).eq("status", "pending");
      }
      return NextResponse.json({ success: true, message: "Payment not successful, ignoring." });
    }

    if (!productId) {
      return NextResponse.json({ success: false, message: "Missing productId" }, { status: 400 });
    }

    // Verify the amount actually collected matches what was due BEFORE
    // crediting. Without this check, an under-billed amount (currency-conversion
    // bug, tampered cart, etc.) would still credit the full plan. 2% tolerance
    // for provider rounding.
    const { data: pendingOrder } = await supabase
      .from("orders")
      .select("id, user_id, amount_local, currency, credits, plan_name")
      .eq("id", productId)
      .maybeSingle();

    if (pendingOrder) {
      const paidAmount = Number(amount);
      const expectedAmount = Number(pendingOrder.amount_local) || 0;
      const tolerance = Math.max(expectedAmount * 0.02, 5);
      if (Number.isFinite(paidAmount) && expectedAmount > 0 && paidAmount < expectedAmount - tolerance) {
        console.error(
          `[ACTION REQUIRED] TaraMoney confirmed "SUCCESS" for order ${productId} but the amount ` +
          `received (${paidAmount}) is less than what was due (${expectedAmount}). Credits NOT granted.`
        );
        await supabase.from("orders").update({ status: "flagged_underpaid" }).eq("id", productId);
        return NextResponse.json({ success: true, message: "Amount mismatch, flagged for manual review." });
      }
    }

    // Atomically claim the order to avoid double-processing.
    const { data: existingOrder } = await supabase
      .from("orders")
      .update({ status: "success", payment_ref: paymentId || productId })
      .eq("id", productId)
      .neq("status", "success")
      .select()
      .single();

    if (!existingOrder) {
      return NextResponse.json({ success: true, message: "Order not found or already processed." });
    }

    const { error: creditError } = await supabase.from("credits").insert({
      user_id: existingOrder.user_id,
      amount: existingOrder.credits,
      source: "purchase",
      order_id: productId,
    });
    if (creditError) {
      await flagCreditInsertFailure(supabase, {
        orderId: productId,
        userId: existingOrder.user_id,
        credits: existingOrder.credits,
        error: creditError,
        source: "webhook/taramoney",
      });
    }

    try {
      const { data: userData } = await supabase.auth.admin.getUserById(existingOrder.user_id);
      if (userData?.user?.email) {
        const amountStr = `${existingOrder.amount_local || 0} ${existingOrder.currency || "XOF"}`;
        await sendEmail({
          to: { email: userData.user.email },
          subject: "Your purchase is confirmed",
          html: rechargeConfirmationTemplate({
            credits: existingOrder.credits,
            amount: amountStr,
            planName: existingOrder.plan_name || "Credits",
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error sending confirmation email:", emailErr);
    }

    console.log(`Successfully credited ${existingOrder.credits} to user ${existingOrder.user_id} via TaraMoney`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
