import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSecretsStatus } from "@/lib/secrets/store";
import { AppShell, type NavItem } from "@/components/shell/AppShell";

// Menu de l'administration (icônes : components/shell/icons.tsx). Une nouvelle page d'admin y ajoute sa ligne.
const NAV: NavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: "overview" },
  { href: "/admin/users", label: "Utilisateurs", icon: "users" },
  { href: "/admin/orders", label: "Commandes", icon: "cart" },
  { href: "/admin/payment-providers", label: "Paiements", icon: "card" },
  { href: "/admin/keys", label: "Clés et intégrations", icon: "key" },
  { href: "/admin/emails", label: "E-mails", icon: "mail" },
  { href: "/admin/deploy", label: "Mise en ligne", icon: "rocket" },
  { href: "/admin/support", label: "Support", icon: "chat" },
  { href: "/admin/feedbacks", label: "Avis", icon: "star" },
  { href: "/admin/announcements", label: "Annonces", icon: "megaphone" },
  { href: "/admin/sante", label: "Santé", icon: "heart" },
  { href: "/admin/server", label: "Ressources serveur", icon: "server" },
  { href: "/admin/maintenance", label: "Maintenance", icon: "tool" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Réservé aux comptes dont profiles.is_admin = true (à activer à la main pour toi).
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  // Clés indispensables manquantes (passerelles actives, e-mails, crons) : un bandeau, un clic pour les renseigner.
  const missing = (await getSecretsStatus()).filter((s) => s.required && s.source === "missing");

  return (
    <AppShell items={NAV} homeHref="/admin" sectionLabel="Administration" email={user.email ?? ""} isAdmin
      footerLink={{ href: "/dashboard", label: "Mon espace", tone: "gray" }}>
      {missing.length > 0 && (
        <div className="m-4 mb-0 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:m-8 sm:mb-0">
          <span className="min-w-0 flex-1">{missing.length === 1 ? "1 clé manquante" : `${missing.length} clés manquantes`} : {missing.map((s) => `${s.group} › ${s.label}`).join(", ")}</span>
          <Link href={`/admin/keys?focus=${missing[0].name}`} className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white">
            Configurer
          </Link>
        </div>
      )}
      {children}
    </AppShell>
  );
}
