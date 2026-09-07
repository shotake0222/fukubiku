import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendPortalEditor from "@/components/AttendPortalEditor";
import type { AttendPortal, AttendPortalBlock, AttendProject, AttendRally } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendPortalPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: row, error } = await supabase
    .from("attend_portals")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !row) notFound();
  const portal = row as AttendPortal;

  const [{ data: project }, { data: blocks }, { data: rallies }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", portal.project_id).single(),
    supabase
      .from("attend_portal_blocks")
      .select("*")
      .eq("portal_id", portal.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("attend_rallies")
      .select("id, name")
      .eq("project_id", portal.project_id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <AttendPortalEditor
      portal={portal}
      project={project as AttendProject}
      blocks={(blocks as AttendPortalBlock[] | null) ?? []}
      rallies={(rallies as Pick<AttendRally, "id" | "name">[] | null) ?? []}
    />
  );
}
