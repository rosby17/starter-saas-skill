import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: userCount }, { count: orderCount }, { data: recentOrders }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "success"),
    supabase.from("orders").select("id, plan_name, amount_local, currency, status, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-gray-200 rounded-2xl p-6">
          <p className="text-sm text-gray-500">Users</p>
          <p className="text-3xl font-bold mt-1">{userCount ?? "—"}</p>
        </div>
        <div className="border border-gray-200 rounded-2xl p-6">
          <p className="text-sm text-gray-500">Paid orders</p>
          <p className="text-3xl font-bold mt-1">{orderCount ?? "—"}</p>
        </div>
      </div>

      <h2 className="font-semibold mb-3">Recent orders</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2">Plan</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {(recentOrders || []).map((order) => (
            <tr key={order.id} className="border-b border-gray-100">
              <td className="py-2">{order.plan_name}</td>
              <td>{order.amount_local} {order.currency}</td>
              <td>{order.status}</td>
              <td>{new Date(order.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
