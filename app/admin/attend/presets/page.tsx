import { createClient } from "@/lib/supabase/server";
import PresetManager from "@/components/PresetManager";
import type { PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendPresetsPage() {
  const supabase = createClient();
  const { data: presets } = await supabase
    .from("preset_objects")
    .select("*")
    .eq("service", "attend")
    .order("created_at", { ascending: false });

  return (
    <PresetManager initialPresets={(presets as PresetObject[]) ?? []} service="attend" serviceLabel="あてんど" />
  );
}
