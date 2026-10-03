"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Supabase automatically parses the #access_token in the URL and establishes the session.
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const err = searchParams.get("error_description") || searchParams.get("error");
    if (err) {
      setError(decodeURIComponent(err).replace(/\+/g, " "));
      return;
    }

    const checkSessionAndToken = async () => {
      const tokenHash = searchParams.get("token_hash");
      if (!tokenHash) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("No valid reset token was found. Please use the exact link from your email.");
        }
      }
    };

    checkSessionAndToken();
  }, [searchParams, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokenHash = searchParams.get("token_hash");
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) throw verifyError;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred while resetting your password.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Password updated!</h2>
        <p className="text-gray-600">Your password has been changed successfully.</p>
        <p className="text-sm text-gray-500">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New password</h1>
        <p className="text-gray-600 mt-2">Enter your new password below.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={isLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
        </div>
        <Button type="submit" disabled={isLoading || !!error} className="w-full">
          {isLoading ? "Saving…" : "Save password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
