"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { generateHash } from "@/lib/hash";

// NFC非対応端末向けの「QR専用URL」を発行・停止・再発行する欄。
// 注文編集(OrderEditor)と抽選セット編集(DrawGroupEditor)で共通に使う。
//
// QRは写真で共有できてしまうため、NFCタグのURL(/v/<hash>)とは別のURL
// (/q/<qr_token>)にしてある。拡散されたら「停止」または「再発行」で止められる。
// クールダウン(Cookie)はNFCと共通なので、QRで引き直すことはできない。
export default function QrAccessPanel({
  kind,
  id,
  hash,
  siteOrigin,
  initialToken,
  initialEnabled,
}: {
  kind: "order" | "group";
  id: string;
  hash: string;
  siteOrigin: string;
  initialToken: string | null | undefined;
  initialEnabled: boolean | null | undefined;
}) {
  const supabase = useMemo(() => createClient(), []);
  const table = kind === "order" ? "orders" : "draw_groups";

  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [enabled, setEnabled] = useState<boolean>(!!initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ nfc: number; qr: number } | null>(null);
  // 列が無い = add_qr_access.sql が未実行。initialToken が undefined で判定する。
  const notMigrated = initialToken === undefined;

  const qrUrl = token ? `${siteOrigin}/q/${token}` : null;

  useEffect(() => {
    if (!qrUrl) {
      setSvg("");
      return;
    }
    QRCode.toString(qrUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [qrUrl]);

  const loadStats = useCallback(async () => {
    const count = async (via: "nfc" | "qr") => {
      const { count, error } = await supabase
        .from("draw_logs")
        .select("id", { count: "exact", head: true })
        .eq("hash", hash)
        .eq("via", via);
      if (error) throw error;
      return count ?? 0;
    };
    try {
      const [nfc, qr] = await Promise.all([count("nfc"), count("qr")]);
      setStats({ nfc, qr });
    } catch {
      setStats(null);
    }
  }, [supabase, hash]);

  useEffect(() => {
    if (!notMigrated) loadStats();
  }, [loadStats, notMigrated]);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code;
      setError(
        code === "42703" || code === "PGRST204"
          ? "データベースの準備がまだです。Supabaseで supabase/add_qr_access.sql を実行してください。"
          : `保存に失敗しました（${error.message}）`
      );
      return false;
    }
    return true;
  }

  async function issue() {
    const next = generateHash();
    if (await save({ qr_token: next, qr_enabled: true, qr_issued_at: new Date().toISOString() })) {
      setToken(next);
      setEnabled(true);
    }
  }

  async function reissue() {
    if (
      !confirm(
        "QRコードを新しく作り直します。\n今までのQRコード(印刷済みのものも含む)は使えなくなります。よろしいですか？"
      )
    )
      return;
    await issue();
  }

  async function toggle() {
    const next = !enabled;
    if (await save({ qr_enabled: next })) setEnabled(next);
  }

  async function downloadPng() {
    if (!qrUrl) return;
    // 印刷しても潰れないよう大きめに作る(1辺1200px)
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fukubiku-qr-${hash}.png`;
    a.click();
  }

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fukubiku-qr-${hash}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copy() {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <h2 className="font-semibold">QRコード（NFC非対応の端末向け）</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          NFCタグのURLとは別の、QR専用のURLを発行します。表示される内容は同じです。
          QRは写真で共有できてしまうため、広まってしまった場合は「停止」または「作り直す」で止められます。
          再抽選までの時間（Cookie）はNFCと共通なので、QRで引き直すことはできません。
        </p>
      </div>

      {notMigrated && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          この機能を使うには、Supabaseで <code className="font-mono">supabase/add_qr_access.sql</code>{" "}
          を実行してください。
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
      )}

      {!token ? (
        <button
          type="button"
          onClick={issue}
          disabled={busy || notMigrated}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-40"
        >
          {busy ? "発行中..." : "QRコードを発行する"}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-5">
          <div className={`w-40 shrink-0 ${enabled ? "" : "opacity-30"}`}>
            {svg ? (
              // qrcodeライブラリが生成したSVG(外部入力ではない)
              <div className="border rounded-lg p-2 bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <div className="w-40 h-40 bg-slate-100 rounded-lg" />
            )}
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                }`}
              >
                {enabled ? "受付中" : "停止中"}
              </span>
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 disabled:opacity-40"
              >
                {enabled ? "停止する" : "再開する"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <code className="text-xs bg-slate-100 rounded px-2 py-1 break-all">{qrUrl}</code>
              <button
                type="button"
                onClick={copy}
                className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 whitespace-nowrap"
              >
                {copied ? "コピーしました" : "コピー"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPng}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                PNGで保存
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                SVGで保存（印刷業者向け）
              </button>
              <Link
                href={`/admin/fukubiku/qr/${kind}/${id}/print`}
                target="_blank"
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                掲示用ページを開く（印刷）
              </Link>
              <button
                type="button"
                onClick={reissue}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                作り直す（古いQRを無効化）
              </button>
            </div>

            {stats && (
              <div className="text-xs text-slate-600 border-t pt-3 flex gap-4">
                <span>
                  NFC・通常URL: <b className="text-slate-900">{stats.nfc.toLocaleString()}</b> 回
                </span>
                <span>
                  QR: <b className="text-slate-900">{stats.qr.toLocaleString()}</b> 回
                </span>
                <button type="button" onClick={loadStats} className="underline text-slate-400">
                  更新
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
