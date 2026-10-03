import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { expirePendingOrders } from "@/lib/orders/expire-pending";

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

    const result = await expirePendingOrders(supabase, { userId: user.id });

    return NextResponse.json({ success: true, expiredCount: result.expiredCount });
  } catch (error) {
    console.error("Expire stale orders error:", error);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
