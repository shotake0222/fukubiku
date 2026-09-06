import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AttendProject } from "@/lib/types";
import { ATTEND_PLAN_LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "下書き",
  active: "運用中",
  archived: "アーカイブ",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-500",
};

export default async function AttendProjectsPage() {
  const supabase = createClient();
  const { data: projects, error } = await supabase
    .from("attend_projects")
    .select("*")
    .order("created_at", { ascending: false });

  // 「URLはどこで作るのか」が一覧から分かるよう、案件ごとの発行URL数を出す。
  const projectList = (projects as AttendProject[] | null) ?? [];
  const { data: items } = projectList.length
    ? await supabase
        .from("attend_items")
        .select("id, project_id")
        .in(
          "project_id",
          projectList.map((p) => p.id)
        )
    : { data: [] as { id: string; project_id: string }[] };

  const urlCount = new Map<string, number>();
  for (const it of (items as { id: string; project_id: string }[] | null) ?? []) {
    urlCount.set(it.project_id, (urlCount.get(it.project_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">案件一覧</h1>
        <Link
          href="/admin/attend/projects/new"
          className="bg-slate-900 text-white text-sm rounded-lg px-4 py-2"
        >
          + 新規案件
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">クライアント名</th>
              <th className="px-4 py-2">プラン</th>
              <th className="px-4 py-2">発行URL</th>
              <th className="px-4 py-2">NFCタグ進捗</th>
              <th className="px-4 py-2">納期</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projectList.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium">{p.client_name}</td>
                <td className="px-4 py-2">{ATTEND_PLAN_LIMITS[p.plan].label}</td>
                <td className="px-4 py-2">{urlCount.get(p.id) ?? 0}本</td>
                <td className="px-4 py-2">
                  {p.nfc_tag_total ? `${p.nfc_tag_used} / ${p.nfc_tag_total}` : "-"}
                </td>
                <td className="px-4 py-2">{p.due_date || "-"}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColor[p.status]}`}>
                    {statusLabel[p.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/attend/projects/${p.id}`} className="text-blue-600 hover:underline">
                    URLと発火条件を管理
                  </Link>
                </td>
              </tr>
            ))}
            {projectList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  案件がまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
