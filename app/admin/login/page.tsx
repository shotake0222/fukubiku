"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ログイン画面内に「パスワードをお忘れですか？」を組み込み、そのまま再設定メールを
  // 送れるようにする。Supabase側の「Site URL」設定が本番ドメインに更新されていなくても、
  // ここで redirectTo を明示的に指定すればそちらが優先される(ただし事前にSupabase側の
  // 「Authentication > URL Configuration > Redirect URLs」にこのURLを許可登録しておく必要がある)。
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      return;
    }
    router.replace(searchParams.get("next") || "/admin");
    router.refresh();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    if (!email) {
      setResetError("メールアドレスを入力してください");
      return;
    }
    setResetLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      // 原因を特定できるよう、Supabaseが返した実際のエラー内容も併せて表示する
      // (Redirect URLが未許可、送信回数の制限、メールアドレス不正 など)。
      setResetError(`送信に失敗しました: ${error.message}${error.status ? ` (status: ${error.status})` : ""}`);
      return;
    }
    setResetSent(true);
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={handleReset} className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-5">
        <h1 className="text-xl font-bold text-center">パスワード再設定</h1>
        {resetSent ? (
          <p className="text-sm text-slate-600">
            入力されたメールアドレス宛に再設定用のリンクを送信しました。メールをご確認ください。
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            {resetError && <p className="text-sm text-red-600">{resetError}</p>}
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {resetLoading ? "送信中..." : "再設定メールを送る"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setResetSent(false);
            setResetError(null);
          }}
          className="w-full text-sm text-slate-500 hover:underline"
        >
          ログイン画面に戻る
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-5">
      <h1 className="text-xl font-bold text-center">fukubiku 管理画面</h1>
      <div className="space-y-1">
        <label className="text-sm font-medium">メールアドレス</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">パスワード</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
      >
        {loading ? "ログイン中..." : "ログイン"}
      </button>
      <button type="button" onClick={() => setMode("forgot")} className="w-full text-sm text-slate-500 hover:underline">
        パスワードをお忘れですか？
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
