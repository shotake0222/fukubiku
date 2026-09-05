import { createClient } from "@/lib/supabase/server";
import SalesDemoCreator from "@/components/SalesDemoCreator";
import type { PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SalesDemoPage() {
  const supabase = createClient();
  const { data: presets } = await supabase
    .from("preset_objects")
    .select("*")
    .eq("service", "fukubiku")
    .order("created_at", { ascending: false });

  return <SalesDemoCreator presets={(presets as PresetObject[]) ?? []} />;
}
