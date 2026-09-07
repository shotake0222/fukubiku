import { createHash, randomInt } from "crypto";
import type { RallyContext } from "@/lib/rallyServer";
import type { AttendRallyParticipant } from "@/lib/types";

/** 6桁の確認コード。読み上げやすさを優先して数字だけにする。 */
export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * 平文は保存しない。ラリーIDとメールを混ぜてハッシュ化するので、
 * 万一テーブルが漏れても、他のラリーへ使い回すことはできない。
 */
export function hashCode(code: string, rallyId: string, email: string): string {
  return createHash("sha256").update(`${rallyId}:${email.toLowerCase()}:${code}`).digest("hex");
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** 形式の妥当性だけを見る。到達性はコードが届くかどうかで確かめる。 */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

/** 画面に出す用に伏せる（a***@example.com）。 */
export function maskEmail(v: string): string {
  const [name, domain] = v.split("@");
  if (!domain) return "***";
  const head = name.slice(0, 1);
  return `${head}${"*".repeat(Math.max(name.length - 1, 1))}@${domain}`;
}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** 同じメール宛に1時間で送れる上限。踏み台にされないための歯止め。 */
export const MAX_SENDS_PER_HOUR = 5;

/**
 * 別の参加者へスタンプ帳を引き継ぐ。
 *
 * いま使っている端末に押したスタンプを、メールに紐づいた側へ写してから
 * 乗り換える。せっかく押したスタンプが消える体験を避けるための処理で、
 * 同じスポットが重なる場合はDBの一意制約に任せて黙って捨てる。
 */
export async function mergeParticipants(
  ctx: RallyContext,
  fromId: string,
  toId: string
): Promise<void> {
  if (fromId === toId) return;

  const { data: rows } = await ctx.supabase
    .from("attend_rally_stamps")
    .select("*")
    .eq("participant_id", fromId);

  for (const s of (rows as { spot_id: string; method: string; lat: number | null; lng: number | null; accuracy_m: number | null }[] | null) ?? []) {
    const { error } = await ctx.supabase.from("attend_rally_stamps").insert({
      participant_id: toId,
      spot_id: s.spot_id,
      method: s.method,
      lat: s.lat,
      lng: s.lng,
      accuracy_m: s.accuracy_m,
    });
    // 23505 = 引き継ぎ先に同じスポットが既にある。捨ててよい。
    if (error && error.code !== "23505") throw new Error(error.message);
  }

  // 引き継ぎ元に引換コードが出ている場合は、引換の記録を消さないために残す。
  // (窓口で「使用済み」にした事実が消えると、二重引換を許してしまう)
  const { data: reward } = await ctx.supabase
    .from("attend_rally_rewards")
    .select("id")
    .eq("participant_id", fromId)
    .maybeSingle();
  if (!reward) {
    await ctx.supabase.from("attend_rally_participants").delete().eq("id", fromId);
  }
}

export type { AttendRallyParticipant };
