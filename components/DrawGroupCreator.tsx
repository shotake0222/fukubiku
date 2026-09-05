"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import { generateHash } from "@/lib/hash";
import {
  DEFAULT_TIER_WEIGHTS,
  PRESET_CATEGORIES,
  type DisplayType,
  type ObjectSource,
  type PresetObject,
} from "@/lib/types";
import TemplatePicker, { PresetPreview } from "@/components/TemplatePicker";
import { categoryHasBothFormats, resolvePresetForTier, type FormatPref } from "@/lib/presetMatch";

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
};

interface Row {
  id: string;
  label: string;
  weight: string;
  objectSource: ObjectSource;
  presetObjectId: string | null;
  customModelUrl: string | null;
  uploading: boolean;
}

function defaultWeightFor(label: string): string {
  return label && DEFAULT_TIER_WEIGHTS[label] != null ? String(DEFAULT_TIER_WEIGHTS[label]) : "1";
}

function newRow(label = ""): Row {
  return {
    id: crypto.randomUUID(),
    label,
    weight: defaultWeightFor(label),
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

export default function DrawGroupCreator({ presets }: { presets: PresetObject[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [clientName, setClientName] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [renewalCheckDate, setRenewalCheckDate] = useState("");
  const [notes, setNotes] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("aframe");

  const [mindarReady, setMindarReady] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [compiledTargetUrl, setCompiledTargetUrl] = useState<string | null>(null);
  const [compiledMindUrl, setCompiledMindUrl] = useState<string | null>(null);

  // 基本の流れ:「①カテゴリを1つ選ぶ → 景品ごとのテンプレートは自動で割り当てられる →
  // ②確率(重み)だけを見て調整する」。景品ごとに違うカテゴリを混ぜて使うことは通常ないため、
  // テンプレートを行ごとに個別設定できるのはあくまで例外的な機能として折りたたんでおく。
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatPref>(null);
  const [advancedMode, setAdvancedMode] = useState(false);

  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

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

  // カテゴリを選ぶと、そのカテゴリの定番の景品名で行を埋め、それぞれ該当するテンプレートを
  // 自動で割り当てる(名前に景品名を含むテンプレートを探す。3Dオブジェクト版があれば優先)。
  function selectCategory(category: string, format: FormatPref = null) {
    setSelectedCategory(category);
    setSelectedFormat(format);
    const labels = QUICK_FILL[category] ?? [];
    setRows(
      labels.map((label) => {
        const row = newRow(label);
        const preset = resolvePresetForTier(presets, category, label, format);
        if (preset) {
          row.presetObjectId = preset.id;
        }
        return row;
      })
    );
  }

  // 簡易モードで景品名を変更した場合、選択中のカテゴリ内で同じ名前のテンプレートを
  // 探し直す(見つからなければテンプレート未設定のままになるので、詳細設定で選んでもらう)。
  function updateLabel(rowId: string, label: string) {
    const patch: Partial<Row> = { label, weight: defaultWeightFor(label) };
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
      const path = `draw_batches/${rowId}/model${extOf(file.name)}`;
      const url = await uploadToAssets(path, file);
      updateRow(rowId, { customModelUrl: url, uploading: false });
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e.message ?? e}`);
      updateRow(rowId, { uploading: false });
    }
  }

  async function handleTargetUpload(file: File) {
    setError(null);
    setCompileProgress(0);
    try {
      const batchId = crypto.randomUUID();
      const imgPath = `draw_batches/${batchId}/target-original${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setCompiledTargetUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `draw_batches/${batchId}/target.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
      setCompiledMindUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  async function handleCreate() {
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
    if (targetRows.some((r) => !r.weight || Number(r.weight) < 0 || Number.isNaN(Number(r.weight)))) {
      setError("確率(重み)には0以上の数値を入力してください");
      return;
    }

    setCreating(true);
    try {
      const hash = generateHash();
      const { data: group, error: groupError } = await supabase
        .from("draw_groups")
        .insert({
          hash,
          client_name: clientName,
          order_date: orderDate,
          due_date: dueDate || null,
          person_in_charge: personInCharge || null,
          renewal_check_date: renewalCheckDate || null,
          notes: notes || null,
          display_type: displayType,
          target_image_url: displayType === "mindar" ? compiledTargetUrl : null,
          mind_file_url: displayType === "mindar" ? compiledMindUrl : null,
          status: "ready",
        })
        .select("id")
        .single();
      if (groupError || !group) throw groupError ?? new Error("作成に失敗しました");

      const entries = targetRows.map((row, i) => ({
        draw_group_id: group.id,
        label: row.label,
        weight: Number(row.weight),
        object_source: row.objectSource,
        preset_object_id: row.objectSource === "preset" ? row.presetObjectId : null,
        custom_model_url: row.objectSource === "upload" ? row.customModelUrl : null,
        sort_order: i,
      }));
      const { error: entriesError } = await supabase.from("draw_group_entries").insert(entries);
      if (entriesError) throw entriesError;

      setResultUrl(`${siteOrigin}/v/${hash}`);
    } catch (e: any) {
      setError(`作成中にエラーが発生しました: ${e.message ?? e}`);
    } finally {
      setCreating(false);
    }
  }

  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  function pct(weight: string) {
    const w = Number(weight) || 0;
    if (totalWeight <= 0) return "-";
    return `${Math.round((w / totalWeight) * 1000) / 10}%`;
  }

  if (resultUrl) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-lg font-bold">作成完了</h1>
        <p className="text-sm text-slate-500">
          共有URLを1つ発行しました。このURLに誰がアクセスしても、その都度サーバーが下記の確率(重み)に従って結果を抽選します。
        </p>
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-2">
          <code className="text-sm bg-slate-100 rounded px-2 py-1 break-all flex-1">{resultUrl}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(resultUrl)}
            className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 whitespace-nowrap"
          >
            コピー
          </button>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/fukubiku/draws" className="text-sm px-5 py-2 rounded-lg border hover:bg-slate-50">
            抽選セット一覧に戻る
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

      <h1 className="text-lg font-bold">確率抽選セット作成</h1>
      <p className="text-sm text-slate-500">
        1つのクライアントについて、共有URL(QRコード)を1つだけ発行します。誰かがそのURLにアクセスするたびに、
        サーバーが下の「確率(重み)」に従ってその都度結果を抽選します。基本の流れは、下でカテゴリを1つ選べば
        景品ごとのテンプレートは自動で設定されるので、あとは確率を見て調整するだけです。
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
                name="drawDisplayType"
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
              全景品で共通のターゲット画像を1枚アップロードしてください（景品ごとの表示物は下のリストで指定します）。
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
        <h2 className="font-semibold">① カテゴリを選ぶ</h2>
        <p className="text-xs text-slate-400">
          通常、1つの抽選セットの中で景品ごとに違うゲーム(カテゴリ)を混ぜて使うことはないため、
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
                  onClick={() => selectCategory(cat.value, "mp4")}
                  className={`text-xs px-3 py-1 border-l ${
                    selectedCategory === cat.value && selectedFormat === "mp4"
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {cat.label}（MP4）
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
        <h2 className="font-semibold">② 景品リストと確率(重み)</h2>
        <p className="text-xs text-slate-400">
          「確率(重み)」は相対値です。合計を100にする必要はありません(例: 1等=1, 2等=2, 参加賞=90 のように、
          他の行との比率だけが意味を持ちます)。右側にはその重みが実際に何%に相当するかを表示しています。
          現在の合計: {totalWeight || 0}
        </p>

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
                  <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                    確率(重み)
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.weight}
                      onChange={(e) => updateRow(row.id, { weight: e.target.value })}
                      className="input w-20"
                    />
                  </label>
                  <span className="text-xs text-slate-500 whitespace-nowrap w-12 text-right">
                    {pct(row.weight)}
                  </span>
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
        onClick={handleCreate}
        disabled={creating}
        className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
      >
        {creating ? "作成中..." : "抽選セットを作成"}
      </button>
    </div>
  );
}
