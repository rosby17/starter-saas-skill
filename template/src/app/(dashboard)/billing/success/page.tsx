"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        {status === "checking" && (
          <>
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600">Confirming your payment…</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">Payment confirmed!</h1>
            <p className="text-gray-600">Your account has been credited.</p>
            <Link href="/dashboard" className="inline-block mt-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">
              Go to dashboard
            </Link>
          </>
        )}
        {status === "pending" && (
          <>
            <h1 className="text-2xl font-bold">Still processing</h1>
            <p className="text-gray-600">This is taking longer than usual. We&apos;ll email you once it&apos;s confirmed.</p>
          </>
        )}
        {status === "error" && <p className="text-gray-600">No order reference found.</p>}
      </div>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
