"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Maintenance du SITE ENTIER : seulement le temps d'une intervention, et seulement à la main.
// Une panne de fournisseur ne coupe JAMAIS le site ni l'API : seul le service concerné est mis en pause dans
// l'espace client, automatiquement par la sonde (Administration › Moteurs IA).
export default function AdminMaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    const next = !enabled;
    const { error: saveError } = await supabase.from("system_settings").upsert({ key: "maintenance", value: { enabled: next } });
    if (saveError) setError("Enregistrement impossible. Réessayez dans un instant.");
    else setEnabled(next);
    setSaving(false);
  };

  return (
    <main className="max-w-lg space-y-4 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Mode maintenance</h1>
      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 p-6">
          <div className="min-w-0">
            <p className="font-medium">Maintenance du site {enabled ? "activée" : "désactivée"}</p>
            <p className="text-sm text-gray-500">Activée : tous les visiteurs (sauf les administrateurs) voient la page de maintenance.</p>
          </div>
          <Button variant={enabled ? "danger" : "primary"} onClick={toggle} disabled={saving}>
            {enabled ? "Désactiver" : "Activer"}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <p className="text-sm text-gray-500">
        Un fournisseur en panne ne coupe jamais le site : seul le service concerné est mis en pause dans l’espace client, puis rouvert dès qu’il répond.{" "}
        <Link href="/admin/moteurs" className="underline underline-offset-2 hover:text-gray-900">Voir les services et la sonde</Link>
      </p>
    </main>
  );
}
