import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrderEditor from "@/components/OrderEditor";
import type { Order, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: order, error }, { data: presets }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).single(),
    supabase.from("preset_objects").select("*").order("created_at", { ascending: false }),
  ]);

  if (error || !order) {
    notFound();
  }

  return (
    <OrderEditor order={order as Order} presets={(presets as PresetObject[]) ?? []} />
  );
}
