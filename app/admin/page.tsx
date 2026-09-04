import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "下書き",
  compiling: "コンパイル中",
  ready: "公開準備完了",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  compiling: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
};

export default async function AdminOrdersPage() {
  const supabase = createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">注文一覧</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/orders/bulk"
            className="bg-white border text-sm rounded-lg px-4 py-2 hover:bg-slate-50"
          >
            景品セット一括作成
          </Link>
          <Link
            href="/admin/orders/new"
            className="bg-slate-900 text-white text-sm rounded-lg px-4 py-2"
          >
            + 新規注文
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">クライアント名</th>
              <th className="px-4 py-2">景品名</th>
              <th className="px-4 py-2">個数</th>
              <th className="px-4 py-2">注文日</th>
              <th className="px-4 py-2">納期</th>
              <th className="px-4 py-2">延長確認日</th>
              <th className="px-4 py-2">表示方式</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">提供URL</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(orders as Order[] | null)?.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-2 font-medium">{order.client_name}</td>
                <td className="px-4 py-2">{order.prize_label || "-"}</td>
                <td className="px-4 py-2">{order.quantity ?? "-"}</td>
                <td className="px-4 py-2">{order.order_date}</td>
                <td className="px-4 py-2">{order.due_date || "-"}</td>
                <td className="px-4 py-2">{order.renewal_check_date || "-"}</td>
                <td className="px-4 py-2 uppercase">{order.display_type}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${statusColor[order.status]}`}
                  >
                    {statusLabel[order.status]}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {order.status === "ready" ? (
                    <code className="text-xs">{`${siteOrigin}/v/${order.hash}`}</code>
                  ) : (
                    <span className="text-xs text-slate-400">未発行</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {orders && orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  注文がまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
