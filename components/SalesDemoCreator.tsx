"use client";

import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget, ensureMindArCompiler } from "@/lib/mindCompiler";
import { generateHash } from "@/lib/hash";
import {
  DEFAULT_TIER_WEIGHTS,
  PRESET_CATEGORIES,
  type DisplayType,
  type ObjectSource,
  type PresetObject,
} from "@/lib/types";
import { PresetPreview } from "@/components/TemplatePicker";
import { categoryHasBothFormats, flatFormatLabel, resolvePresetForTier, type FormatPref } from "@/lib/presetMatch";

const ASSET_BUCKET = "assets";

// DrawGroupCreator と同じ「カテゴリ→定番の景品名」の対応表。
// 営業デモでも同じテンプレート自動割り当てのロジックをそのまま使う。
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
  weight: string;
  presetObjectId: string | null;
}

function defaultWeightFor(label: string): string {
  return label && DEFAULT_TIER_WEIGHTS[label] != null ? String(DEFAULT_TIER_WEIGHTS[label]) : "1";
}

function newRow(label = ""): Row {
  return {
    id: crypto.randomUUID(),
    label,
    weight: defaultWeightFor(label),
    presetObjectId: null,
  };
}

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

// 営業デモ用の画面。①カテゴリ ②マーカー/表示方式 ③確率(重み) ④Cookie(再抽選間隔)を
// 選んで「表示」を押すと、その場で draw_groups/draw_group_entries を作成し、
// 結果画面を挟まずこの端末をそのまま /v/[hash] (実際の閲覧ページ)へ遷移させる。
// マーカーにスマホをかざせばその場でお客様にデモを見せられる、という想定。
export default function SalesDemoCreator({ presets }: { presets: PresetObject[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [displayType, setDisplayType] = useState<DisplayType>("aframe");

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

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatPref>(null);

  const [rows, setRows] = useState<Row[]>([]);

  // デモは同じ端末で何度も見せ直すことが多いため、Cookie(再抽選クールダウン)は
  // 初期値0(=事実上無効)にしておく。0のときは getRemainingCooldownMs が常に0を返すため、
  // 新しいスキーマ/ロジックを追加せずに「Cookie無効」を表現できる。
  const [cooldownHours, setCooldownHours] = useState("0");

  // 表示オブジェクトの大きさ。商談中に「もう少し大きく」と言われた時に、
  // DBやプリセットを触らずその場で見比べられるよう、閲覧ページには
  // /v/[hash]?scale=... というクエリで渡す(空欄ならプリセット/既定値のまま)。
  const [demoScale, setDemoScale] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function updateLabel(rowId: string, label: string) {
    const patch: Partial<Row> = { label, weight: defaultWeightFor(label) };
    if (selectedCategory) {
      const preset = resolvePresetForTier(presets, selectedCategory, label, selectedFormat);
      patch.presetObjectId = preset?.id ?? null;
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

  async function handleTargetUpload(file: File) {
    setError(null);
    setCompileProgress(0);
    try {
      const batchId = crypto.randomUUID();
      const imgPath = `sales_demo/${batchId}/target-original${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setCompiledTargetUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `sales_demo/${batchId}/target.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
      setCompiledMindUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  async function handleShow() {
    setError(null);
    if (!selectedCategory) {
      setError("カテゴリを選んでください");
      return;
    }
    if (displayType === "mindar" && !compiledMindUrl) {
      setError("MindARの場合は先にターゲット画像をアップロード・コンパイルしてください");
      return;
    }
    const targetRows = rows.filter((r) => r.label && r.presetObjectId);
    if (targetRows.length === 0) {
      setError("このカテゴリのテンプレートが見つかりませんでした。カテゴリを選び直してください");
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
          // 営業デモにはクライアント名などの管理項目はないが、client_name は
          // NOT NULL 制約があるため、実行日時から自動的に埋める。
          client_name: `営業デモ ${new Date().toLocaleString("ja-JP")}`,
          notes: "営業デモ画面(/admin/sales)から作成",
          cooldown_hours: cooldownHours ? Number(cooldownHours) : 0,
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
        object_source: "preset" as ObjectSource,
        preset_object_id: row.presetObjectId,
        custom_model_url: null,
        sort_order: i,
      }));
      const { error: entriesError } = await supabase.from("draw_group_entries").insert(entries);
      if (entriesError) throw entriesError;

      // 結果URLをコピーする画面は挟まず、この端末をそのまま実際の閲覧ページへ遷移させる。
      // マーカー(またはターゲット画像)にかざせばその場でデモが見られる。
      const scaleQuery = demoScale.trim() ? `?scale=${encodeURIComponent(demoScale.trim())}` : "";
      window.location.href = `/v/${hash}${scaleQuery}`;
    } catch (e: any) {
      setError(`作成中にエラーが発生しました: ${e.message ?? e}`);
      setCreating(false);
    }
  }

  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  function pct(weight: string) {
    const w = Number(weight) || 0;
    if (totalWeight <= 0) return "-";
    return `${Math.round((w / totalWeight) * 1000) / 10}%`;
  }

  return (
    <div className="max-w-3xl space-y-6">

      <h1 className="text-lg font-bold">営業デモ</h1>
      <p className="text-sm text-slate-500">
        カテゴリ・マーカー(表示方式)・確率・Cookie(再抽選までの間隔)を選んで「表示」を押すと、
        この端末がそのままAR表示画面に切り替わります。マーカー(またはターゲット画像)にスマホをかざせば、
        その場でお客様にデモをお見せできます。
      </p>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">① カテゴリを選ぶ</h2>
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
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">② マーカー(表示方式)を選ぶ</h2>
        <div className="flex gap-4">
          {(["aframe", "mindar"] as DisplayType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="salesDisplayType"
                checked={displayType === t}
                onChange={() => setDisplayType(t)}
              />
              {t === "aframe" ? "共通マーカー画像でAR表示" : "任意の画像をターゲットにしてAR表示(MindAR)"}
            </label>
          ))}
        </div>
        {displayType === "mindar" && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm text-slate-500">デモで使うターゲット画像を1枚アップロードしてください。</p>
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

      {rows.length > 0 && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold">③ 確率(重み)を確認・調整する</h2>
          <p className="text-xs text-slate-400">
            相対値です。合計を100にする必要はありません。現在の合計: {totalWeight || 0}
          </p>
          <div className="space-y-3">
            {rows.map((row) => {
              const preset = presets.find((p) => p.id === row.presetObjectId);
              const previewUrl = preset?.thumbnail_url || preset?.model_url || "";
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
                  {previewUrl ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-14 h-14 flex-shrink-0 overflow-hidden rounded">
                        <PresetPreview url={previewUrl} />
                      </div>
                      <span className="truncate">{preset?.name}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">
                      このテンプレートが見つかりませんでした。景品名を調整するか、上でカテゴリを選び直してください。
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
      )}

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">④ Cookie(再抽選までの間隔)を選ぶ</h2>
        <label className="space-y-1 block max-w-xs">
          <span className="text-sm font-medium">再抽選までの間隔(時間)</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={cooldownHours}
            onChange={(e) => setCooldownHours(e.target.value)}
            className="input"
          />
          <span className="text-xs text-slate-400 block">
            0にすると毎回すぐに再抽選できます(デモ向けの初期値)。本番同様の間隔を試したい場合は
            時間数を入力してください(例: 1なら1時間に1回、本番の設定と同じ仕組みです)。
          </span>
        </label>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">⑤ オブジェクトの大きさ(任意)</h2>
        <p className="text-xs text-slate-500">
          マーカーに表示される3Dオブジェクトの大きさです。数値が大きいほど大きく表示されます。
          空欄のままなら、表示オブジェクト管理で設定したサイズ(未設定なら既定サイズ)が使われます。
          ここでの指定はこのデモURLにのみ効くので、テンプレート自体の設定は変わりません。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {["0.25", "0.5", "1", "2", "4"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setDemoScale(v)}
              className={`text-xs px-3 py-1 rounded-full border ${
                demoScale === v ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
              }`}
            >
              ×{v}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDemoScale("")}
            className={`text-xs px-3 py-1 rounded-full border ${
              demoScale === "" ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
            }`}
          >
            既定のまま
          </button>
        </div>
        <label className="space-y-1 block max-w-xs">
          <span className="text-sm font-medium">数値で指定</span>
          <input
            value={demoScale}
            onChange={(e) => setDemoScale(e.target.value)}
            placeholder="例: 0.5 (空欄なら既定サイズ)"
            className="input"
          />
          <span className="text-xs text-slate-400 block">
            表示中でもアドレスバーの末尾の ?scale=0.5 を書き換えて再読み込みすれば、
            その場で大きさを試せます。ちょうど良い値が決まったら、表示オブジェクト管理の
            サイズ欄に同じ値を入れておくと次回以降の既定になります。
          </span>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleShow}
        disabled={creating}
        className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
      >
        {creating ? "準備中..." : "表示"}
      </button>
    </div>
  );
}
