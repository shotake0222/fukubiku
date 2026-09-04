import { createClient } from "@/lib/supabase/server";
import AttendMarkerManager from "@/components/AttendMarkerManager";
import type { AttendMarker, AttendMarkerImage, AttendMarkerWithProject, AttendProject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendMarkersPage() {
  const supabase = createClient();

  const [{ data: markers }, { data: projects }] = await Promise.all([
    supabase.from("attend_markers").select("*").order("created_at", { ascending: false }),
    supabase.from("attend_projects").select("*").order("created_at", { ascending: false }),
  ]);

  const markerList = (markers as AttendMarker[]) ?? [];
  const markerIds = markerList.map((m) => m.id);

  const { data: images } = markerIds.length
    ? await supabase
        .from("attend_marker_images")
        .select("*")
        .in("marker_id", markerIds)
        .order("target_index", { ascending: true })
    : { data: [] as AttendMarkerImage[] };

  const imageList = (images as AttendMarkerImage[]) ?? [];

  const projectList = (projects as AttendProject[]) ?? [];
  const projectNameById = new Map(projectList.map((p) => [p.id, p.client_name]));

  const markersWithProject: AttendMarkerWithProject[] = markerList.map((m) => ({
    ...m,
    images: imageList.filter((im) => im.marker_id === m.id),
    project_name: projectNameById.get(m.project_id) ?? "(不明な案件)",
  }));

  return <AttendMarkerManager initialMarkers={markersWithProject} projects={projectList} />;
}
