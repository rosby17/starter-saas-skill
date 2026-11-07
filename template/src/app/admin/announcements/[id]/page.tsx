import { requireAdminPage } from '@/lib/auth/admin-page'
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function AdminAnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params;
  const supabase = await createClient();
  const { data: announcement } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();

  if (!announcement) notFound();

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">{announcement.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {announcement.published ? "Published" : "Draft"} · {new Date(announcement.created_at).toLocaleString()}
      </p>
      <div className="prose max-w-none whitespace-pre-wrap">{announcement.body}</div>
    </main>
  );
}
