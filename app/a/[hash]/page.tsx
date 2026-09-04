import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AttendARViewer, { type ResolvedObject, type ResolvedTrigger } from "@/components/AttendARViewer";
import type { AttendItem, AttendMarkerImage, AttendTrigger, AttendTriggerObject, PresetObject } from "@/lib/types";

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

  const markerIds = Array.from(
    new Set(triggerList.filter((t) => t.marker_id).map((t) => t.marker_id as string))
  );
  const { data: markerImages } = markerIds.length
    ? await supabase
        .from("attend_marker_images")
        .select("*")
        .in("marker_id", markerIds)
        .order("target_index", { ascending: true })
    : { data: [] as AttendMarkerImage[] };

  const markerImageIndicesMap = new Map<string, number[]>();
  for (const mi of (markerImages as AttendMarkerImage[]) ?? []) {
    const list = markerImageIndicesMap.get(mi.marker_id) ?? [];
    list.push(mi.target_index);
    markerImageIndicesMap.set(mi.marker_id, list);
  }

  function resolveUrl(o: AttendTriggerObject): string | null {
    if (o.object_source === "upload") return o.custom_model_url;
    if (o.preset_object_id) return presetMap.get(o.preset_object_id)?.model_url ?? null;
    return null;
  }

  const resolvedTriggers: ResolvedTrigger[] = triggerList.map((t) => {
    const objsForTrigger = objectList.filter((o) => o.trigger_id === t.id);

    const objs: ResolvedObject[] = objsForTrigger
      .map((o) => {
        const url = resolveUrl(o);
        if (!url) return null;
        return {
          url,
          position: o.position || "0 0.6 0",
          scale: o.scale || null,
          rotationY: o.rotation_y || 0,
          targetIndex: o.target_index ?? null,
        };
      })
      .filter((x): x is ResolvedObject => !!x);

    // このトリガーで検出対象とする画像のtargetIndex一覧を決定する。
    // 1. マーカーライブラリに登録済みの画像があればその一覧を使う(複数画像を同時検出)
    // 2. なければオブジェクト側で個別に指定されたtargetIndexの一覧を使う
    // 3. どちらもなければ従来通り単一画像(index 0)として扱う
    const fromMarker = t.marker_id ? markerImageIndicesMap.get(t.marker_id) : undefined;
    const fromObjects = Array.from(
      new Set(objsForTrigger.map((o) => o.target_index).filter((v): v is number => v != null))
    );
    const targetImageIndices =
      fromMarker && fromMarker.length > 0
        ? fromMarker
        : fromObjects.length > 0
          ? fromObjects.sort((a, b) => a - b)
          : [0];

    return {
      id: t.id,
      label: t.label,
      displayType: t.display_type,
      markerUrl: t.marker_url,
      mindFileUrl: t.mind_file_url,
      faceAnchorIndex: t.face_anchor_index,
      gpsLat: t.gps_lat,
      gpsLng: t.gps_lng,
      targetImageIndices,
      objects: objs,
    };
  });

  return <AttendARViewer itemName={i.name} triggers={resolvedTriggers} />;
}
