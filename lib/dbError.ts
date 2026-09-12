/**
 * Supabase(PostgREST)のエラーを、そのまま画面に出せる文章にする。
 *
 * 「作成に失敗しました」だけを出して原因を捨ててしまうと、
 * 見ている側にはどうしようもない。よくある原因については、
 * 次に何をすればよいか(どのSQLを流すか)まで併記する。
 */
export interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** テーブル・列の不足は、ほぼ「SQLを流し忘れている」ことが原因 */
// 上から順に照合する。列の不足はテーブル名も含むので、
// 「どの列か」を見る規則を先に置く。
const MISSING_TABLE_HINTS: { match: RegExp; sql: string }[] = [
  // 受け皿サイトのデザイン調整用の列
  // PostgRESTは「'sections' column of 'attend_portals'」という言い回しをするので、
  // 直接SQLの「attend_portals.design」形式と両方を拾う。
  { match: /(attend_portals\.|column\s+"?)(design|sections|nav|sns)\b|['"](design|sections|nav|sns)['"]\s+column/, sql: "supabase/add_portal_design.sql" },
  // ラリーのテーマ・配布URL
  { match: /attend_rally_links|attend_rallies\.theme/, sql: "supabase/add_rally_links_and_themes.sql" },
  // 参加者のメール登録（受け皿サイトと同じSQLで入る）
  { match: /attend_rally_login_codes|attend_rally_participants\.(email|display_name)/, sql: "supabase/schema_attend_portal.sql" },
  // 受け皿サイト本体
  { match: /attend_portal_blocks|attend_portals/, sql: "supabase/schema_attend_portal.sql" },
  // スタンプラリー本体
  { match: /attend_rally_spots|attend_rally_participants|attend_rally_stamps|attend_rallies/, sql: "supabase/schema_attend_rally.sql" },
  // あてんどの土台
  { match: /attend_projects|attend_items|attend_triggers|attend_trigger_objects|set_updated_at/, sql: "supabase/schema_attend.sql" },
  { match: /preset_objects|draw_groups|orders/, sql: "supabase/schema.sql" },
];

export function describeDbError(e: DbErrorLike | null | undefined, what: string): string {
  if (!e) return `${what}に失敗しました（原因が取得できませんでした）`;
  const msg = e.message ?? "";
  const code = e.code ?? "";
  const parts = [msg, e.details ?? "", e.hint ?? ""].filter(Boolean).join(" / ");

  // 42P01: テーブルが無い / 42703: 列が無い / PGRST205: スキーマキャッシュに無い
  if (code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204" || /does not exist|schema cache/i.test(parts)) {
    const found = MISSING_TABLE_HINTS.find((h) => h.match.test(parts));
    const sql = found ? found.sql : "supabase/ 配下の該当SQL";
    const cacheNote =
      code === "PGRST205" || /schema cache/i.test(parts)
        ? "\n（SQLを実行した直後であれば、Supabase側の反映待ちの可能性があります。1分ほど置いてから再度お試しください）"
        : "";
    return (
      `${what}に失敗しました。データベースの準備がまだのようです。\n` +
      `Supabaseのダッシュボード > SQL Editor で ${sql} を実行してから、もう一度お試しください。\n` +
      `どのSQLが未実行かは supabase/check_attend_setup.sql を流すと一覧で分かります。` +
      cacheNote +
      `\n（詳細: ${parts || code}）`
    );
  }

  // 42501 / RLS
  if (code === "42501" || /row-level security|permission denied/i.test(parts)) {
    return (
      `${what}に失敗しました。データベースの権限で拒否されました。\n` +
      `ログインし直しても直らない場合は、対象テーブルのRLSポリシーをご確認ください。\n` +
      `（詳細: ${parts || code}）`
    );
  }

  // 23505: 一意制約
  if (code === "23505") {
    return `${what}に失敗しました。すでに同じものが登録されています。\n（詳細: ${parts}）`;
  }

  // 23503: 外部キー
  if (code === "23503") {
    return (
      `${what}に失敗しました。紐づけ先のデータが見つかりません。\n` +
      `（詳細: ${parts}）`
    );
  }

  return `${what}に失敗しました: ${parts || code || "原因不明"}`;
}
