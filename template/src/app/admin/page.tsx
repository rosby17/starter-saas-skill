import Link from "next/link";
import { serviceClient } from "@/lib/auth/service-client";
import { Badge } from "@/components/ui/card";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export default async function AdminOverviewPage() {
  // Le layout a déjà vérifié le rôle administrateur.
  const db = serviceClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ count: customers }, { data: monthOrders }, { count: pending }, { count: newRequests }, { data: recent }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("orders").select("amount_fcfa, paid_amount_fcfa").eq("status", "success").eq("is_test", false).gte("created_at", monthStart),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").eq("is_test", false),
    db.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
    db.from("orders").select("id, plan_name, amount_local, status, created_at, customer_name, customer_phone").eq("is_test", false).neq("status", "cancelled").order("created_at", { ascending: false }).limit(12),
  ]);
  // Montant réellement reçu (validation manuelle) sinon montant de la commande ; les tests ne comptent jamais.
  const revenue = (monthOrders ?? []).reduce((sum, o) => sum + Number(o.paid_amount_fcfa ?? o.amount_fcfa ?? 0), 0);

  const stats = [
    { label: "Ventes ce mois-ci", value: fcfa(revenue), sub: `${monthOrders?.length ?? 0} commande(s) payée(s)`, href: "/admin/orders?status=success" },
    { label: "Clients", value: String(customers ?? 0), sub: "Comptes créés", href: "/admin/customers" },
    { label: "Paiements en attente", value: String(pending ?? 0), sub: "Binance, paiements non finalisés", href: "/admin/orders?status=pending" },
    { label: "Nouvelles demandes", value: String(newRequests ?? 0), sub: "Accompagnements, devis, monétisation", href: "/admin/requests?status=nouvelle" },
  ];

  return (
    <main className="space-y-8 p-4 md:p-8">
      <h1 className="text-3xl">Vue d'ensemble</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-gray-200 bg-surface p-5 hover:border-brand">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-gray-500">{s.sub}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-xl">Dernières commandes</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="p-3">Date</th><th>Client</th><th>Produit</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>
              {(recent ?? []).map((o) => (
                <tr key={o.id} className="border-b border-gray-100">
                  <td className="p-3">{new Date(o.created_at).toLocaleString("fr-FR")}</td>
                  <td>{o.customer_name ?? "—"}<div className="text-xs text-gray-500">{o.customer_phone}</div></td>
                  <td>{o.plan_name}</td>
                  <td>{fcfa(Number(o.amount_local || 0))}</td>
                  <td><Badge tone={o.status === "success" ? "green" : o.status === "pending" ? "amber" : "gray"}>{o.status === "success" ? "Payée" : o.status === "pending" ? "En attente" : o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
