import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/payment-providers", label: "Paiements" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/feedbacks", label: "Avis" },
  { href: "/admin/announcements", label: "Annonces" },
  { href: "/admin/maintenance", label: "Maintenance" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Réservé aux comptes dont profiles.is_admin = true (à activer à la main pour toi).
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

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
      <div className="flex-1">{children}</div>
    </div>
  );
}
