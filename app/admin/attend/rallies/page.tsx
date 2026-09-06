import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AttendProject, AttendRally } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "下書き",
  active: "公開中",
  archived: "アーカイブ",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-500",
};

export default async function AttendRalliesPage() {
  const supabase = createClient();
  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";

  const { data: rallies, error } = await supabase
    .from("attend_rallies")
    .select("*")
    .order("created_at", { ascending: false });

  const rallyList = (rallies as AttendRally[] | null) ?? [];
  const rallyIds = rallyList.map((r) => r.id);
  const projectIds = Array.from(new Set(rallyList.map((r) => r.project_id)));

  const [{ data: projects }, { data: spotRows }, { data: participantRows }, { data: linkRows }] = await Promise.all([
    projectIds.length
      ? supabase.from("attend_projects").select("id, client_name").in("id", projectIds)
      : Promise.resolve({ data: [] as Pick<AttendProject, "id" | "client_name">[] }),
    rallyIds.length
      ? supabase.from("attend_rally_spots").select("id, rally_id").in("rally_id", rallyIds)
      : Promise.resolve({ data: [] as { id: string; rally_id: string }[] }),
    rallyIds.length
      ? supabase.from("attend_rally_participants").select("id, rally_id").in("rally_id", rallyIds)
      : Promise.resolve({ data: [] as { id: string; rally_id: string }[] }),
    rallyIds.length
      ? supabase.from("attend_rally_links").select("id, rally_id, mode, enabled").in("rally_id", rallyIds)
      : Promise.resolve({ data: [] as { id: string; rally_id: string; mode: string; enabled: boolean }[] }),
  ]);

  const projectName = new Map(
    ((projects as Pick<AttendProject, "id" | "client_name">[] | null) ?? []).map((p) => [
      p.id,
      p.client_name,
    ])
  );

  function countBy(rows: { rally_id: string }[] | null): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.rally_id, (m.get(r.rally_id) ?? 0) + 1);
    return m;
  }
  const spotCount = countBy(spotRows as { rally_id: string }[] | null);
  const participantCount = countBy(participantRows as { rally_id: string }[] | null);

  // 発行済みURLの本数（配布用 / 埋め込み用）
  const links = (linkRows as { rally_id: string; mode: string; enabled: boolean }[] | null) ?? [];
  const linkSummary = new Map<string, { standalone: number; embed: number }>();
  for (const l of links) {
    if (!l.enabled) continue;
    const cur = linkSummary.get(l.rally_id) ?? { standalone: 0, embed: 0 };
    if (l.mode === "embed") cur.embed += 1;
    else cur.standalone += 1;
    linkSummary.set(l.rally_id, cur);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">スタンプラリー一覧</h1>
        <p className="text-xs text-slate-500 mt-1">
          新しいラリーは案件ごとに作ります。案件を開いて「+ ラリーを作成」を押してください
          （新規案件には最初から1本入っています）。
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">ラリー名</th>
              <th className="px-4 py-2">案件</th>
              <th className="px-4 py-2">スタンプ</th>
              <th className="px-4 py-2">参加者</th>
              <th className="px-4 py-2">発行URL</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rallyList.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/attend/rallies/${r.id}`} className="text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{projectName.get(r.project_id) ?? "-"}</td>
                <td className="px-4 py-2">{spotCount.get(r.id) ?? 0}個</td>
                <td className="px-4 py-2">{participantCount.get(r.id) ?? 0}人</td>
                <td className="px-4 py-2">
                  <span className="text-xs">
                    配布 {linkSummary.get(r.id)?.standalone ?? 0}本 / 埋め込み{" "}
                    {linkSummary.get(r.id)?.embed ?? 0}本
                  </span>
                  <code className="block text-[11px] text-slate-400 break-all">
                    {`${siteOrigin}/r/${r.hash}`}
                  </code>
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColor[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/attend/rallies/${r.id}`} className="text-blue-600 hover:underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {rallyList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  スタンプラリーがまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
