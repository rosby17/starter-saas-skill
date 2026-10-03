"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminMaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    const next = !enabled;
    await supabase.from("system_settings").upsert({ key: "maintenance", value: { enabled: next } });
    setEnabled(next);
    setSaving(false);
  };

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Mode maintenance</h1>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="border border-gray-200 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Maintenance mode is {enabled ? "ON" : "OFF"}</p>
            <p className="text-sm text-gray-500">Activé : tous les visiteurs (sauf les administrateurs) voient la page de maintenance.</p>
          </div>
          <Button variant={enabled ? "danger" : "primary"} onClick={toggle} disabled={saving}>
            {enabled ? "Désactiver" : "Activer"}
          </Button>
        </div>
      )}
    </main>
  );
}
