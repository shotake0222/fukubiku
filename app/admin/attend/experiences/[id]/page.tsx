import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttendExperienceEditor from "@/components/AttendExperienceEditor";
import type { AttendExperience, AttendProject, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendExperiencePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: experience, error } = await supabase
    .from("attend_experiences")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !experience) {
    notFound();
  }

  const [{ data: project }, { data: presets }] = await Promise.all([
    supabase.from("attend_projects").select("*").eq("id", (experience as AttendExperience).project_id).single(),
    supabase
      .from("preset_objects")
      .select("*")
      .or("service.eq.attend,service.is.null")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AttendExperienceEditor
      experience={experience as AttendExperience}
      project={project as AttendProject}
      presets={(presets as PresetObject[]) ?? []}
    />
  );
}
