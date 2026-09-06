"use client";

import { useState } from "react";

interface Result {
  kind: "ok" | "already" | "error";
  message: string;
  detail?: string;
}

/**
 * 引換窓口。参加者が見せた引換コードを入力して「使用済み」にする。
 *
 * 暗証番号は入力欄に保持するだけでサーバーには都度送る（保存しない）。
 * 同じ端末で連続して処理することが多いので、成功しても暗証番号は消さない。
 */
export default function RallyStaffDesk({
  hash,
  rallyName,
  couponLabel,
  pinConfigured,
}: {
  hash: string;
  rallyName: string;
  couponLabel: string;
  pinConfigured: boolean;
}) {
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(checkOnly: boolean) {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/rally/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hash, couponCode: code, pin, checkOnly }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok) {
      if (checkOnly) {
        setResult({
          kind: data.alreadyRedeemed ? "already" : "ok",
          message: data.alreadyRedeemed ? "このコードは引換済みです" : "有効なコードです",
          detail: data.redeemedAt
            ? `引換日時: ${new Date(data.redeemedAt).toLocaleString("ja-JP")}`
            : undefined,
        });
      } else {
        setResult({ kind: "ok", message: "引換を記録しました", detail: `コード ${data.couponCode}` });
        setCode("");
      }
      return;
    }

    const map: Record<string, string> = {
      invalid_pin: "暗証番号が違います",
      pin_not_set: "このラリーには暗証番号が設定されていません（管理画面で設定してください）",
      invalid_code: "そのコードは見つかりませんでした",
      empty_code: "コードを入力してください",
      already_redeemed: "このコードは引換済みです",
    };
    setResult({
      kind: data?.error === "already_redeemed" ? "already" : "error",
      message: map[data?.error] ?? "処理できませんでした",
      detail: data?.redeemedAt
        ? `引換日時: ${new Date(data.redeemedAt).toLocaleString("ja-JP")}`
        : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-slate-900 px-6 py-10 text-white">
      <div className="mx-auto max-w-sm space-y-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-slate-400">STAFF</p>
          <h1 className="mt-1 text-xl font-bold">{rallyName}</h1>
          <p className="mt-1 text-sm text-slate-400">{couponLabel}の引換窓口</p>
        </div>

        {!pinConfigured && (
          <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
            暗証番号が未設定のため、まだ引換処理はできません。
            管理画面のラリー編集から「窓口の暗証番号」を設定してください。
          </p>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs text-slate-400">窓口の暗証番号</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 tracking-[0.3em]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs text-slate-400">参加者の引換コード</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="例: 7KDM2XVA"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-[0.3em]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={busy || !pinConfigured || !code.trim()}
            onClick={() => submit(true)}
            className="rounded-xl border border-white/20 py-3 text-sm font-bold disabled:opacity-40"
          >
            確認だけ
          </button>
          <button
            disabled={busy || !pinConfigured || !code.trim()}
            onClick={() => submit(false)}
            className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-900 disabled:opacity-40"
          >
            {busy ? "処理中..." : "引換済みにする"}
          </button>
        </div>

        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              result.kind === "ok"
                ? "bg-emerald-500/15 text-emerald-200"
                : result.kind === "already"
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-red-500/15 text-red-200"
            }`}
          >
            <p className="font-bold">{result.message}</p>
            {result.detail && <p className="mt-1 text-xs opacity-80">{result.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
