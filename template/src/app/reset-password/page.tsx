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
          setError("Lien de réinitialisation invalide. Utilise le lien exact reçu par e-mail.");
        }
      }
    };

    checkSessionAndToken();
  }, [searchParams, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
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
      setError(err.message || "Impossible de changer le mot de passe.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Mot de passe changé !</h2>
        <p className="text-gray-600">Ton mot de passe a bien été modifié.</p>
        <p className="text-sm text-gray-500">Redirection vers ton espace…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
        <p className="text-gray-600 mt-2">Choisis ton nouveau mot de passe.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={isLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirme le mot de passe</label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
        </div>
        <Button type="submit" disabled={isLoading || !!error} className="w-full">
          {isLoading ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
