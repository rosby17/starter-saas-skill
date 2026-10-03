import { createClient } from "@/lib/supabase/server";

export default async function AdminFeedbacksPage() {
  const supabase = await createClient();
  const { data: feedbacks } = await supabase
    .from("feedbacks")
    .select("id, message, rating, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Avis</h1>
      <div className="space-y-2">
        {(feedbacks || []).map((f) => (
          <div key={f.id} className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm">{f.message}</p>
            <p className="text-xs text-gray-500 mt-1">{f.rating ? `Rating: ${f.rating}/5 · ` : ""}{new Date(f.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {(!feedbacks || feedbacks.length === 0) && (
          <p className="text-gray-500 text-sm">Aucun avis pour l'instant.</p>
        )}
      </div>
    </main>
  );
}
