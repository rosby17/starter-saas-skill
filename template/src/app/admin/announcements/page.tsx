import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, published, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Annonces</h1>
      <div className="space-y-2">
        {(announcements || []).map((a) => (
          <Link
            key={a.id}
            href={`/admin/announcements/${a.id}`}
            className="block border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
          >
            <p className="font-medium">{a.title}</p>
            <p className="text-xs text-gray-500">{a.published ? "Published" : "Draft"} · {new Date(a.created_at).toLocaleDateString()}</p>
          </Link>
        ))}
        {(!announcements || announcements.length === 0) && (
          <p className="text-gray-500 text-sm">No announcements yet.</p>
        )}
      </div>
    </main>
  );
}
