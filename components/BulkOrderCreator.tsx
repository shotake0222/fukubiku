"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import { generateHash } from "@/lib/hash";
import { PRESET_CATEGORIES, type DisplayType } from "@/lib/types";

const ASSET_BUCKET = "assets";

const QUICK_FILL: Record<string, string[]> = {
  amida: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  box: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  darts: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
  garagara: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
  omikuji: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  scratch: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
};

interface Row {
  id: string;
  label: string;
  quantity: string;
  file: File | null;
}

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function newRow(label = ""): Row {
  return { id: crypto.randomUUID(), label, quantity: "", file: null };
}

export default function BulkOrderCreator() {
  const supabase = useMemo(() => createClient(), []);

  const [clientName, setClientName] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [renewalCheckDate, setRenewalCheckDate] = useState("");
  const [notes, setNotes] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("aframe");

  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [compiledTargetUrl, setCompiledTargetUrl] = useState<string | null>(null);
  const [compiledMindUrl, setCompiledMindUrl] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { label: string; quantity: string; url: string }[] | null
  >(null);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function quickFill(category: string) {
    setRows(QUICK_FILL[category].map((label) => newRow(label)));
  }

  async function uploadToAssets(path: string, file: File | Blob, contentType?: string) {
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleTargetUpload(file: File) {
    setError(null);
    setTargetFile(file);
    setCompileProgress(0);
    try {
      const batchId = crypto.randomUUID();
      const imgPath = `batches/${batchId}/target-original${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setCompiledTargetUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `batches/${batchId}/target.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
      setCompiledMindUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  async function handleCreateAll() {
    setError(null);
    if (!clientName) {
      setError("クライアント名を入力してください");
      return;
    }
    if (displayType === "mindar" && !compiledMindUrl) {
      setError("MindARの場合は先にターゲット画像をアップロード・コンパイルしてください");
      return;
    }
    const targetRows = rows.filter((r) => r.label && r.file);
    if (targetRows.length === 0) {
      setError("景品名とファイルの両方が入った行が1つもありません");
      return;
    }

    setCreating(true);
    const created: { label: string; quantity: string; url: string }[] = [];
    try {
      for (const row of targetRows) {
        const hash = generateHash();
        const path = `orders/${hash}/model${extOf(row.file!.name)}`;
        const modelUrl = await uploadToAssets(path, row.file!);

        const { error } = await supabase.from("orders").insert({
          hash,
          client_name: clientName,
          prize_label: row.label,
          order_date: orderDate,
          due_date: dueDate || null,
          person_in_charge: personInCharge || null,
          quantity: row.quantity ? Number(row.quantity) : null,
          renewal_check_date: renewalCheckDate || null,
          notes: notes || null,
          display_type: displayType,
          object_source: "upload",
          custom_model_url: modelUrl,
          target_image_url: displayType === "mindar" ? compiledTargetUrl : null,
          mind_file_url: displayType === "mindar" ? compiledMindUrl : null,
          status: "ready",
        });
        if (error) throw error;

        created.push({
          label: row.label,
          quantity: row.quantity || "-",
          url: `${siteOrigin}/v/${hash}`,
        });
      }
      setResults(created);
    } catch (e: any) {
      setError(`作成中にエラーが発生しました（一部は作成済みの可能性があります）: ${e.message ?? e}`);
      if (created.length) setResults(created);
    } finally {
      setCreating(false);
    }
  }

  function downloadCsv() {
    if (!results) return;
    const header = "景品名,個数,URL\n";
    const body = results.map((r) => `${r.label},${r.quantity},${r.url}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientName || "orders"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (results) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-lg font-bold">作成完了</h1>
        <p className="text-sm text-slate-500">{results.length}件の注文とクライアント提供URLを作成しました。</p>
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">景品名</th>
                <th className="px-4 py-2">個数</th>
                <th className="px-4 py-2">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r) => (
                <tr key={r.url}>
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2">{r.quantity}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs break-all">{r.url}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadCsv}
            className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm"
          >
            CSVダウンロード
          </button>
          <Link href="/admin" className="text-sm px-5 py-2 rounded-lg border hover:bg-slate-50">
            注文一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Script
        src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"
        strategy="afterInteractive"
        onLoad={() => setMindarReady(true)}
      />

      <h1 className="text-lg font-bold">景品セット一括作成</h1>
      <p className="text-sm text-slate-500">
        1つのクライアントについて、「1等・2等・はずれ」のような複数の景品パターンをまとめてアップロードし、
        景品ごとに個別の注文・クライアント提供URLを一括発行します。
      </p>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">共通の注文情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">クライアント名 *</span>
            <input required value={clientName} onChange={(e) => setClientName(e.target.value)} className="input" />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">注文日</span>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="input" />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">納期</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">担当者</span>
            <input value={personInCharge} onChange={(e) => setPersonInCharge(e.target.value)} className="input" />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">延長確認日</span>
            <input
              type="date"
              value={renewalCheckDate}
              onChange={(e) => setRenewalCheckDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="space-y-1 block sm:col-span-2">
            <span className="text-sm font-medium">備考</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">表示方式（全景品で共通）</h2>
        <div className="flex gap-4">
          {(["aframe", "mindar"] as DisplayType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="bulkDisplayType"
                checked={displayType === t}
                onChange={() => setDisplayType(t)}
              />
              {t === "aframe" ? "A-Frame（共通マーカー画像でAR表示）" : "MindAR（画像トラッキングAR）"}
            </label>
          ))}
        </div>
        {displayType === "mindar" && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm text-slate-500">
              全景品で共通のターゲット画像を1枚アップロードしてください（景品ごとの動画/画像は下のリストで指定します）。
            </p>
            <input
              type="file"
              accept="image/*"
              disabled={!mindarReady}
              onChange={(e) => e.target.files?.[0] && handleTargetUpload(e.target.files[0])}
            />
            {!mindarReady && <p className="text-xs text-slate-400">コンパイラを読み込み中...</p>}
            {compileProgress !== null && (
              <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>
            )}
            {compiledMindUrl && <p className="text-xs text-emerald-700">コンパイル済み</p>}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">景品リスト</h2>
          <div className="flex flex-wrap gap-1">
            {PRESET_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => quickFill(c.value)}
                className="text-xs px-2 py-1 rounded-full border hover:bg-slate-50"
              >
                {c.label}の項目で埋める
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 border rounded-lg p-2">
              <input
                placeholder="景品名（例: 1等）"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                className="input flex-1 min-w-[8rem]"
              />
              <input
                placeholder="個数"
                type="number"
                min={0}
                value={row.quantity}
                onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                className="input w-24"
              />
              <input
                type="file"
                accept=".glb,.gltf,video/mp4,image/gif,image/*"
                onChange={(e) => updateRow(row.id, { file: e.target.files?.[0] ?? null })}
                className="text-xs flex-1 min-w-[10rem]"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-xs text-red-600 hover:underline"
              >
                削除
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow} className="text-sm px-3 py-1 rounded-lg border hover:bg-slate-50">
          + 行を追加
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCreateAll}
        disabled={creating}
        className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
      >
        {creating ? "作成中..." : "まとめて注文・URLを作成"}
      </button>
    </div>
  );
}
