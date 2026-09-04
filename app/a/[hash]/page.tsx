import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AttendARViewer, { type ResolvedObject, type ResolvedTrigger } from "@/components/AttendARViewer";
import type { AttendItem, AttendTrigger, AttendTriggerObject, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendViewerPage({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("attend_items")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (!item) {
    notFound();
  }

  const i = item as AttendItem;

  const { data: triggers } = await supabase
    .from("attend_triggers")
    .select("*")
    .eq("item_id", i.id)
    .order("sort_order", { ascending: true });

  const triggerList = (triggers as AttendTrigger[]) ?? [];
  const triggerIds = triggerList.map((t) => t.id);

  const { data: objects } = triggerIds.length
    ? await supabase
        .from("attend_trigger_objects")
        .select("*")
        .in("trigger_id", triggerIds)
        .order("sort_order", { ascending: true })
    : { data: [] as AttendTriggerObject[] };

  const objectList = (objects as AttendTriggerObject[]) ?? [];

  const presetIds = Array.from(
    new Set(
      objectList
        .filter((o) => o.object_source === "preset" && o.preset_object_id)
        .map((o) => o.preset_object_id as string)
    )
  );
  const { data: presets } = presetIds.length
    ? await supabase.from("preset_objects").select("*").in("id", presetIds)
    : { data: [] as PresetObject[] };
  const presetMap = new Map(((presets as PresetObject[]) ?? []).map((p) => [p.id, p]));

  function resolveUrl(o: AttendTriggerObject): string | null {
    if (o.object_source === "upload") return o.custom_model_url;
    if (o.preset_object_id) return presetMap.get(o.preset_object_id)?.model_url ?? null;
    return null;
  }

  const resolvedTriggers: ResolvedTrigger[] = triggerList.map((t) => {
    const objs: ResolvedObject[] = objectList
      .filter((o) => o.trigger_id === t.id)
      .map((o) => {
        const url = resolveUrl(o);
        if (!url) return null;
        return {
          url,
          position: o.position || "0 0.6 0",
          scale: o.scale || null,
          rotationY: o.rotation_y || 0,
        };
      })
      .filter((x): x is ResolvedObject => !!x);

    return {
      id: t.id,
      label: t.label,
      displayType: t.display_type,
      markerUrl: t.marker_url,
      mindFileUrl: t.mind_file_url,
      faceAnchorIndex: t.face_anchor_index,
      gpsLat: t.gps_lat,
      gpsLng: t.gps_lng,
      objects: objs,
    };
  });

  return <AttendARViewer itemName={i.name} triggers={resolvedTriggers} />;
}
