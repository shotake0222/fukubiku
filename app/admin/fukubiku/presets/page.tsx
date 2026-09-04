import { createClient } from "@/lib/supabase/server";
import PresetManager from "@/components/PresetManager";
import { PRESET_CATEGORIES, type PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FukubikuPresetsPage() {
  const supabase = createClient();
  const { data: presets } = await supabase
    .from("preset_objects")
    .select("*")
    .eq("service", "fukubiku")
    .order("created_at", { ascending: false });

  return (
    <PresetManager
      initialPresets={(presets as PresetObject[]) ?? []}
      service="fukubiku"
      serviceLabel="fukubiku"
      fixedCategories={PRESET_CATEGORIES}
    />
  );
}
