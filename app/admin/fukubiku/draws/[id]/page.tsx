import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DrawGroupEditor from "@/components/DrawGroupEditor";
import type { DrawGroup, DrawGroupEntry, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DrawGroupEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: group, error }, { data: entries }, { data: presets }] = await Promise.all([
    supabase.from("draw_groups").select("*").eq("id", params.id).single(),
    supabase
      .from("draw_group_entries")
      .select("*")
      .eq("draw_group_id", params.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("preset_objects")
      .select("*")
      .eq("service", "fukubiku")
      .order("created_at", { ascending: false }),
  ]);

  if (error || !group) {
    notFound();
  }

  return (
    <DrawGroupEditor
      group={group as DrawGroup}
      entries={(entries as DrawGroupEntry[]) ?? []}
      presets={(presets as PresetObject[]) ?? []}
    />
  );
}
