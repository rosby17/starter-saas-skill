import { createClient } from "@/lib/supabase/server";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Demandes d'aide</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2">Sujet</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {(tickets || []).map((t) => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className="py-2">{t.subject}</td>
              <td>{t.status}</td>
              <td>{new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!tickets || tickets.length === 0) && <p className="text-gray-500 text-sm mt-4">Aucune demande pour l'instant.</p>}
    </main>
  );
}
