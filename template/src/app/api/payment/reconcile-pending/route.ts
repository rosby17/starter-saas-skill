import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { creditPaidOrder } from "@/lib/orders/credit-order";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 7;

/**
 * Reconciliation safety net for providers without reliable webhooks (or as a
 * belt-and-suspenders check even with webhooks). Call this when the user
 * returns to the app — which they will, since they're here to spend their
 * credits — to re-check their recent unpaid orders and credit any that were
 * actually paid.
 *
 * Safe by construction: creditPaidOrder atomically claims the order, so no
 * double-crediting even under concurrent calls.
 *
 * NOTE: this template implementation doesn't call out to TaraMoney's API
 * (the reference implementation this was adapted from queried a *different* provider,
 * which had no webhook at all). If TaraMoney's dashboard/API exposes an
 * order-status lookup, wire it in below; otherwise this route is safe to
 * leave as a no-op and rely on the webhook + expire-stale-orders cron.
 */
export async function POST() {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    // TODO: replace with a real provider status lookup + creditPaidOrder call
    // per order, mirroring the pattern in creditPaidOrder's callers.
    void creditPaidOrder;

    return NextResponse.json({ success: true, creditedCount: 0, checked: orders?.length || 0 });
  } catch (error) {
    console.error("reconcile-pending error:", error);
    // Never break app load over a failed reconciliation attempt.
    return NextResponse.json({ success: false, creditedCount: 0 }, { status: 200 });
  }
}
