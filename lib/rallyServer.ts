import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateCouponCode,
  generateRestoreCode,
  participantCookieName,
  requiredCount,
  type RallyPublicState,
} from "@/lib/rally";
import type {
  AttendRally,
  AttendRallyParticipant,
  AttendRallyReward,
  AttendRallySpot,
  AttendRallyStamp,
} from "@/lib/types";

// 参加者Cookieの寿命。長期開催のラリーでも会期を跨げるよう半年。
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export type Supabase = ReturnType<typeof createAdminClient>;

export interface RallyContext {
  supabase: Supabase;
  rally: AttendRally;
  spots: AttendRallySpot[];
}

export async function loadRally(hash: string): Promise<RallyContext | null> {
  const supabase = createAdminClient();
  const { data: rally } = await supabase
    .from("attend_rallies")
    .select("*")
    .eq("hash", hash)
    .maybeSingle();
  if (!rally) return null;

  const { data: spots } = await supabase
    .from("attend_rally_spots")
    .select("*")
    .eq("rally_id", (rally as AttendRally).id)
    .order("sort_order", { ascending: true });

  return {
    supabase,
    rally: rally as AttendRally,
    spots: ((spots as AttendRallySpot[] | null) ?? []),
  };
}

/** Cookieに入っている参加者IDを取り出す（存在確認まではしない）。 */
export function participantIdFromCookie(rallyHash: string): string | null {
  return cookies().get(participantCookieName(rallyHash))?.value ?? null;
}

export function setParticipantCookie(rallyHash: string, participantId: string) {
  cookies().set(participantCookieName(rallyHash), participantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Cookieの参加者を取得する。無ければ作る（= URLを開いた時点で自動参加）。
 * 参加者IDはCookieにしか置かないので、他人のスタンプ帳を覗くことはできない。
 */
export async function ensureParticipant(
  ctx: RallyContext,
  rallyHash: string
): Promise<AttendRallyParticipant> {
  const existingId = participantIdFromCookie(rallyHash);
  if (existingId) {
    const { data } = await ctx.supabase
      .from("attend_rally_participants")
      .select("*")
      .eq("id", existingId)
      .eq("rally_id", ctx.rally.id)
      .maybeSingle();
    if (data) {
      // 最終アクセス日時だけ更新しておく（運営側の参加状況の目安になる）。
      await ctx.supabase
        .from("attend_rally_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", (data as AttendRallyParticipant).id);
      return data as AttendRallyParticipant;
    }
  }

  // 引き継ぎコードはラリー内で一意。万一衝突したら数回まで作り直す。
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await ctx.supabase
      .from("attend_rally_participants")
      .insert({ rally_id: ctx.rally.id, restore_code: generateRestoreCode() })
      .select("*")
      .single();
    if (data) {
      setParticipantCookie(rallyHash, (data as AttendRallyParticipant).id);
      return data as AttendRallyParticipant;
    }
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("参加者の作成に失敗しました");
}

export async function loadStamps(ctx: RallyContext, participantId: string): Promise<AttendRallyStamp[]> {
  const { data } = await ctx.supabase
    .from("attend_rally_stamps")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  return (data as AttendRallyStamp[] | null) ?? [];
}

export async function loadReward(
  ctx: RallyContext,
  participantId: string
): Promise<AttendRallyReward | null> {
  const { data } = await ctx.supabase
    .from("attend_rally_rewards")
    .select("*")
    .eq("participant_id", participantId)
    .maybeSingle();
  return (data as AttendRallyReward | null) ?? null;
}

export function isCompleted(ctx: RallyContext, stampCount: number): boolean {
  return stampCount >= requiredCount(ctx.rally, ctx.spots.length) && ctx.spots.length > 0;
}

/**
 * コンプリート済みなら引換コードを発行する（既に持っていればそれを返す）。
 * 特典が無効なラリーでは発行しない。
 */
export async function issueRewardIfComplete(
  ctx: RallyContext,
  participantId: string,
  stampCount: number
): Promise<AttendRallyReward | null> {
  if (!ctx.rally.reward_coupon_enabled) return null;
  if (!isCompleted(ctx, stampCount)) return null;

  const existing = await loadReward(ctx, participantId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await ctx.supabase
      .from("attend_rally_rewards")
      .insert({
        rally_id: ctx.rally.id,
        participant_id: participantId,
        coupon_code: generateCouponCode(),
      })
      .select("*")
      .single();
    if (data) return data as AttendRallyReward;
    if (error?.code === "23505") {
      // participant側のユニーク制約に当たった＝同時押しで既に発行済み。
      const again = await loadReward(ctx, participantId);
      if (again) return again;
      continue; // coupon_code側の衝突なら作り直す
    }
    if (error) throw new Error(error.message);
  }
  return null;
}

/** 参加者画面へ返す状態。staff_pin など秘密の値は決して含めない。 */
export async function buildState(
  ctx: RallyContext,
  participant: AttendRallyParticipant
): Promise<RallyPublicState> {
  const stamps = await loadStamps(ctx, participant.id);
  const reward = await issueRewardIfComplete(ctx, participant.id, stamps.length);
  return {
    participantId: participant.id,
    restoreCode: participant.restore_code,
    stamps: stamps.map((s) => ({ spotId: s.spot_id, method: s.method, createdAt: s.created_at })),
    completed: isCompleted(ctx, stamps.length),
    coupon: reward
      ? { code: reward.coupon_code, issuedAt: reward.issued_at, redeemedAt: reward.redeemed_at }
      : null,
  };
}
