"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminMaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "maintenance")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled((data?.value as { enabled?: boolean } | undefined)?.enabled === true);
        setLoading(false);
      });
  }, [supabase]);

  const toggle = async () => {
    setSaving(true);
    setFailed("");
    const next = !enabled;
    const { error } = await supabase.from("system_settings").upsert({ key: "maintenance", value: { enabled: next } });
    // L'écran n'affiche le nouvel état que s'il est vraiment enregistré.
    if (error) setFailed("Le changement n’a pas été enregistré. Réessaie dans un instant.");
    else setEnabled(next);
    setSaving(false);
  };

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Mode maintenance</h1>
      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : (
        <div className="border border-gray-200 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Mode maintenance {enabled ? "activé" : "désactivé"}</p>
            <p className="text-sm text-gray-500">Activé : tous les visiteurs (sauf les administrateurs) voient la page de maintenance.</p>
          </div>
          <Button variant={enabled ? "danger" : "primary"} onClick={toggle} disabled={saving}>
            {enabled ? "Désactiver" : "Activer"}
          </Button>
        </div>
      )}
      {failed && <p className="mt-4 text-sm text-red-600">{failed}</p>}
    </main>
  );
}
