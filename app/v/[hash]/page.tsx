import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ARViewer from "@/components/ARViewer";
import type { DrawGroup, DrawGroupEntry, Order, PresetObject } from "@/lib/types";
import {
  DRAW_COOLDOWN_HOURS,
  decodeDrawCookieValue,
  drawCookieName,
  getRemainingCooldownMs,
} from "@/lib/drawCooldown";

export const dynamic = "force-dynamic";

// 抽選セットのentriesから、weight(重み)に応じて1件をランダムに選ぶ。
// アクセスの都度この関数が呼ばれるため、管理画面での確率変更は次回アクセスから即座に反映される。
function pickWeighted(entries: DrawGroupEntry[]): DrawGroupEntry | null {
  const total = entries.reduce((sum, e) => sum + Number(e.weight), 0);
  if (total <= 0) return entries[0] ?? null;
  let r = Math.random() * total;
  for (const e of entries) {
    const w = Number(e.weight);
    if (r < w) return e;
    r -= w;
  }
  return entries[entries.length - 1];
}

export default async function ViewerPage({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (order) {
    const o = order as Order;

    let modelUrl: string | null = o.custom_model_url;
    let category: string | null = null;
    let scale: string | null = null;
    if (o.object_source === "preset" && o.preset_object_id) {
      const { data: preset } = await supabase
        .from("preset_objects")
        .select("*")
        .eq("id", o.preset_object_id)
        .single();
      const p = preset as PresetObject | null;
      modelUrl = p?.model_url ?? null;
      // 焦らし演出(結果が出るまでのプレースホルダー)をカテゴリ専用のものにするために使う。
      // カスタムアップロードのオブジェクト(fukubikuの固定カテゴリに属さない)ではnullのまま。
      category = p?.category ?? null;
      scale = p?.scale ?? null;
    }

    return (
      <ARViewer
        displayType={o.display_type}
        modelUrl={modelUrl}
        mindFileUrl={o.mind_file_url}
        category={category}
        scale={scale}
      />
    );
  }

  // ordersに見つからない場合、抽選セット(draw_groups)のハッシュとして解決を試みる。
  // 1つの共有URLに対して、アクセスの都度ここで確率抽選が行われる。
  const { data: group } = await supabase
    .from("draw_groups")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (!group) {
    notFound();
  }

  const g = group as DrawGroup;

  // 共有URLは誰でも何度でもアクセスできてしまうため、Cookieで前回の抽選時刻を確認し、
  // 一定時間以内の再アクセスでは再抽選せずに「時間をおいて再チャレンジ」の案内を表示する。
  const cookieName = drawCookieName(params.hash);
  const decoded = decodeDrawCookieValue(cookies().get(cookieName)?.value);
  const cooldownHours = g.cooldown_hours ?? DRAW_COOLDOWN_HOURS;
  const remainingCooldownMs = decoded ? getRemainingCooldownMs(decoded.drawnAtMs, cooldownHours) : 0;

  if (remainingCooldownMs > 0) {
    return (
      <ARViewer
        displayType={g.display_type}
        modelUrl={null}
        mindFileUrl={g.mind_file_url}
        category={null}
        blocked
        retryCategory={decoded?.category ?? null}
        remainingMs={remainingCooldownMs}
        cooldownHours={cooldownHours}
      />
    );
  }

  const { data: entries } = await supabase
    .from("draw_group_entries")
    .select("*")
    .eq("draw_group_id", g.id);

  const entryList = ((entries as DrawGroupEntry[]) ?? []).filter((e) => Number(e.weight) > 0);
  const chosen = pickWeighted(entryList);

  if (!chosen) {
    notFound();
  }

  let modelUrl: string | null = chosen.custom_model_url;
  let category: string | null = null;
  let scale: string | null = null;
  if (chosen.object_source === "preset" && chosen.preset_object_id) {
    const { data: preset } = await supabase
      .from("preset_objects")
      .select("*")
      .eq("id", chosen.preset_object_id)
      .single();
    const p = preset as PresetObject | null;
    modelUrl = p?.model_url ?? null;
    category = p?.category ?? null;
    scale = p?.scale ?? null;
  }

  return (
    <ARViewer
      displayType={g.display_type}
      modelUrl={modelUrl}
      mindFileUrl={g.mind_file_url}
      category={category}
      scale={scale}
      hash={params.hash}
      cooldownHours={cooldownHours}
    />
  );
}
