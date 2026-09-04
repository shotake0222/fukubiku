import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// クライアント提供用の公開ビューア(/v/[hash])専用。
// anon には orders テーブルへの読み取り権限を与えていないため、
// service role キーでサーバーサイドのみから参照する。
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
