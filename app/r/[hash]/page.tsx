import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import RallyApp, { type RallyView, type RallySpotView } from "@/components/RallyApp";
import { isWithinPeriod, requiredCount, stampLabelFor } from "@/lib/rally";
import type { AttendRally, AttendRallySpot, PresetObject } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { hash: string } }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("attend_rallies")
    .select("name, description")
    .eq("hash", params.hash)
    .maybeSingle();
  if (!data) return { title: "スタンプラリー" };
  const rally = data as Pick<AttendRally, "name" | "description">;
  return { title: rally.name, description: rally.description ?? undefined };
}

export default async function RallyPage({
  params,
  searchParams,
}: {
  params: { hash: string };
  searchParams: { s?: string; n?: string };
}) {
  const supabase = createAdminClient();

  const { data: rallyRow } = await supabase
    .from("attend_rallies")
    .select("*")
    .eq("hash", params.hash)
    .maybeSingle();

  if (!rallyRow) notFound();
  const rally = rallyRow as AttendRally;

  const { data: spotRows } = await supabase
    .from("attend_rally_spots")
    .select("*")
    .eq("rally_id", rally.id)
    .order("sort_order", { ascending: true });
  const spots = (spotRows as AttendRallySpot[] | null) ?? [];

  // スポットと特典で使うプリセットのモデルURLをまとめて解決する。
  const presetIds = Array.from(
    new Set(
      [
        ...spots
          .filter((s) => s.object_source === "preset" && s.preset_object_id)
          .map((s) => s.preset_object_id as string),
        ...(rally.reward_object_source === "preset" && rally.reward_preset_object_id
          ? [rally.reward_preset_object_id]
          : []),
      ]
    )
  );
  const { data: presets } = presetIds.length
    ? await supabase.from("preset_objects").select("*").in("id", presetIds)
    : { data: [] as PresetObject[] };
  const presetMap = new Map(((presets as PresetObject[] | null) ?? []).map((p) => [p.id, p]));

  function modelUrlFor(
    source: string | null,
    presetId: string | null,
    customUrl: string | null
  ): string | null {
    if (source === "upload") return customUrl;
    if (presetId) return presetMap.get(presetId)?.model_url ?? null;
    return null;
  }

  const spotViews: RallySpotView[] = spots.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    gpsEnabled: s.gps_enabled && s.gps_lat != null && s.gps_lng != null,
    lat: s.gps_lat,
    lng: s.gps_lng,
    radiusM: s.gps_radius_m,
    codeEnabled: s.code_enabled && !!s.spot_code,
    modelUrl: modelUrlFor(s.object_source, s.preset_object_id, s.custom_model_url),
    position: s.position || "0 0 0",
    scale: s.scale,
    rotationY: s.rotation_y || 0,
    stampLabel: stampLabelFor(s),
    stampColor: s.stamp_color || "#c0392b",
  }));

  const view: RallyView = {
    hash: rally.hash,
    name: rally.name,
    description: rally.description,
    theme: rally.theme,
    totalCount: spots.length,
    requiredCount: requiredCount(rally, spots.length),
    active: rally.status === "active" && isWithinPeriod(rally),
    statusReason:
      rally.status !== "active"
        ? "このスタンプラリーはまだ公開されていません。"
        : !isWithinPeriod(rally)
          ? "このスタンプラリーは開催期間外です。"
          : null,
    endsAt: rally.ends_at,
    couponEnabled: rally.reward_coupon_enabled,
    couponLabel: rally.reward_coupon_label,
    couponNote: rally.reward_coupon_note,
    rewardModelUrl: modelUrlFor(
      rally.reward_object_source,
      rally.reward_preset_object_id,
      rally.reward_custom_model_url
    ),
    rewardMessage: rally.reward_message,
  };

  // QRを読んだ場合は ?s=、NFCタグにかざした場合は ?n= が付く。
  // どちらも同じ spot_code だが、あとで集計を分けられるよう別パラメータにしている。
  const landingCode = searchParams.s || searchParams.n || null;
  const landingVia = searchParams.n ? ("nfc" as const) : ("qr" as const);

  return (
    <RallyApp
      rally={view}
      spots={spotViews}
      landingCode={landingCode}
      landingVia={landingVia}
    />
  );
}
