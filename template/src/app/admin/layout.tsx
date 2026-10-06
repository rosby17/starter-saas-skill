import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSecretsStatus } from "@/lib/secrets/store";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/orders", label: "Commandes" },
  { href: "/admin/payment-providers", label: "Paiements" },
  { href: "/admin/keys", label: "Clés et intégrations" },
  { href: "/admin/deploy", label: "Mise en ligne" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/feedbacks", label: "Avis" },
  { href: "/admin/announcements", label: "Annonces" },
  { href: "/admin/sante", label: "Santé" },
  { href: "/admin/server", label: "Ressources serveur" },
  { href: "/admin/maintenance", label: "Maintenance" },
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
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-gray-200 p-4 space-y-1">
        <h2 className="font-bold px-2 mb-4">Administration</h2>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="block px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="flex-1">
        {missing.length > 0 && (
          <div className="m-8 mb-0 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span>{missing.length === 1 ? "1 clé manquante" : `${missing.length} clés manquantes`} : {missing.map((s) => s.name).join(", ")}</span>
            <Link href={`/admin/keys?focus=${missing[0].name}#${missing[0].name}`} className="ml-auto rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white">
              Renseigner
            </Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
