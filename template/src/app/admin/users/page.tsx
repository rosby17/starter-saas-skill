import { createClient } from "@/lib/supabase/server";
import { CreditAdjustmentForm } from "@/components/admin/CreditAdjustmentForm";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, first_name, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Utilisateurs</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Nom</th>
            <th>Admin</th>
            <th>Inscrit le</th>
            <th>Ajuster les crédits</th>
          </tr>
        </thead>
        <tbody>
          {(users || []).map((u) => (
            <tr key={u.id} className="border-b border-gray-100">
              <td className="py-2">{u.first_name || u.id}</td>
              <td>{u.is_admin ? "Oui" : "Non"}</td>
              <td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
              <td><CreditAdjustmentForm userId={u.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
