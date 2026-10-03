"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [paymentType, setPaymentType] = useState<"mobile_money" | "card" | "paypal" | "crypto">("mobile_money");
  const [email, setEmail] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<{ title: string; lines: string[] } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
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
          paymentType, // 'mobile_money' | 'card' | 'paypal' : la passerelle est choisie par l'admin
          firstName: email?.split("@")[0] || "Client",
          lastName: "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (data.redirectUrl) window.location.href = data.redirectUrl;
      else if (data.manual) setManual(data.manual); // paiement manuel (Binance) : instructions à afficher
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Abonnement</h1>
      <p className="text-gray-600 mb-6">Choisis un forfait puis ton moyen de paiement. Les prix viennent de src/lib/pricing.ts.</p>
      <div className="mb-8 inline-flex rounded-lg border border-gray-200 p-1 text-sm">
        {([["mobile_money", "Mobile Money"], ["card", "Carte bancaire"], ["paypal", "PayPal"], ["crypto", "Binance Pay"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPaymentType(id)}
            className={`rounded-md px-4 py-2 ${paymentType === id ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}>{label}</button>
        ))}
      </div>

      {manual && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 font-semibold">{manual.title}</p>
          <ul className="space-y-1">{manual.lines.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
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
