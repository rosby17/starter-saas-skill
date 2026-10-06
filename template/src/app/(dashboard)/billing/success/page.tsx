"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BackToAccount } from "@/components/BackToAccount";

function SuccessContent() {
  const searchParams = useSearchParams();
  const cartId = searchParams.get("cartId");
  const [status, setStatus] = useState<"checking" | "success" | "pending" | "error">("checking");

  useEffect(() => {
    if (!cartId) {
      setStatus("error");
      return;
    }

    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/payment/verify?cartId=${cartId}`);
        const data = await res.json();
        if (data?.cart?.status === "completed") {
          setStatus("success");
          return;
        }
      } catch {
        // keep polling
      }
      if (attempts < 15) {
        setTimeout(poll, 4000);
      } else {
        setStatus("pending");
      }
    };
    poll();
  }, [cartId]);

  return (
    <>
    <BackToAccount />
    <main className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        {status === "checking" && (
          <>
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600">Confirmation de ton paiement…</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">Paiement confirmé !</h1>
            <p className="text-gray-600">Tes crédits ont été ajoutés.</p>
            <Link href="/dashboard" className="inline-block mt-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium">
              Retour à mon espace
            </Link>
          </>
        )}
        {status === "pending" && (
          <>
            <h1 className="text-2xl font-bold">Paiement en cours de traitement</h1>
            <p className="text-gray-600">C'est plus long que d'habitude. Tu recevras un e-mail dès qu'il sera confirmé.</p>
          </>
        )}
        {status === "error" && <p className="text-gray-600">Aucune référence de commande trouvée.</p>}
      </div>
    </main>
    </>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
