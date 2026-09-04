import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendItemEditor from "@/components/AttendItemEditor";
import type {
  AttendItem,
  AttendProject,
  AttendTrigger,
  AttendTriggerObject,
  AttendTriggerWithObjects,
  PresetObject,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendItemPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: item, error } = await supabase
    .from("attend_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !item) {
    notFound();
  }

  const i = item as AttendItem;

  const [{ data: project }, { data: presets }, { data: triggers }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", i.project_id).single(),
    supabase
      .from("preset_objects")
      .select("*")
      .eq("service", "attend")
      .order("created_at", { ascending: false }),
    supabase
      .from("attend_triggers")
      .select("*")
      .eq("item_id", i.id)
      .order("sort_order", { ascending: true }),
  ]);

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
  const triggersWithObjects: AttendTriggerWithObjects[] = triggerList.map((t) => ({
    ...t,
    objects: objectList.filter((o) => o.trigger_id === t.id),
  }));

  return (
    <AttendItemEditor
      item={i}
      project={project as AttendProject}
      triggers={triggersWithObjects}
      presets={(presets as PresetObject[]) ?? []}
    />
  );
}
