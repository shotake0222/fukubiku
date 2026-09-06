import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendRallyEditor, { type RallySpotStat } from "@/components/AttendRallyEditor";
import type {
  AttendProject,
  AttendRally,
  AttendRallyLink,
  AttendRallySpot,
  PresetObject,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendRallyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: rallyRow, error } = await supabase
    .from("attend_rallies")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !rallyRow) notFound();
  const rally = rallyRow as AttendRally;

  const [{ data: project }, { data: presets }, { data: spotRows }, { data: linkRows }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", rally.project_id).single(),
    supabase
      .from("preset_objects")
      .select("*")
      .eq("service", "attend")
      .order("created_at", { ascending: false }),
    supabase
      .from("attend_rally_spots")
      .select("*")
      .eq("rally_id", rally.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("attend_rally_links")
      .select("*")
      .eq("rally_id", rally.id)
      .order("created_at", { ascending: true }),
  ]);

  const spots = (spotRows as AttendRallySpot[] | null) ?? [];

  // 参加状況。件数だけ分かれば十分なのでカウントクエリで取る。
  const [{ count: participantCount }, { count: rewardCount }, { count: redeemedCount }] =
    await Promise.all([
      supabase
        .from("attend_rally_participants")
        .select("id", { count: "exact", head: true })
        .eq("rally_id", rally.id),
      supabase
        .from("attend_rally_rewards")
        .select("id", { count: "exact", head: true })
        .eq("rally_id", rally.id),
      supabase
        .from("attend_rally_rewards")
        .select("id", { count: "exact", head: true })
        .eq("rally_id", rally.id)
        .not("redeemed_at", "is", null),
    ]);

  // スポットごとの取得数。行数はスタンプ総数ぶんなので、件数が増えたら
  // 集計ビューに置き換える前提で、まずは素直に集計する。
  const spotIds = spots.map((s) => s.id);
  const { data: stampRows } = spotIds.length
    ? await supabase.from("attend_rally_stamps").select("spot_id, method").in("spot_id", spotIds)
    : { data: [] as { spot_id: string; method: string }[] };

  const stats = new Map<string, RallySpotStat>();
  for (const s of spots) stats.set(s.id, { total: 0, byMethod: {} });
  for (const row of ((stampRows as { spot_id: string; method: string }[] | null) ?? [])) {
    const stat = stats.get(row.spot_id);
    if (!stat) continue;
    stat.total += 1;
    stat.byMethod[row.method] = (stat.byMethod[row.method] ?? 0) + 1;
  }

  return (
    <AttendRallyEditor
      rally={rally}
      project={project as AttendProject}
      spots={spots}
      presets={(presets as PresetObject[]) ?? []}
      links={(linkRows as AttendRallyLink[] | null) ?? []}
      spotStats={Object.fromEntries(stats)}
      summary={{
        participants: participantCount ?? 0,
        completed: rewardCount ?? 0,
        redeemed: redeemedCount ?? 0,
      }}
    />
  );
}
