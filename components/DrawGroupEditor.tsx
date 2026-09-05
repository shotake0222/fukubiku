"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import type { DisplayType, DrawGroup, DrawGroupEntry, ObjectSource, PresetObject } from "@/lib/types";
import { DEFAULT_TIER_WEIGHTS } from "@/lib/types";
import TemplatePicker from "@/components/TemplatePicker";

const ASSET_BUCKET = "assets";

interface Row {
  id: string; // 既存entryのid、もしくは新規行用のクライアント側一時id(uuid)
  isNew: boolean;
  label: string;
  weight: string;
  objectSource: ObjectSource;
  presetObjectId: string | null;
  customModelUrl: string | null;
  uploading: boolean;
}

function rowFromEntry(e: DrawGroupEntry): Row {
  return {
    id: e.id,
    isNew: false,
    label: e.label,
    weight: String(e.weight),
    objectSource: e.object_source,
    presetObjectId: e.preset_object_id,
    customModelUrl: e.custom_model_url,
    uploading: false,
  };
}

function newRow(): Row {
  return {
    id: crypto.randomUUID(),
    isNew: true,
    label: "",
    weight: "1",
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

export default function DrawGroupEditor({
  group,
  entries,
  presets,
}: {
  group: DrawGroup;
  entries: DrawGroupEntry[];
  presets: PresetObject[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [clientName, setClientName] = useState(group.client_name);
  const [dueDate, setDueDate] = useState(group.due_date ?? "");
  const [personInCharge, setPersonInCharge] = useState(group.person_in_charge ?? "");
  const [renewalCheckDate, setRenewalCheckDate] = useState(group.renewal_check_date ?? "");
  const [notes, setNotes] = useState(group.notes ?? "");
  const [displayType, setDisplayType] = useState<DisplayType>(group.display_type);
  const [targetImageUrl, setTargetImageUrl] = useState(group.target_image_url);
  const [mindFileUrl, setMindFileUrl] = useState(group.mind_file_url);
  const [mindarReady, setMindarReady] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);

  const [rows, setRows] = useState<Row[]>(
    entries.length ? entries.map(rowFromEntry) : [newRow(), newRow(), newRow()]
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";
  const viewerUrl = `${siteOrigin}/v/${group.hash}`;
  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(row: Row) {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (!row.isNew) setRemovedIds((prev) => [...prev, row.id]);
  }

  function applyDefaultWeight(rowId: string, label: string) {
    const patch: Partial<Row> = { label };
    if (DEFAULT_TIER_WEIGHTS[label] != null) {
      patch.weight = String(DEFAULT_TIER_WEIGHTS[label]);
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
      const path = `draw_batches/${group.id}/${rowId}/model${extOf(file.name)}`;
      const url = await uploadToAssets(path, file);
      updateRow(rowId, { customModelUrl: url, uploading: false });
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e.message ?? e}`);
      updateRow(rowId, { uploading: false });
    }
  }

  async function handleTargetImageUpload(file: File) {
    setError(null);
    setCompileProgress(0);
    try {
      const imgPath = `draw_batches/${group.id}/target-original-${Date.now()}${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setTargetImageUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `draw_batches/${group.id}/target-${Date.now()}.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
      setMindFileUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  async function handleSave() {
    setError(null);
    setSaveOk(false);

    const validRows = rows.filter(
      (r) => r.label && (r.objectSource === "preset" ? r.presetObjectId : r.customModelUrl)
    );
    if (validRows.length === 0) {
      setError("景品名とテンプレート(またはアップロードファイル)の両方が入った行が1つも残っていません");
      return;
    }
    if (validRows.some((r) => !r.weight || Number(r.weight) < 0 || Number.isNaN(Number(r.weight)))) {
      setError("確率(重み)には0以上の数値を入力してください");
      return;
    }
    if (displayType === "mindar" && !mindFileUrl) {
      setError("MindARの場合はターゲット画像のアップロード・コンパイルが必要です");
      return;
    }

    setSaving(true);
    try {
      const { error: groupError } = await supabase
        .from("draw_groups")
        .update({
          client_name: clientName,
          due_date: dueDate || null,
          person_in_charge: personInCharge || null,
          renewal_check_date: renewalCheckDate || null,
          notes: notes || null,
          display_type: displayType,
          target_image_url: displayType === "mindar" ? targetImageUrl : null,
          mind_file_url: displayType === "mindar" ? mindFileUrl : null,
          status: "ready",
        })
        .eq("id", group.id);
      if (groupError) throw groupError;

      // 新しい行の内容でentriesを丸ごと入れ替える。insertが成功してから既存分を
      // 削除する順序にし、途中で失敗しても抽選セットが一時的に空にならないようにする。
      const newEntries = validRows.map((row, i) => ({
        draw_group_id: group.id,
        label: row.label,
        weight: Number(row.weight),
        object_source: row.objectSource,
        preset_object_id: row.objectSource === "preset" ? row.presetObjectId : null,
        custom_model_url: row.objectSource === "upload" ? row.customModelUrl : null,
        sort_order: i,
      }));
      const { error: insertError } = await supabase.from("draw_group_entries").insert(newEntries);
      if (insertError) throw insertError;

      const idsToRemove = [...removedIds, ...validRows.filter((r) => !r.isNew).map((r) => r.id)];
      if (idsToRemove.length) {
        const { error: deleteError } = await supabase
          .from("draw_group_entries")
          .delete()
          .in("id", idsToRemove);
        if (deleteError) throw deleteError;
      }

      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
      router.refresh();
    } catch (e: any) {
      setError(`保存に失敗しました: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(viewerUrl);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1500);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Script
        src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"
        strategy="afterInteractive"
        onLoad={() => setMindarReady(true)}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">抽選セット編集: {group.client_name || "(未設定)"}</h1>
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            group.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {group.status === "ready" ? "公開準備完了" : "下書き"}
        </span>
      </div>

      <p className="text-sm text-slate-500">
        ここで確率(重み)やテンプレートを変更して保存すると、共有URLへの次のアクセスから即座に新しい内容が反映されます。
      </p>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">共通の注文情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">クライアント名 *</span>
            <input required value={clientName} onChange={(e) => setClientName(e.target.value)} className="input" />
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
                name="drawDisplayTypeEdit"
                checked={displayType === t}
                onChange={() => setDisplayType(t)}
              />
              {t === "aframe" ? "A-Frame（共通マーカー画像でAR表示）" : "MindAR（画像トラッキングAR）"}
            </label>
          ))}
        </div>
        {displayType === "mindar" && (
          <div className="space-y-2 border-t pt-4">
            <input
              type="file"
              accept="image/*"
              disabled={!mindarReady}
              onChange={(e) => e.target.files?.[0] && handleTargetImageUpload(e.target.files[0])}
            />
            {!mindarReady && <p className="text-xs text-slate-400">コンパイラを読み込み中...</p>}
            {compileProgress !== null && (
              <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>
            )}
            {targetImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetImageUrl} alt="target" className="h-24 rounded border" />
            )}
            {mindFileUrl && <p className="text-xs text-emerald-700 break-all">コンパイル済み: {mindFileUrl}</p>}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">景品リストと確率(重み)</h2>
        </div>
        <p className="text-xs text-slate-400">
          「確率(重み)」は相対値です(合計を100にする必要はありません)。現在の合計: {totalWeight || 0}
        </p>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="space-y-2 border rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="景品名（例: 1等）"
                  value={row.label}
                  onChange={(e) => applyDefaultWeight(row.id, e.target.value)}
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
                <button
                  type="button"
                  onClick={() => removeRow(row)}
                  className="text-xs text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
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
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow} className="text-sm px-3 py-1 rounded-lg border hover:bg-slate-50">
          + 行を追加
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saveOk && <span className="text-sm text-emerald-700">保存しました。次のアクセスから反映されます。</span>}
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-2">
        <h2 className="font-semibold">クライアント提供URL(共有)</h2>
        <div className="flex items-center gap-2">
          <code className="text-sm bg-slate-100 rounded px-2 py-1 break-all">{viewerUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 whitespace-nowrap"
          >
            {copyOk ? "コピーしました" : "コピー"}
          </button>
        </div>
      </section>
    </div>
  );
}
