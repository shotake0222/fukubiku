import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/rally";
import { loadRally } from "@/lib/rallyServer";
import type { AttendRallyReward } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RedeemBody {
  hash?: string;
  couponCode?: string;
  pin?: string;
  note?: string;
  /** 照合だけして使用済みにはしない（窓口で内容を確認する用） */
  checkOnly?: boolean;
}

/**
 * 引換窓口用。参加者が見せた引換コードを照合し、使用済みにする。
 *
 * 管理画面へのログインは求めず、ラリーごとの暗証番号(staff_pin)で守る。
 * 現場のスタッフにSupabaseアカウントを配らずに済ませるための割り切りで、
 * 暗証番号が未設定のラリーでは窓口処理そのものを受け付けない。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RedeemBody;
  if (!body.hash) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const ctx = await loadRally(body.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!ctx.rally.staff_pin) {
    return NextResponse.json({ error: "pin_not_set" }, { status: 403 });
  }
  if (normalizeCode(body.pin ?? "") !== normalizeCode(ctx.rally.staff_pin)) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 403 });
  }

  const code = normalizeCode(body.couponCode ?? "");
  if (!code) return NextResponse.json({ error: "empty_code" }, { status: 400 });

  const { data } = await ctx.supabase
    .from("attend_rally_rewards")
    .select("*")
    .eq("rally_id", ctx.rally.id)
    .eq("coupon_code", code)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "invalid_code" }, { status: 404 });
  const reward = data as AttendRallyReward;

  if (body.checkOnly) {
    return NextResponse.json({
      couponCode: reward.coupon_code,
      issuedAt: reward.issued_at,
      redeemedAt: reward.redeemed_at,
      alreadyRedeemed: !!reward.redeemed_at,
    });
  }

  if (reward.redeemed_at) {
    return NextResponse.json(
      {
        error: "already_redeemed",
        couponCode: reward.coupon_code,
        redeemedAt: reward.redeemed_at,
        redeemedNote: reward.redeemed_note,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await ctx.supabase
    .from("attend_rally_rewards")
    .update({ redeemed_at: now, redeemed_note: body.note || null })
    .eq("id", reward.id)
    .is("redeemed_at", null); // 同時に2窓口で処理しても二重にならないようにする

  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ couponCode: reward.coupon_code, redeemedAt: now });
}
