import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import RallyStaffDesk from "@/components/RallyStaffDesk";
import type { AttendRally } from "@/lib/types";

export const dynamic = "force-dynamic";

// 引換窓口用の画面。管理画面へのログインは不要で、ラリーごとの暗証番号で守る。
// 現場のスタッフにSupabaseアカウントを配らずに運用できるようにするための入口。
export default async function RallyStaffPage({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("attend_rallies")
    .select("hash, name, reward_coupon_label, staff_pin")
    .eq("hash", params.hash)
    .maybeSingle();

  if (!data) notFound();
  const rally = data as Pick<AttendRally, "hash" | "name" | "reward_coupon_label" | "staff_pin">;

  return (
    <RallyStaffDesk
      hash={rally.hash}
      rallyName={rally.name}
      couponLabel={rally.reward_coupon_label}
      pinConfigured={!!rally.staff_pin}
    />
  );
}
