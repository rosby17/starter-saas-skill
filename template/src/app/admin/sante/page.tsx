"use client";

import { useCallback, useEffect, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";

interface Problem {
  key: string;
  ids: string[];
  severity: Severity;
  feature: string;
  cause: string;
  fix: string;
  clientMessage: string | null;
  count: number;
  affectedUsers: number;
  lastSeen: string;
}

interface Counts { todo: number; critical: number; high: number; medium: number; client: number; resolved: number }

const PERIODS = [["24h", "24 h"], ["7d", "7 j"], ["30d", "30 j"]] as const;
const SOURCES = [["all", "Tous les canaux"], ["web", "Site"], ["api", "API"], ["server", "Serveur"]] as const;
const MAX_CARDS = 5;

const DOT: Record<Severity, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-slate-400" };
const isProviderCause = (cause: string) => cause.startsWith("Le fournisseur externe");

const timeAgo = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`;
};

export default function AdminSantePage() {
  const [period, setPeriod] = useState("24h");
  const [source, setSource] = useState("all");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period, source, state: "open", severity: "todo", sort: "priority", page: "1" });
      const res = await fetch(`/api/admin/errors?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error();
      setProblems(data.problems || []);
      setCounts(data.counts);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [period, source]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const resolve = async (problem: Problem) => {
    setBusy(problem.key);
    try {
      await fetch("/api/admin/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: problem.ids.slice(0, 500), resolved: true }),
      });
      await load();
      window.dispatchEvent(new Event("adminUnreadChanged"));
    } finally {
      setBusy(null);
    }
  };

  const toTreat = problems.filter((p) => p.severity !== "low");
  const auto = problems.filter((p) => p.severity === "low");
  const providerCount = auto.filter((p) => isProviderCause(p.cause)).reduce((sum, p) => sum + p.count, 0);
  const clientCount = auto.filter((p) => !isProviderCause(p.cause)).reduce((sum, p) => sum + p.count, 0);
  const hasCritical = toTreat.some((p) => p.severity === "critical");
  const shown = showAll ? toTreat : toTreat.slice(0, MAX_CARDS);

  const status = toTreat.length === 0
    ? { tone: "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300", title: "Tout va bien", sub: "Aucun problème venant de notre code sur cette période.", icon: <span className="text-2xl" aria-hidden>✓</span> }
    : {
        tone: hasCritical ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
        title: `${toTreat.length} chose${toTreat.length > 1 ? "s" : ""} à traiter`,
        sub: "Problèmes venant de notre code. Le reste est géré automatiquement.",
        icon: <span className="text-2xl" aria-hidden>!</span>,
      };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Supervision</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">Santé</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 bg-surface p-1 text-sm">
            {PERIODS.map(([id, label]) => (
              <button key={id} onClick={() => setPeriod(id)} className={`rounded-lg px-3 py-1 ${period === id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{label}</button>
            ))}
          </div>
          <button onClick={load} aria-label="Actualiser" className="rounded-xl border border-gray-200 bg-surface p-2 text-gray-600 hover:bg-gray-50">
            <span aria-hidden>↻</span>
          </button>
        </div>
      </header>

      {failed && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les données. Actualisez dans un instant.</div>}

      {loading && !counts ? (
        <div className="py-16 text-center"><span className="text-gray-400">Chargement…</span></div>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${status.tone}`}>
            {status.icon}
            <div>
              <p className="text-lg font-bold">{status.title}</p>
              <p className="text-sm opacity-80">{status.sub}</p>
            </div>
          </div>

          {shown.length > 0 && (
            <ul className="space-y-2">
              {shown.map((problem) => (
                <li key={problem.key} className="rounded-2xl border border-gray-200 bg-surface">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[problem.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-semibold text-gray-900">{problem.feature} · {problem.cause}</p>
                      <p className="text-xs text-gray-500">{problem.count} fois · {problem.affectedUsers} client{problem.affectedUsers > 1 ? "s" : ""} · {timeAgo(problem.lastSeen)}</p>
                    </div>
                    <button onClick={() => setOpen(open === problem.key ? null : problem.key)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      Voir <span aria-hidden>{open === problem.key ? "▲" : "▼"}</span>
                    </button>
                    <button disabled={busy === problem.key} onClick={() => resolve(problem)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                      {busy === problem.key ? "…" : "Résolu"}
                    </button>
                  </div>
                  {open === problem.key && (
                    <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-sm">
                      <p><span className="font-semibold text-gray-900">Que faire : </span><span className="text-gray-700">{problem.fix}</span></p>
                      {problem.clientMessage && <p><span className="font-semibold text-gray-900">Ce que le client a lu : </span><span className="text-gray-700">{problem.clientMessage}</span></p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {toTreat.length > MAX_CARDS && (
            <button onClick={() => setShowAll((v) => !v)} className="text-sm text-gray-600 hover:underline">
              {showAll ? "Afficher moins" : `Voir les ${toTreat.length - MAX_CARDS} autres`}
            </button>
          )}

          <section>
            <p className="mb-2 text-xs font-medium text-gray-500">Gérées automatiquement</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([
                ["Fournisseur lent", providerCount, "remboursées"],
                ["Côté client", clientCount, "connexion, solde, saisie"],
                ["Résolues", counts?.resolved ?? 0, `sur ${PERIODS.find(([id]) => id === period)?.[1]}`],
              ] as const).map(([label, value, hint]) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-surface px-4 py-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{hint}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 text-sm">
            <div className="flex flex-wrap gap-4">
              {SOURCES.map(([id, label]) => (
                <button key={id} onClick={() => setSource(id)} className={`pb-1 ${source === id ? "border-b-2 border-gray-900 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{label}</button>
              ))}
            </div>
            <div className="flex gap-4 text-gray-500">
            </div>
          </section>
        </>
      )}
    </div>
  );
}
