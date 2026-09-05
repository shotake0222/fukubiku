import { createClient } from "@/lib/supabase/server";
import DrawGroupCreator from "@/components/DrawGroupCreator";
import type { PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewDrawGroupPage() {
  const supabase = createClient();
  const { data: presets } = await supabase
    .from("preset_objects")
    .select("*")
    .eq("service", "fukubiku")
    .order("created_at", { ascending: false });

  return <DrawGroupCreator presets={(presets as PresetObject[]) ?? []} />;
}
