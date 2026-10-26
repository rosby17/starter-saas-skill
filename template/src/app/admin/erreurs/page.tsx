"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Administration › Erreurs : UNE page de supervision (l'ancienne page « Santé » y est fusionnée).
//  1. une phrase d'état ;  2. au plus 5 problèmes à traiter, chacun avec ses occurrences dépliables sous la carte ;
//  3. ce qui est géré automatiquement ;  4. la santé des services (moteurs IA, services en pause) ;  5. canaux, période.
// Les erreurs se ferment seules (correctif livré, même action réussie de nouveau, 24 h sans récidive) : le bouton
// « Résolu » ne sert qu'en dernier recours.

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

interface Occurrence {
  id: string;
  reference: string;
  created_at: string;
  source: string;
  action: string;
  page: string | null;
  http_status: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  user_agent: string | null;
}

interface Counts { todo: number; client: number; resolved: number }
type Health = { engines: { id: string; codename: string; state: string }[]; services: { id: string; label: string; outage: { since: string; auto: boolean } | null; models: { id: string; label: string; servedBy: string | null }[] }[] };

const PERIODS = [["24h", "24 h"], ["7d", "7 j"], ["30d", "30 j"]] as const;
const SOURCES = [["all", "Tous les canaux"], ["web", "Site"], ["api", "API"], ["server", "Serveur"]] as const;
const SOURCE_LABELS: Record<string, string> = { web: "Site", api: "API", server: "Serveur" };
const MAX_CARDS = 5;

const DOT: Record<Severity, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-slate-400" };
const isProviderCause = (cause: string) => cause.startsWith("Le fournisseur externe") || cause.startsWith("Une tâche isolée");

const timeAgo = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`;
};
const formatDate = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AdminErreursPage() {
  const [period, setPeriod] = useState("24h");
  const [source, setSource] = useState("all");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period, source });
      const [errorsRes, healthRes] = await Promise.all([
        fetch(`/api/admin/errors?${params}`, { cache: "no-store" }),
        fetch("/api/admin/engines", { cache: "no-store" }).catch(() => null),
      ]);
      const data = await errorsRes.json();
      if (!data.success) throw new Error();
      setProblems(data.problems || []);
      setCounts(data.counts);
      const healthData = healthRes ? await healthRes.json().catch(() => null) : null;
      setHealth(healthData?.success ? healthData : null);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [period, source]);

  useEffect(() => { void load(); }, [load]);
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

  const paused = health?.services.filter((s) => s.outage) ?? [];
  const greyed = health?.services.flatMap((s) => s.models.filter((m) => !m.servedBy).map((m) => `${s.label} › ${m.label}`)) ?? [];
  const dryEngines = health?.engines.filter((e) => e.state === "set_aside") ?? [];

  const status = toTreat.length === 0
    ? { tone: "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300", title: "Tout va bien", sub: "Aucun problème venant de notre code sur cette période.", icon: "✓" }
    : {
        tone: hasCritical ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
        title: `${toTreat.length} chose${toTreat.length > 1 ? "s" : ""} à traiter`,
        sub: "Problèmes venant de notre code. Le reste est géré automatiquement.",
        icon: "!",
      };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-10 pt-6 md:px-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Supervision</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">Erreurs</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Ce qui échoue pour vos clients, classé par priorité, avec la santé de chaque service. Les erreurs se ferment seules dès que leur cause est réglée.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 bg-surface p-1 text-sm">
            {PERIODS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setPeriod(id)} className={`rounded-lg px-3 py-1 ${period === id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label="Actualiser" className="rounded-xl border border-gray-200 bg-surface p-2 text-gray-600 hover:bg-gray-50">
            <span aria-hidden>↻</span>
          </button>
        </div>
      </header>

      {failed && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">Impossible de charger les données. Actualisez dans un instant.</div>}

      {loading && !counts ? (
        <div className="py-16 text-center"><span className="text-gray-400">Chargement…</span></div>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${status.tone}`}>
            <span className="text-2xl" aria-hidden>{status.icon}</span>
            <div>
              <p className="text-lg font-bold">{status.title}</p>
              <p className="text-sm opacity-80">{status.sub}</p>
            </div>
          </div>

          {shown.length > 0 && (
            <ul className="space-y-2">
              {shown.map((problem) => (
                <li key={problem.key} className="rounded-2xl border border-gray-200 bg-surface">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[problem.severity]}`} />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="line-clamp-2 break-words text-sm font-semibold text-gray-900">{problem.feature} · {problem.cause}</p>
                      <p className="text-xs text-gray-500">{problem.count} fois · {problem.affectedUsers} client{problem.affectedUsers > 1 ? "s" : ""} · {timeAgo(problem.lastSeen)}</p>
                    </div>
                    <button type="button" onClick={() => setOpen(open === problem.key ? null : problem.key)} aria-expanded={open === problem.key} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      {open === problem.key ? "Masquer" : `Voir les ${problem.count} occurrence${problem.count > 1 ? "s" : ""}`} <span aria-hidden>{open === problem.key ? "▲" : "▼"}</span>
                    </button>
                    <button type="button" disabled={busy === problem.key} onClick={() => resolve(problem)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                      {busy === problem.key ? "…" : "Résolu"}
                    </button>
                  </div>
                  {open === problem.key && (
                    <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-sm">
                      <p><span className="font-semibold text-gray-900">Que faire : </span><span className="text-gray-700">{problem.fix}</span></p>
                      {problem.clientMessage && <p className="break-words"><span className="font-semibold text-gray-900">Ce que le client a lu : </span><span className="text-gray-700">{problem.clientMessage}</span></p>}
                      <Occurrences problemKey={problem.key} period={period} source={source} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {toTreat.length > MAX_CARDS && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-gray-600 hover:underline">
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

          {health && (
            <section className="rounded-2xl border border-gray-200 bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Santé des services</p>
                <Link href="/admin/moteurs" className="text-xs text-gray-500 hover:text-gray-900 hover:underline">Moteurs IA →</Link>
              </div>
              {paused.length === 0 && greyed.length === 0 && dryEngines.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Tous les services sont ouverts et chaque modèle a un moteur disponible.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {paused.map((s) => <li key={s.id} className="text-amber-800 dark:text-amber-300">« {s.label} » en pause depuis {timeAgo(s.outage!.since)} ({s.outage!.auto ? "sonde, levée automatiquement" : "posée à la main"})</li>)}
                  {greyed.map((name) => <li key={name} className="text-red-700 dark:text-red-300">{name} : aucun moteur disponible, grisé pour les clients</li>)}
                  {dryEngines.map((e) => <li key={e.id} className="text-red-700 dark:text-red-300">Moteur {e.codename} à sec ou refusé</li>)}
                </ul>
              )}
            </section>
          )}

          <section className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-3 text-sm">
            {SOURCES.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setSource(id)} className={`pb-1 ${source === id ? "border-b-2 border-gray-900 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{label}</button>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

// Journal d'un seul problème, déplié sous sa carte : qui, quand, où, et le détail technique au clic.
function Occurrences({ problemKey, period, source }: { problemKey: string; period: string; source: string }) {
  const [logs, setLogs] = useState<Occurrence[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period, source, problem: problemKey });
    fetch(`/api/admin/errors?${params}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success) throw new Error();
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [problemKey, period, source]);

  if (failed) return <p className="text-sm text-red-600 dark:text-red-300">Impossible de charger les occurrences.</p>;
  if (!logs) return <p className="py-2 text-center text-xs text-gray-400">Chargement des occurrences…</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <ul className="divide-y divide-gray-100">
        {logs.map((log) => (
          <li key={log.id}>
            <button type="button" onClick={() => setOpen(open === log.id ? null : log.id)} aria-expanded={open === log.id}
              className="grid w-full grid-cols-1 gap-1 px-3 py-2.5 text-left text-xs hover:bg-gray-50 sm:grid-cols-[auto_auto_1fr_auto] sm:items-start sm:gap-3">
              <span className="whitespace-nowrap text-gray-500">{formatDate(log.created_at)}</span>
              <span className="font-mono font-bold text-gray-900">{log.reference}</span>
              <span className="min-w-0">
                <span className="block truncate text-gray-900">{log.error_message || log.action}</span>
                <span className="block truncate text-gray-400">{SOURCE_LABELS[log.source] || log.source}{log.page ? ` · ${log.page}` : ""}{log.http_status ? ` · HTTP ${log.http_status}` : ""}</span>
              </span>
              {log.user_id ? (
                <Link href={`/admin/customers/${log.user_id}`} onClick={(e) => e.stopPropagation()} className="max-w-[200px] truncate text-gray-700 underline-offset-2 hover:underline">{log.user_email || log.user_id.slice(0, 8)}</Link>
              ) : <span className="text-gray-400">Anonyme</span>}
            </button>
            {open === log.id && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 bg-gray-50 px-3 py-3 text-xs md:grid-cols-2">
                <Detail label="Action" value={log.action} />
                <Detail label="Page" value={log.page} />
                <Detail label="Message technique brut" value={log.error_message} wide />
                <Detail label="Navigateur" value={log.user_agent} wide />
                <Detail label="Détails techniques" value={log.details && Object.keys(log.details).length ? JSON.stringify(log.details, null, 2) : null} wide pre />
              </dl>
            )}
          </li>
        ))}
      </ul>
      {total > logs.length && <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">{logs.length} plus récentes sur {total.toLocaleString("fr-FR")}.</p>}
    </div>
  );
}

function Detail({ label, value, wide, pre }: { label: string; value: string | null; wide?: boolean; pre?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="font-semibold text-gray-700">{label}</dt>
      <dd className={`mt-0.5 break-words text-gray-600 ${pre ? "max-h-64 overflow-auto whitespace-pre-wrap font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
