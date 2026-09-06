import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinPeriod, requiredCount, stampLabelFor } from "@/lib/rally";
import type { RallySpotView, RallyView } from "@/components/RallyApp";
import type {
  AttendRally,
  AttendRallyLink,
  AttendRallySpot,
  PresetObject,
} from "@/lib/types";

export interface LoadedRallyView {
  rally: RallyView;
  spots: RallySpotView[];
}

/**
 * 公開URL(配布用/埋め込み用)から参加者画面に渡すデータを組み立てる。
 * /r/[hash] と /embed/[hash] で同じ関数を使い、見た目の違いは
 * mode と theme だけで表すようにしている。
 */
export async function loadRallyView(hash: string): Promise<LoadedRallyView | null> {
  const supabase = createAdminClient();

  const { data: linkRow } = await supabase
    .from("attend_rally_links")
    .select("*")
    .eq("hash", hash)
    .maybeSingle();
  const link = (linkRow as AttendRallyLink | null) ?? null;
  if (link && !link.enabled) return null;

  const { data: rallyRow } = link
    ? await supabase.from("attend_rallies").select("*").eq("id", link.rally_id).maybeSingle()
    : await supabase.from("attend_rallies").select("*").eq("hash", hash).maybeSingle();
  if (!rallyRow) return null;
  const rally = rallyRow as AttendRally;

  const { data: spotRows } = await supabase
    .from("attend_rally_spots")
    .select("*")
    .eq("rally_id", rally.id)
    .order("sort_order", { ascending: true });
  const spots = (spotRows as AttendRallySpot[] | null) ?? [];

  // スポットと特典で使うプリセットのモデルURLをまとめて解決する。
  const presetIds = Array.from(
    new Set([
      ...spots
        .filter((s) => s.object_source === "preset" && s.preset_object_id)
        .map((s) => s.preset_object_id as string),
      ...(rally.reward_object_source === "preset" && rally.reward_preset_object_id
        ? [rally.reward_preset_object_id]
        : []),
    ])
  );
  const { data: presets } = presetIds.length
    ? await supabase.from("preset_objects").select("*").in("id", presetIds)
    : { data: [] as PresetObject[] };
  const presetMap = new Map(((presets as PresetObject[] | null) ?? []).map((p) => [p.id, p]));

  function modelUrlFor(
    source: string | null,
    presetId: string | null,
    customUrl: string | null
  ): string | null {
    if (source === "upload") return customUrl;
    if (presetId) return presetMap.get(presetId)?.model_url ?? null;
    return null;
  }

  const spotViews: RallySpotView[] = spots.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    gpsEnabled: s.gps_enabled && s.gps_lat != null && s.gps_lng != null,
    lat: s.gps_lat,
    lng: s.gps_lng,
    radiusM: s.gps_radius_m,
    codeEnabled: s.code_enabled && !!s.spot_code,
    modelUrl: modelUrlFor(s.object_source, s.preset_object_id, s.custom_model_url),
    position: s.position || "0 0 0",
    scale: s.scale,
    rotationY: s.rotation_y || 0,
    stampLabel: stampLabelFor(s),
    stampColor: s.stamp_color || "#c0392b",
  }));

  // 埋め込みから「フル画面で開く」ための配布用URL。
  // 配布用リンクがあればそれを、無ければラリー本体のハッシュを使う。
  const { data: standaloneRow } = await supabase
    .from("attend_rally_links")
    .select("hash")
    .eq("rally_id", rally.id)
    .eq("mode", "standalone")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const standaloneHash = (standaloneRow as { hash: string } | null)?.hash ?? rally.hash;

  const view: RallyView = {
    hash,
    standaloneHash,
    name: rally.name,
    description: rally.description,
    theme: link?.theme ?? rally.theme,
    mode: link?.mode ?? "standalone",
    compact: link?.compact ?? false,
    totalCount: spots.length,
    requiredCount: requiredCount(rally, spots.length),
    active: rally.status === "active" && isWithinPeriod(rally),
    statusReason:
      rally.status !== "active"
        ? "このスタンプラリーはまだ公開されていません。"
        : !isWithinPeriod(rally)
          ? "このスタンプラリーは開催期間外です。"
          : null,
    endsAt: rally.ends_at,
    couponEnabled: rally.reward_coupon_enabled,
    couponLabel: rally.reward_coupon_label,
    couponNote: rally.reward_coupon_note,
    rewardModelUrl: modelUrlFor(
      rally.reward_object_source,
      rally.reward_preset_object_id,
      rally.reward_custom_model_url
    ),
    rewardMessage: rally.reward_message,
  };

  return { rally: view, spots: spotViews };
}

/** タイトル・説明だけを引く（metadata用の軽い問い合わせ）。 */
export async function loadRallyMeta(hash: string) {
  const supabase = createAdminClient();
  const { data: link } = await supabase
    .from("attend_rally_links")
    .select("rally_id")
    .eq("hash", hash)
    .maybeSingle();
  const { data } = link
    ? await supabase
        .from("attend_rallies")
        .select("name, description")
        .eq("id", (link as { rally_id: string }).rally_id)
        .maybeSingle()
    : await supabase
        .from("attend_rallies")
        .select("name, description")
        .eq("hash", hash)
        .maybeSingle();
  return (data as { name: string; description: string | null } | null) ?? null;
}
