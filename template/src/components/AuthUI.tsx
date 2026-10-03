"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "{{APP_NAME}}";

function AuthForm({ initialMode }: { initialMode: "login" | "signup" }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
        <p className="text-gray-600 mt-2">
          {mode === "login" ? "Sign in to your account" : "Create your account"}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600 space-y-2">
        {mode === "login" ? (
          <>
            <p>
              No account?{" "}
              <button className="font-semibold text-gray-900 hover:underline" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </p>
            <p>
              <Link href="/reset-password" className="hover:underline">
                Forgot your password?
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{" "}
            <button className="font-semibold text-gray-900 hover:underline" onClick={() => setMode("login")}>
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function AuthUI({ initialMode }: { initialMode: "login" | "signup" }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />}>
        <AuthForm initialMode={initialMode} />
      </Suspense>
    </div>
  );
}
