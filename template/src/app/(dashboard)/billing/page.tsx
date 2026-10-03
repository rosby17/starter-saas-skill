"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
      setEmail(data.user?.email || null);
    });
  }, [supabase]);

  const handleCheckout = async (planId: string) => {
    setError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId,
          email,
          firstName: email?.split("@")[0] || "Customer",
          lastName: "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (data.redirectUrl) window.location.href = data.redirectUrl;
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Billing</h1>
      <p className="text-gray-600 mb-8">Choose a plan. Prices below are placeholders — edit src/lib/pricing.ts.</p>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div key={plan.id} className="border border-gray-200 rounded-2xl p-6 flex flex-col">
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="text-2xl font-bold mt-2">
              {plan.amountLocal === 0 ? "Free" : `${plan.amountLocal.toLocaleString()} ${plan.currency}`}
            </p>
            <ul className="mt-4 space-y-1 text-sm text-gray-600 flex-1">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Button
              className="mt-6"
              disabled={plan.id === "free" || loadingPlan === plan.id}
              onClick={() => handleCheckout(plan.id)}
            >
              {plan.id === "free" ? "Current plan" : loadingPlan === plan.id ? "Redirecting…" : "Upgrade"}
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
