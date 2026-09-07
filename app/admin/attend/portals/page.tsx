import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_TEMPLATES } from "@/lib/portal/types";
import type { AttendPortal, AttendProject } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  ended: "提供終了",
};
const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-100 text-emerald-700",
  ended: "bg-amber-100 text-amber-700",
};

export default async function AttendPortalsPage() {
  const supabase = createClient();
  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";

  const { data: portals, error } = await supabase
    .from("attend_portals")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (portals as AttendPortal[] | null) ?? [];
  const projectIds = Array.from(new Set(list.map((p) => p.project_id)));
  const { data: projects } = projectIds.length
    ? await supabase.from("attend_projects").select("id, client_name").in("id", projectIds)
    : { data: [] as Pick<AttendProject, "id" | "client_name">[] };
  const projectName = new Map(
    ((projects as Pick<AttendProject, "id" | "client_name">[] | null) ?? []).map((p) => [
      p.id,
      p.client_name,
    ])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">受け皿サイト一覧</h1>
        <p className="text-xs text-slate-500 mt-1">
          スタンプラリーの入口になる1枚もののサイトです。こちらでホスティングしているので、
          公開後の修正も提供終了もこの画面から行えます。新規作成は案件の画面から。
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">名前</th>
              <th className="px-4 py-2">案件</th>
              <th className="px-4 py-2">テンプレート</th>
              <th className="px-4 py-2">公開URL</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/attend/portals/${p.id}`} className="text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{projectName.get(p.project_id) ?? "-"}</td>
                <td className="px-4 py-2">
                  {PORTAL_TEMPLATES.find((t) => t.value === p.template)?.label ?? p.template}
                </td>
                <td className="px-4 py-2">
                  <code className="text-xs break-all">{`${siteOrigin}/p/${p.hash}`}</code>
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColor[p.status]}`}>
                    {statusLabel[p.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/attend/portals/${p.id}`} className="text-blue-600 hover:underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  受け皿サイトがまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
