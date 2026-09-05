"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// パスワード再設定メールのリンク先。ここは意図的にミドルウェアの認証チェックの
// 対象外にしてある(middleware.ts参照)。まだログインセッションが無い状態で
// アクセスされるのが正常なケースだからで、代わりにこのページ自身が
// Supabaseのリカバリー用コード/トークンを検証できた場合にのみ
// パスワード変更フォームを表示する。
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      // 新しめのSupabaseプロジェクト(PKCEフロー)では ?code=... の形式でリンクが送られる。
      // 古い形式(URLの#以降にaccess_token等が入る実装)は、createClient() が
      // detectSessionInUrl:true (デフォルト)で自動的に処理してくれる。
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setError("リンクが無効か、有効期限が切れています。もう一度パスワード再設定メールを送ってください。");
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        if (data.session) setReady(true);
        setChecking(false);
      }
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== password2) {
      setError("パスワードが一致しません");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(`更新に失敗しました: ${updateError.message}`);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/admin"), 1500);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-slate-500">確認中...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 text-center space-y-2">
          <p className="font-medium">パスワードを更新しました</p>
          <p className="text-sm text-slate-500">管理画面に移動します...</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 text-center space-y-3">
          <p className="font-medium">リンクが無効か、有効期限が切れています</p>
          <p className="text-sm text-slate-500">
            ログイン画面の「パスワードをお忘れですか？」からもう一度お試しください。
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-5">
        <h1 className="text-xl font-bold text-center">新しいパスワードを設定</h1>
        <div className="space-y-1">
          <label className="text-sm font-medium">新しいパスワード</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">新しいパスワード(確認)</label>
          <input
            type="password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {saving ? "更新中..." : "パスワードを更新"}
        </button>
      </form>
    </div>
  );
}
