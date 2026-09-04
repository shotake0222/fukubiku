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
  if (o.object_source === "preset" && o.preset_object_id) {
    const { data: preset } = await supabase
      .from("preset_objects")
      .select("*")
      .eq("id", o.preset_object_id)
      .single();
    modelUrl = (preset as PresetObject | null)?.model_url ?? null;
  }

  return (
    <ARViewer displayType={o.display_type} modelUrl={modelUrl} mindFileUrl={o.mind_file_url} />
  );
}
