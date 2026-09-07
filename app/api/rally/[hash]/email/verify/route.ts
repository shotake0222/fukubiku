import { NextResponse } from "next/server";
import {
  MAX_ATTEMPTS,
  hashCode,
  isValidEmail,
  mergeParticipants,
  normalizeEmail,
} from "@/lib/rallyEmailAuth";
import {
  buildState,
  ensureParticipant,
  loadRally,
  participantIdFromHeader,
  setParticipantCookie,
} from "@/lib/rallyServer";
import type { AttendRallyParticipant } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CodeRow {
  id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
}

export async function POST(req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = normalizeEmail(body.email ?? "");
  const code = (body.code ?? "").replace(/\D/g, "");
  if (!isValidEmail(email) || code.length !== 6) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // 直近に発行した1件だけを見る。古いコードは使えない。
  const { data: row } = await ctx.supabase
    .from("attend_rally_login_codes")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("rally_id", ctx.rally.id)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const target = row as CodeRow | null;
  if (!target || target.consumed_at) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }
  if (new Date(target.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }
  if (target.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  if (target.code_hash !== hashCode(code, ctx.rally.id, email)) {
    await ctx.supabase
      .from("attend_rally_login_codes")
      .update({ attempts: target.attempts + 1 })
      .eq("id", target.id);
    return NextResponse.json(
      { error: "code_mismatch", remaining: MAX_ATTEMPTS - target.attempts - 1 },
      { status: 403 }
    );
  }

  // 使い捨てにする（同じコードで何度も入れないように）
  await ctx.supabase
    .from("attend_rally_login_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", target.id);

  // いまこの端末で使っているスタンプ帳
  const current = await ensureParticipant(ctx, participantIdFromHeader(req));

  // このメールで登録済みのスタンプ帳があるか
  const { data: existingRow } = await ctx.supabase
    .from("attend_rally_participants")
    .select("*")
    .eq("rally_id", ctx.rally.id)
    .eq("email", email)
    .maybeSingle();
  const existing = existingRow as AttendRallyParticipant | null;

  let participant: AttendRallyParticipant;
  let merged = false;

  if (existing && existing.id !== current.id) {
    // 登録済みの帳面へ乗り換える。いまの端末で押した分は写してから捨てる。
    await mergeParticipants(ctx, current.id, existing.id);
    merged = true;
    const { data } = await ctx.supabase
      .from("attend_rally_participants")
      .select("*")
      .eq("id", existing.id)
      .single();
    participant = data as AttendRallyParticipant;
  } else {
    // まだ誰にも紐づいていないメール。いまの帳面に登録する。
    const { data, error } = await ctx.supabase
      .from("attend_rally_participants")
      .update({ email, email_verified_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: "link_failed" }, { status: 500 });
    }
    participant = data as AttendRallyParticipant;
  }

  setParticipantCookie(ctx, participant.id);
  const state = await buildState(ctx, participant);
  return NextResponse.json({ ...state, merged });
}
