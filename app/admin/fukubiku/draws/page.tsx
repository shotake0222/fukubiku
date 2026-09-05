import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { DrawGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "下書き",
  ready: "公開準備完了",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-emerald-100 text-emerald-700",
};

export default async function DrawGroupsPage() {
  const supabase = createClient();
  const { data: groups, error } = await supabase
    .from("draw_groups")
    .select("*")
    .order("created_at", { ascending: false });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">確率抽選セット一覧</h1>
          <p className="text-sm text-slate-500">
            1つの共有URLに対してアクセスの都度サーバーが確率抽選する景品セット。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/fukubiku/draws/new"
            className="bg-slate-900 text-white text-sm rounded-lg px-4 py-2"
          >
            + 抽選セットを作成
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">クライアント名</th>
              <th className="px-4 py-2">注文日</th>
              <th className="px-4 py-2">納期</th>
              <th className="px-4 py-2">表示方式</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">共有URL</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(groups as DrawGroup[] | null)?.map((group) => (
              <tr key={group.id}>
                <td className="px-4 py-2 font-medium">{group.client_name}</td>
                <td className="px-4 py-2">{group.order_date}</td>
                <td className="px-4 py-2">{group.due_date || "-"}</td>
                <td className="px-4 py-2 uppercase">{group.display_type}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColor[group.status]}`}>
                    {statusLabel[group.status]}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {group.status === "ready" ? (
                    <code className="text-xs">{`${siteOrigin}/v/${group.hash}`}</code>
                  ) : (
                    <span className="text-xs text-slate-400">未発行</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/fukubiku/draws/${group.id}`} className="text-blue-600 hover:underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {groups && groups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  抽選セットがまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
