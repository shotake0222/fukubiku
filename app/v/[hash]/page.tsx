import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ARViewer from "@/components/ARViewer";
import type { Order, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ViewerPage({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (!order) {
    notFound();
  }

  const o = order as Order;

  let modelUrl: string | null = o.custom_model_url;
  let category: string | null = null;
  if (o.object_source === "preset" && o.preset_object_id) {
    const { data: preset } = await supabase
      .from("preset_objects")
      .select("*")
      .eq("id", o.preset_object_id)
      .single();
    const p = preset as PresetObject | null;
    modelUrl = p?.model_url ?? null;
    // 焦らし演出(結果が出るまでのプレースホルダー)をカテゴリ専用のものにするために使う。
    // カスタムアップロードのオブジェクト(fukubikuの固定6カテゴリに属さない)ではnullのまま。
    category = p?.category ?? null;
  }

  return (
    <ARViewer
      displayType={o.display_type}
      modelUrl={modelUrl}
      mindFileUrl={o.mind_file_url}
      category={category}
    />
  );
}
