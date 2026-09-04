import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendProjectEditor from "@/components/AttendProjectEditor";
import type { AttendExperience, AttendProject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: project, error }, { data: experiences }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", params.id).single(),
    supabase
      .from("attend_experiences")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !project) {
    notFound();
  }

  return (
    <AttendProjectEditor
      project={project as AttendProject}
      experiences={(experiences as AttendExperience[]) ?? []}
    />
  );
}
