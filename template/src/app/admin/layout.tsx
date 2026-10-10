import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSecretsStatus } from "@/lib/secrets/store";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav, MaintenanceSwitch } from "./AdminNav";
import { AdminTopBar } from "./AdminTopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // Réservé aux comptes dont profiles.is_admin = true (créé par l'assistant /setup).
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  // Clés indispensables manquantes (passerelles actives, e-mails, crons) : un bandeau, un clic pour les renseigner.
  const missing = (await getSecretsStatus()).filter((s) => s.required && s.source === "missing");
  const { count: newRequests } = await supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle");

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-gray-200 bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-16 items-center px-4 md:h-20 md:px-7">
          <Link href="/admin" className="flex items-center gap-3"><Logo /><span className="hidden text-xs uppercase tracking-[0.16em] text-gray-500 md:inline">Admin</span></Link>
        </div>
        <AdminNav newRequests={newRequests ?? 0} />
        <div className="mt-auto hidden p-4 md:block">
          <MaintenanceSwitch />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar email={user.email ?? ""} logout={<LogoutButton className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50" />} />
        {missing.length > 0 && (
          <div className="m-4 mb-0 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 md:m-8 md:mb-0">
            <span>{missing.length === 1 ? "1 clé manquante" : `${missing.length} clés manquantes`} : {missing.map((s) => s.name).join(", ")}</span>
            <Link href={`/admin/keys?focus=${missing[0].name}#${missing[0].name}`} className="ml-auto rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white">
              Renseigner
            </Link>
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
