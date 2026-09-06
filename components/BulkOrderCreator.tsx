"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget, ensureMindArCompiler } from "@/lib/mindCompiler";
import { generateHash } from "@/lib/hash";
import { PRESET_CATEGORIES, type DisplayType, type ObjectSource, type PresetObject } from "@/lib/types";
import TemplatePicker, { PresetPreview } from "@/components/TemplatePicker";
import { categoryHasBothFormats, flatFormatLabel, resolvePresetForTier, type FormatPref } from "@/lib/presetMatch";

const ASSET_BUCKET = "assets";

const QUICK_FILL: Record<string, string[]> = {
  amida: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  box: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  darts: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
  garagara: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
  omikuji: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  scratch: ["大当たり", "当たり", "クーポン", "はずれ", "参加賞"],
  roulette: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  dice: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  treasure: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  slot: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  gacha: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  mallet: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  cat: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  daruma: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  lantern: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  firework: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  airlottery: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  fan: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  pachinko: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  jet: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  rocket: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  meteor: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  shuriken: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  dragon: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  iaido: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  ufo: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  cannon: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
  thunder: ["当たり", "大当たり", "クーポン", "はずれ", "参加賞"],
  punch: ["1等", "2等", "3等", "4等", "5等", "6等", "参加賞"],
};

interface Row {
  id: string;
  label: string;
  quantity: string;
  objectSource: ObjectSource;
  presetObjectId: string | null;
  customModelUrl: string | null;
  uploading: boolean;
}

function newRow(label = ""): Row {
  return {
    id: crypto.randomUUID(),
    label,
    quantity: "",
    objectSource: "preset",
    presetObjectId: null,
    customModelUrl: null,
    uploading: false,
  };
}

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

export default function BulkOrderCreator({ presets }: { presets: PresetObject[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [clientName, setClientName] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [renewalCheckDate, setRenewalCheckDate] = useState("");
  // 再表示までの間隔(時間)。空欄なら既定値(1時間)、"0" なら制限なし。
  // 一括作成ではこの設定を作成するすべての注文に同じ値で適用する。
  const [cooldownHours, setCooldownHours] = useState("");
  const [notes, setNotes] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("aframe");

  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [mindarError, setMindarError] = useState<string | null>(null);

  // MindARのコンパイラはESモジュールのため、通常の<script>では読み込めない
  // (詳細は lib/mindCompiler.ts のコメント)。専用ローダーで読み込む。
  useEffect(() => {
    let alive = true;
    ensureMindArCompiler()
      .then(() => alive && setMindarReady(true))
      .catch((e) => alive && setMindarError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [compiledTargetUrl, setCompiledTargetUrl] = useState<string | null>(null);
  const [compiledMindUrl, setCompiledMindUrl] = useState<string | null>(null);

  // 基本の流れ:「①カテゴリを1つ選ぶ → 景品ごとのテンプレートは自動で割り当てられる」。
  // 景品ごとに違うカテゴリを混ぜて使うことは通常ないため、行ごとの個別設定は折りたたんでおく。
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatPref>(null);
  const [advancedMode, setAdvancedMode] = useState(false);

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

  function selectCategory(category: string, format: FormatPref = null) {
    setSelectedCategory(category);
    setSelectedFormat(format);
    setRows(
      QUICK_FILL[category].map((label) => {
        const row = newRow(label);
        const preset = resolvePresetForTier(presets, category, label, format);
        if (preset) row.presetObjectId = preset.id;
        return row;
      })
    );
  }

  // 簡易モードで景品名を変更した場合、選択中のカテゴリ内で同じ名前のテンプレートを探し直す。
  function updateLabel(rowId: string, label: string) {
    const patch: Partial<Row> = { label };
    if (!advancedMode && selectedCategory) {
      const preset = resolvePresetForTier(presets, selectedCategory, label, selectedFormat);
      patch.presetObjectId = preset?.id ?? null;
      patch.objectSource = "preset";
    }
    updateRow(rowId, patch);
  }

  async function uploadToAssets(path: string, file: File | Blob, contentType?: string) {
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleRowUpload(rowId: string, file: File) {
    setError(null);
    updateRow(rowId, { uploading: true });
    try {
      const path = `batches/${rowId}/model${extOf(file.name)}`;
      const url = await uploadToAssets(path, file);
      updateRow(rowId, { customModelUrl: url, uploading: false });
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e.message ?? e}`);
      updateRow(rowId, { uploading: false });
    }
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
    const targetRows = rows.filter(
      (r) => r.label && (r.objectSource === "preset" ? r.presetObjectId : r.customModelUrl)
    );
    if (targetRows.length === 0) {
      setError("景品名とテンプレート(またはアップロードファイル)の両方が入った行が1つもありません");
      return;
    }

    setCreating(true);
    const created: { label: string; quantity: string; url: string }[] = [];
    try {
      for (const row of targetRows) {
        const hash = generateHash();

        const { error } = await supabase.from("orders").insert({
          hash,
          client_name: clientName,
          prize_label: row.label,
          order_date: orderDate,
          due_date: dueDate || null,
          person_in_charge: personInCharge || null,
          quantity: row.quantity ? Number(row.quantity) : null,
          renewal_check_date: renewalCheckDate || null,
          cooldown_hours: cooldownHours === "" ? null : Number(cooldownHours),
          notes: notes || null,
          display_type: displayType,
          object_source: row.objectSource,
          preset_object_id: row.objectSource === "preset" ? row.presetObjectId : null,
          custom_model_url: row.objectSource === "upload" ? row.customModelUrl : null,
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
      setError(`作成中にエラーが発生しました(一部は作成済みの可能性があります): ${e.message ?? e}`);
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
          <Link href="/admin/fukubiku" className="text-sm px-5 py-2 rounded-lg border hover:bg-slate-50">
            注文一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">

      <h1 className="text-lg font-bold">景品セット一括作成</h1>
      <p className="text-sm text-slate-500">
        1つのクライアントについて、「1等・2等・はずれ」のような複数の景品パターンをまとめて作成し、
        景品ごとに個別の注文・クライアント提供URLを一括発行します。ここで作る注文は
        <strong>景品ごとに固定のURL</strong>になります(1つのURLに複数の景品を割り当てて確率で抽選、
        という機能はここにはありません)。
      </p>

      <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-indigo-900">
          確率(%)で当たり外れを抽選したい場合はこちら
        </h2>
        <p className="text-sm text-indigo-800">
          1つのクライアント提供URLに対して「1等○%・2等○%・はずれ○%」のように確率(重み)を設定し、
          スキャンの都度サーバー側で抽選するタイプの景品セットは「確率抽選セット作成」から作成・編集できます。
          確率はパーセンテージ表示で、あとからいつでも管理画面で修正すれば次のスキャンから即座に反映されます。
        </p>
        <Link
          href="/admin/fukubiku/draws/new"
          className="inline-block mt-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          確率抽選セット作成へ進む →
        </Link>
      </section>

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
          <label className="space-y-1 block">
            <span className="text-sm font-medium">再表示までの間隔(時間)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="未入力なら1時間"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(e.target.value)}
              className="input"
            />
            <span className="text-xs text-slate-400 block">
              同じ人が共有URLを開き直しても、この時間が経つまでは結果を出さず
              「時間をおいて再チャレンジ」と案内します。0 で制限なし。
              ここで作成するすべての注文に同じ値が入ります。
            </span>
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
            {!mindarReady && (
              <p className={mindarError ? "text-xs text-red-600" : "text-xs text-slate-400"}>
                {mindarError ?? "コンパイラを読み込み中..."}
              </p>
            )}
            {compileProgress !== null && (
              <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>
            )}
            {compiledMindUrl && <p className="text-xs text-emerald-700">コンパイル済み</p>}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">① カテゴリを選ぶ</h2>
        <p className="text-xs text-slate-400">
          通常、1つの景品セットの中で景品ごとに違うゲーム(カテゴリ)を混ぜて使うことはないため、
          ここで1つ選ぶと景品ごとのテンプレートが自動で割り当てられます。
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_CATEGORIES.map((cat) =>
            categoryHasBothFormats(presets, cat.value) ? (
              <span key={cat.value} className="inline-flex rounded-full border overflow-hidden">
                <button
                  type="button"
                  onClick={() => selectCategory(cat.value, "glb")}
                  className={`text-xs px-3 py-1 ${
                    selectedCategory === cat.value && selectedFormat === "glb"
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {cat.label}（3Dオブジェクト）
                </button>
                <button
                  type="button"
                  onClick={() => selectCategory(cat.value, "flat")}
                  className={`text-xs px-3 py-1 border-l ${
                    selectedCategory === cat.value && selectedFormat === "flat"
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {cat.label}（{flatFormatLabel(presets, cat.value)}）
                </button>
              </span>
            ) : (
              <button
                key={cat.value}
                type="button"
                onClick={() => selectCategory(cat.value)}
                className={`text-xs px-3 py-1 rounded-full border ${
                  selectedCategory === cat.value ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
                }`}
              >
                {cat.label}
              </button>
            )
          )}
        </div>
        <label className="flex items-center gap-2 text-sm border-t pt-3">
          <input type="checkbox" checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />
          景品ごとに個別のテンプレートを設定する(通常は不要です)
        </label>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">② 景品リスト</h2>

        <div className="space-y-3">
          {rows.map((row) => {
            const preview = row.objectSource === "preset" ? presets.find((p) => p.id === row.presetObjectId) : null;
            const previewUrl = preview?.thumbnail_url || preview?.model_url || row.customModelUrl || "";
            return (
              <div key={row.id} className="space-y-2 border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    placeholder="景品名（例: 1等）"
                    value={row.label}
                    onChange={(e) => updateLabel(row.id, e.target.value)}
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
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    削除
                  </button>
                </div>
                {advancedMode ? (
                  <TemplatePicker
                    presets={presets}
                    objectSource={row.objectSource}
                    presetObjectId={row.presetObjectId}
                    customModelUrl={row.customModelUrl}
                    uploading={row.uploading}
                    onObjectSourceChange={(s) => updateRow(row.id, { objectSource: s })}
                    onPresetObjectIdChange={(id) => updateRow(row.id, { presetObjectId: id })}
                    onUploadFile={(file) => handleRowUpload(row.id, file)}
                  />
                ) : previewUrl ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-14 h-14 flex-shrink-0 overflow-hidden rounded">
                      <PresetPreview url={previewUrl} />
                    </div>
                    <span className="truncate">{preview?.name || row.customModelUrl}</span>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    {selectedCategory
                      ? "このテンプレートが見つかりませんでした。「景品ごとに個別のテンプレートを設定する」をオンにして選んでください。"
                      : "上でカテゴリを選ぶとテンプレートが自動で設定されます。"}
                  </p>
                )}
              </div>
            );
          })}
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
