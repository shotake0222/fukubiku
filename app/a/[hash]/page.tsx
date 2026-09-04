import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AttendARViewer from "@/components/AttendARViewer";
import type { AttendExperience, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendViewerPage({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();

  const { data: experience } = await supabase
    .from("attend_experiences")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (!experience) {
    notFound();
  }

  const e = experience as AttendExperience;

  let modelUrl: string | null = e.custom_model_url;
  if (e.object_source === "preset" && e.preset_object_id) {
    const { data: preset } = await supabase
      .from("preset_objects")
      .select("*")
      .eq("id", e.preset_object_id)
      .single();
    modelUrl = (preset as PresetObject | null)?.model_url ?? null;
  }

  return (
    <AttendARViewer
      displayType={e.display_type}
      modelUrl={modelUrl}
      mindFileUrl={e.mind_file_url}
      markerUrl={e.marker_url}
      faceAnchorIndex={e.face_anchor_index}
      gpsLat={e.gps_lat}
      gpsLng={e.gps_lng}
    />
  );
}
