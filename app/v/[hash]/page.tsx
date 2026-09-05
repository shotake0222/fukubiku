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

// URLの ?scale= で表示オブジェクトの大きさを一時的に上書きする。
// /sales のデモ作成画面から「サイズを変えて即座に見比べる」ために使う想定で、
// DBを書き換えないため商談中に安全に試せる。
// "0.5" のような単一の数値でも、"0.5 0.5 0.5" のような3軸指定でも受け付ける。
function normalizeScaleParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 1 && parts.length !== 3) return null;
  const nums = parts.map(Number);
  // 不正値・ゼロ・極端な値は無視する(URLを直接いじられても壊れないように)
  if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n > 100)) return null;
  return nums.length === 1 ? `${nums[0]} ${nums[0]} ${nums[0]}` : nums.join(" ");
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: { hash: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createAdminClient();
  const scaleOverride = normalizeScaleParam(searchParams?.scale);
  // ?rot=0 180 0 で向きを、?debug=1 で診断オーバーレイを有効にする。
  // どちらもDBを書き換えないので、実機で値を探るのに安全に使える。
  const rawRot = Array.isArray(searchParams?.rot) ? searchParams?.rot[0] : searchParams?.rot;
  const rotOverride = rawRot && /^[-\d\s.,]+$/.test(rawRot) ? rawRot.trim().replace(/,/g, " ") : null;
  const rawPos = Array.isArray(searchParams?.pos) ? searchParams?.pos[0] : searchParams?.pos;
  const posOverride = rawPos && /^[-\d\s.,]+$/.test(rawPos) ? rawPos.trim().replace(/,/g, " ") : null;
  const debug = (Array.isArray(searchParams?.debug) ? searchParams?.debug[0] : searchParams?.debug) === "1";

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
    let rotation: string | null = null;
    let position: string | null = null;
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
      rotation = p?.rotation ?? null;
      position = p?.position ?? null;
    }

    return (
      <ARViewer
        displayType={o.display_type}
        modelUrl={modelUrl}
        mindFileUrl={o.mind_file_url}
        category={category}
        scale={scaleOverride ?? scale}
        rotation={rotOverride ?? rotation}
        position={posOverride ?? position}
        debug={debug}
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
  let rotation: string | null = null;
  let position: string | null = null;
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
    rotation = p?.rotation ?? null;
    position = p?.position ?? null;
  }

  return (
    <ARViewer
      displayType={g.display_type}
      modelUrl={modelUrl}
      mindFileUrl={g.mind_file_url}
      category={category}
      scale={scaleOverride ?? scale}
      rotation={rotOverride ?? rotation}
      position={posOverride ?? position}
      debug={debug}
      hash={params.hash}
      cooldownHours={cooldownHours}
    />
  );
}
