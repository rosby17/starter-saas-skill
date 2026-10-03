import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, first_name, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2">Name</th>
            <th>Admin</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {(users || []).map((u) => (
            <tr key={u.id} className="border-b border-gray-100">
              <td className="py-2">{u.first_name || u.id}</td>
              <td>{u.is_admin ? "Yes" : "No"}</td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
