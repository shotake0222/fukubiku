import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendProjectEditor, { type AttendItemWithTriggerCount } from "@/components/AttendProjectEditor";
import type { AttendItem, AttendProject, AttendTrigger } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: project, error }, { data: items }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", params.id).single(),
    supabase
      .from("attend_items")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !project) {
    notFound();
  }

  const itemList = (items as AttendItem[]) ?? [];
  const itemIds = itemList.map((i) => i.id);

  const { data: triggers } = itemIds.length
    ? await supabase.from("attend_triggers").select("id, item_id").in("item_id", itemIds)
    : { data: [] as Pick<AttendTrigger, "id" | "item_id">[] };

  const countByItem = new Map<string, number>();
  for (const t of (triggers as { id: string; item_id: string }[] | null) ?? []) {
    countByItem.set(t.item_id, (countByItem.get(t.item_id) ?? 0) + 1);
  }

  const itemsWithCount: AttendItemWithTriggerCount[] = itemList.map((i) => ({
    ...i,
    trigger_count: countByItem.get(i.id) ?? 0,
  }));

  return <AttendProjectEditor project={project as AttendProject} items={itemsWithCount} />;
}
