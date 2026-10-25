"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { HoneypotField } from "@/components/HoneypotField";
import { honeypotPayload } from "@/lib/honeypot";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleButton } from "@/components/GoogleButton";
import { clsx } from "@/lib/utils";
import { AuthHero } from "@/components/AuthHero";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Mail, KeyRound } from "lucide-react";
import { site } from '@/config/site'

type Mode = "magic" | "password" | "signup";

const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard");

// Connexion : par lien reçu par e-mail (par défaut, aucun mot de passe à retenir) ou par mot de passe
// (s'il en a choisi un dans « Mon compte »). Inscription : nom, e-mail, WhatsApp, puis lien par e-mail.
function AuthForm({ initialMode, google }: { initialMode: "login" | "signup"; google: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode === "signup" ? "signup" : "magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(site.payments.defaultCountry);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const expired = searchParams.get("lien") === "expire";
  // Anti-spam de l'inscription (lib/honeypot.ts) : moment d'affichage du formulaire.
  const formStartedAt = useRef(0);
  useEffect(() => { formStartedAt.current = Date.now(); }, []);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json().catch(() => ({ success: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const antiSpam = honeypotPayload(e.currentTarget as HTMLFormElement, formStartedAt.current);
    setError(null);
    setInfo(null);
    setIsLoading(true);
    try {
      if (mode === "magic") {
        const d = await post("/api/auth/magic-link", { email, next });
        if (!d.success) throw new Error(d.message || "Envoi impossible.");
        setInfo(d.message);
      } else if (mode === "signup") {
        const d = await post("/api/auth/signup", { fullName, email, phone, country, password: password || undefined, ...antiSpam });
        if (!d.success) throw new Error(d.message || "Inscription impossible.");
        if (d.autoLogin) {
          // Mot de passe choisi : connexion immédiate, sans attendre l'e-mail.
          const { error } = await createClient().auth.signInWithPassword({ email, password });
          if (!error) { router.push(next); router.refresh(); return; }
        }
        setInfo(d.message);
      } else {
        const { error } = await createClient().auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou mot de passe incorrect. Pas de mot de passe ? Reçois plutôt un lien par e-mail.");
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const tab = (m: Mode, label: string, Icon: typeof Mail) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setInfo(null); }}
      className={clsx("flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm transition-colors", mode === m ? "bg-surface font-medium text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
      <Icon className="h-4 w-4" strokeWidth={1.8} />{label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-md" style={{ animation: "courseRise 0.45s ease-out both" }}>
      <div className="mb-8">
        <Link href="/" className="inline-block text-lg lg:hidden"><Logo /></Link>
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-brand lg:mt-0">{mode === "signup" ? "Inscription" : "Connexion"}</p>
        <h1 className="mt-2 text-4xl leading-tight text-gray-900">{mode === "signup" ? "Crée ton compte" : "Content de te revoir"}</h1>
        <p className="mt-3 text-[16px] leading-7 text-gray-600">
          {mode === "signup"
            ? "Ton espace pour retrouver tes achats, tes formations et tes factures."
            : "Tes formations, ta progression, la communauté et tes fichiers t’attendent. Pas de mot de passe à retenir : on peut t’envoyer un lien."}
        </p>
        {/* Sur téléphone, le panneau de gauche est masqué : la mission tient en une ligne. */}
        {site.auth.mission && <p className="mt-4 rounded-xl border-l-2 border-brand bg-gray-100 px-3 py-2 text-sm text-gray-700 lg:hidden">{site.auth.mission}</p>}
      </div>

      {mode !== "signup" && (
        <div role="tablist" className="mb-6 flex gap-1 rounded-full bg-gray-100 p-1">
          {tab("magic", "Lien par e-mail", Mail)}
          {tab("password", "Mot de passe", KeyRound)}
        </div>
      )}

      {expired && !info && !error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Ce lien a expiré ou a déjà servi. Demande un nouveau lien ci-dessous.</div>
      )}
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{info}</div>}

      {google && (
        <div className="mb-6 space-y-6">
          <GoogleButton next={safeNext(searchParams.get("next"))} label={mode === "signup" ? "Créer mon espace avec Google" : "Continuer avec Google"} />
          <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />ou<span className="h-px flex-1 bg-gray-200" /></div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative space-y-4">
        <HoneypotField />
        {mode === "signup" && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">Nom complet</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">E-mail</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        {mode === "signup" && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">WhatsApp</label>
            <PhoneInput value={phone} onChange={setPhone} onCountry={setCountry} />
          </div>
        )}
        {mode === "signup" && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">Mot de passe <span className="text-gray-400">(facultatif, 8 caractères min.)</span></label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} placeholder="Ou connecte-toi plus tard par lien e-mail" />
          </div>
        )}
        {mode === "password" && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">Mot de passe</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
        )}
        <Button type="submit" disabled={isLoading} className="w-full rounded-full py-3.5 text-base">
          {isLoading ? "Un instant…" : mode === "magic" ? "Recevoir mon lien de connexion" : mode === "signup" ? "Créer mon espace" : "Se connecter"}
        </Button>
      </form>

      <div className="mt-8 space-y-2 text-center text-sm text-gray-500">
        {mode === "password" && (
          <p><button className="hover:underline" onClick={() => setMode("magic")}>Mot de passe oublié ? Reçois un lien par e-mail</button>, puis change-le dans « Mon compte ».</p>
        )}
        {/* Connexion et inscription sont deux pages distinctes (chacune son message) : on change de page, pas d'onglet. */}
        {mode === "signup" ? (
          <p>Déjà dans l’aventure ? <Link href={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand hover:underline">Se connecter</Link></p>
        ) : (
          <p>Pas encore de compte ? <Link href={`/signup${searchParams.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand hover:underline">Créer un compte</Link></p>
        )}
        <p><Link href="/" className="hover:underline">← Retour au site</Link></p>
      </div>
    </div>
  );
}

export default function AuthUI({ initialMode, google = false }: { initialMode: "login" | "signup"; google?: boolean }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthHero mode={initialMode} />
      <main className="relative flex flex-col bg-gray-50">
        <div className="flex justify-end p-5"><ThemeSwitch /></div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-10">
          <Suspense fallback={<div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />}>
            <AuthForm initialMode={initialMode} google={google} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
