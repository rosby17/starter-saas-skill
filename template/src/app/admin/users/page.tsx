import { serviceClient } from "@/lib/auth/service-client";
import { UserTools } from "@/components/admin/UserTools";
import type { FoundUser } from "@/components/admin/UserSearch";

export const dynamic = "force-dynamic";

// Utilisateurs : outils (crédits, accès admin) avec recherche par nom ou e-mail, puis les 50 derniers inscrits.
// La page est déjà réservée aux administrateurs par admin/layout.tsx ; la liste vient de admin_search_users (e-mail compris).
export default async function AdminUsersPage() {
  const { data, error } = await serviceClient().rpc("admin_search_users", { search: "", max_results: 50 });
  const users = (data ?? []) as FoundUser[];

  return (
    <main className="space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>
      <UserTools />

      <section>
        <h2 className="mb-3 font-semibold">Derniers inscrits</h2>
        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">Liste illisible (migration admin_user_search appliquée ?).</p>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Admin</th>
                <th className="px-4 py-2 font-medium">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">{u.first_name || "—"}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.is_admin ? "Oui" : "Non"}</td>
                  <td className="px-4 py-2">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {!users.length && !error && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Aucun compte pour l’instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
