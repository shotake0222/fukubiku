import type { SupabaseClient } from "@supabase/supabase-js";
import { generateHash } from "@/lib/hash";
import { generateSpotCode } from "@/lib/rally";

/**
 * 新しい案件には、最初からスタンプラリーが1本入っている状態にする。
 * 「あてんど＝行った場所でスタンプが貯まる」を標準機能として使えるようにするため、
 * 空の器ではなく、3スポットの雛形と記念特典まで作ってから渡す。
 */

// 雛形が使うデモオブジェクト（seed_attend_demo_objects.sql で登録されるもの）。
// 見つからない場合はオブジェクト未設定のまま作る（スタンプ自体は機能する）。
const DEFAULT_SPOT_MODELS = [
  "/presets/attend/torii_3d.glb",
  "/presets/attend/pagoda_3d.glb",
  "/presets/attend/castle_3d.glb",
];
const DEFAULT_REWARD_MODEL = "/presets/attend/stamp_3d.glb";

const DEFAULT_SPOT_NAMES = ["スポット1", "スポット2", "スポット3"];
const DEFAULT_STAMP_COLORS = ["#b03a2e", "#1f6f78", "#8a6d1f"];

export async function createDefaultRally(
  supabase: SupabaseClient,
  projectId: string,
  clientName: string
): Promise<{ id: string; hash: string } | null> {
  const modelUrls = [...DEFAULT_SPOT_MODELS, DEFAULT_REWARD_MODEL];
  const { data: presets } = await supabase
    .from("preset_objects")
    .select("id, model_url")
    .eq("service", "attend")
    .in("model_url", modelUrls);

  const presetByUrl = new Map(
    ((presets as { id: string; model_url: string }[] | null) ?? []).map((p) => [p.model_url, p.id])
  );
  const rewardPresetId = presetByUrl.get(DEFAULT_REWARD_MODEL) ?? null;

  const { data: rally, error } = await supabase
    .from("attend_rallies")
    .insert({
      project_id: projectId,
      name: `${clientName} スタンプラリー`,
      hash: generateHash(),
      description: "スポットをめぐってスタンプを集めよう。すべて集めると記念品と交換できます。",
      status: "draft",
      theme: "washi",
      reward_coupon_enabled: true,
      reward_coupon_label: "記念品引換",
      reward_object_source: rewardPresetId ? "preset" : null,
      reward_preset_object_id: rewardPresetId,
    })
    .select("id, hash")
    .single();

  if (error || !rally) return null;
  const created = rally as { id: string; hash: string };

  const spots = DEFAULT_SPOT_NAMES.map((name, i) => {
    const presetId = presetByUrl.get(DEFAULT_SPOT_MODELS[i]) ?? null;
    return {
      rally_id: created.id,
      name,
      sort_order: i,
      gps_enabled: true,
      gps_radius_m: 30,
      spot_code: generateSpotCode(),
      code_enabled: true,
      object_source: "preset",
      preset_object_id: presetId,
      stamp_color: DEFAULT_STAMP_COLORS[i] ?? "#c0392b",
    };
  });

  await supabase.from("attend_rally_spots").insert(spots);
  return created;
}
