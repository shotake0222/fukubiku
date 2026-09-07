import { NextResponse } from "next/server";
import {
  CODE_TTL_MS,
  MAX_SENDS_PER_HOUR,
  generateEmailCode,
  hashCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/rallyEmailAuth";
import { sendVerificationCode } from "@/lib/rallyMail";
import { loadRally } from "@/lib/rallyServer";

export const dynamic = "force-dynamic";

// メールアドレスに確認コードを送る。
// 「登録」と「別端末からの呼び戻し」は同じ操作にしてある
// （利用者にとっては、どちらも“メールで自分だと名乗る”ことだけ）。
export async function POST(req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // 踏み台にされないための歯止め。同じ宛先へは1時間に5通まで。
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await ctx.supabase
    .from("attend_rally_login_codes")
    .select("id", { count: "exact", head: true })
    .eq("rally_id", ctx.rally.id)
    .eq("email", email)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const code = generateEmailCode();
  const { data: inserted, error } = await ctx.supabase
    .from("attend_rally_login_codes")
    .insert({
      rally_id: ctx.rally.id,
      email,
      code_hash: hashCode(code, ctx.rally.id, email),
      purpose: "link",
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 溜まり続けないよう、発行のついでに古い行を捨てる（失敗しても本筋は続ける）
  await ctx.supabase.rpc("purge_expired_rally_login_codes");

  const sent = await sendVerificationCode(email, code, ctx.rally.name);
  if (!sent.ok) {
    // 送れなかった分を送信回数に数えない。設定不備のせいで
    // 利用者が「しばらく待ってください」に阻まれるのを防ぐ。
    await ctx.supabase
      .from("attend_rally_login_codes")
      .delete()
      .eq("id", (inserted as { id: string }).id);
    return NextResponse.json({ error: sent.error ?? "send_failed" }, { status: 500 });
  }

  // devCode は開発環境でのみ返る（本番はメール送信が設定されていないと失敗する）
  return NextResponse.json({ ok: true, devCode: sent.devCode });
}
