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
    ? await supabase.from("attend_triggers").select("id, item_id, display_type").in("item_id", itemIds)
    : { data: [] as Pick<AttendTrigger, "id" | "item_id" | "display_type">[] };

  // 一覧で「このURLは何で発火するのか(NFC/GPS/画像認識/マーカー)」が一目で分かるよう、
  // 発火条件の件数だけでなく種類も渡す。
  const typesByItem = new Map<string, string[]>();
  for (const t of (triggers as { id: string; item_id: string; display_type: string }[] | null) ?? []) {
    const list = typesByItem.get(t.item_id) ?? [];
    list.push(t.display_type);
    typesByItem.set(t.item_id, list);
  }

  const itemsWithCount: AttendItemWithTriggerCount[] = itemList.map((i) => ({
    ...i,
    trigger_count: (typesByItem.get(i.id) ?? []).length,
    trigger_types: typesByItem.get(i.id) ?? [],
  }));

  return <AttendProjectEditor project={project as AttendProject} items={itemsWithCount} />;
}
