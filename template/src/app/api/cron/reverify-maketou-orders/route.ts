import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { creditPaidOrder } from "@/lib/orders/credit-order";

export const dynamic = "force-dynamic";

const DEFAULT_LOOKBACK_HOURS = 7 * 24; // 7 days: deep sweep by default
const MIN_LOOKBACK_HOURS = 1;
const MAX_LOOKBACK_HOURS = 30 * 24;

// Keep each cron invocation well under typical serverless time limits by
// checking orders in parallel batches, with a per-call timeout and an
// overall time budget that leaves room to respond cleanly before a cutoff.
const CONCURRENCY = 8;
const MAKETOU_TIMEOUT_MS = 4000;
const TIME_BUDGET_MS = 7000;

/**
 * Safety net for Maketou: this provider has no webhook, so crediting relies
 * on the client returning to /billing/success (see verify/route.ts). If the
 * customer never returns (e.g. they paid from a separate mobile money app
 * and closed the tab), the order stays "pending" and eventually gets marked
 * "failed" even though the payment went through. This cron re-checks
 * Maketou for recent pending/failed orders and credits the ones that were
 * actually paid.
 *
 * The lookback window is adjustable via ?hours=N so you can run this at two
 * cadences: a frequent shallow pass (e.g. every minute with ?hours=2) that
 * only touches very recent orders, and a daily deep sweep with no parameter
 * (7 days) as a final safety net. Without this knob, a minutely cron would
 * replay the same hundreds of abandoned carts every run and get rate-limited
 * by Maketou.
 *
 * Protect this route behind CRON_SECRET (see .env.example) — call it with
 * `Authorization: Bearer $CRON_SECRET` from your scheduler.
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const hoursParam = Number(new URL(request.url).searchParams.get("hours"));
    const lookbackHours = Number.isFinite(hoursParam) && hoursParam > 0
      ? Math.min(Math.max(hoursParam, MIN_LOOKBACK_HOURS), MAX_LOOKBACK_HOURS)
      : DEFAULT_LOOKBACK_HOURS;

    const apiKey = process.env.MAKETOU_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "Missing Maketou configuration." }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("payment_method", "Maketou Checkout")
      .in("status", ["pending", "failed"])
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    const credited: string[] = [];
    const checked: string[] = [];
    let skippedCount = 0;

    const checkOrder = async (order: any) => {
      checked.push(order.id);
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), MAKETOU_TIMEOUT_MS);
      try {
        const response = await fetch(`https://api.maketou.net/api/v1/stores/cart/${order.id}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = await response.json();
        const cart = data.cart || data;

        if (cart?.status === "completed" || cart?.status === "success") {
          // creditPaidOrder atomically claims the order: safe even if several
          // checks run concurrently (this cron, a live verify call, etc).
          const wasCredited = await creditPaidOrder(supabase, order, "via Maketou (cron reconciliation)");
          if (wasCredited) {
            credited.push(order.id);
            console.log(`[reverify-maketou] Credited order ${order.id} (${order.credits} credits, user ${order.user_id})`);
          }
        }
      } catch (orderErr) {
        console.error(`[reverify-maketou] Error checking order ${order.id}:`, orderErr);
      } finally {
        clearTimeout(abortTimer);
      }
    };

    const pending = orders || [];
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        // Return cleanly before the platform kills the function; the rest
        // will be picked up on the next run.
        skippedCount = pending.length - i;
        break;
      }
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(checkOrder));
    }

    return NextResponse.json({
      success: true,
      lookbackHours,
      checkedCount: checked.length,
      creditedCount: credited.length,
      skippedCount,
      durationMs: Date.now() - startedAt,
      creditedIds: credited,
    });
  } catch (error) {
    console.error("Cron reverify Maketou orders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reverify Maketou orders." },
      { status: 500 }
    );
  }
}
