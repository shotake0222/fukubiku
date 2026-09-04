"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import type {
  AttendDisplayType,
  AttendExperienceStatus,
  AttendItem,
  AttendMarker,
  AttendProject,
  AttendTriggerObject,
  AttendTriggerWithObjects,
  ObjectSource,
  PresetObject,
} from "@/lib/types";
import { ATTEND_DISPLAY_TYPES, FACE_ANCHOR_PRESETS, PRESET_CATEGORIES } from "@/lib/types";

const ASSET_BUCKET = "assets";
const UNCATEGORIZED = "__uncategorized__";

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function categoryLabel(value: string) {
  if (value === UNCATEGORIZED) return "未分類";
  const found = PRESET_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value;
}

function Thumb({ url }: { url: string | null }) {
  if (!url) return <div className="w-14 h-14 bg-slate-100 rounded shrink-0" />;
  if (/\.mp4(\?|$)/i.test(url)) {
    return (
      <video src={url} className="w-14 h-14 object-cover rounded bg-slate-100 shrink-0" autoPlay muted loop playsInline />
    );
  }
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-14 h-14 object-cover rounded shrink-0" />;
  }
  return <div className="w-14 h-14 bg-slate-200 rounded shrink-0 flex items-center justify-center text-[9px] text-slate-500">3D</div>;
}

async function uploadToAssets(supabase: ReturnType<typeof createClient>, path: string, file: File | Blob, contentType?: string) {
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, { upsert: true, contentType });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---- オブジェクト行 ----

function ObjectRow({
  itemHash,
  object,
  presets,
  onDeleted,
}: {
  itemHash: string;
  object: AttendTriggerObject;
  presets: PresetObject[];
  onDeleted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [objectSource, setObjectSource] = useState<ObjectSource>(object.object_source);
  const [presetObjectId, setPresetObjectId] = useState<string | null>(object.preset_object_id);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(object.custom_model_url);
  const [position, setPosition] = useState(object.position || "0 0.6 0");
  const [scale, setScale] = useState(object.scale || "");
  const [rotationY, setRotationY] = useState(String(object.rotation_y ?? 0));
  const [category, setCategory] = useState<string>(
    presets.find((p) => p.id === object.preset_object_id)?.category || PRESET_CATEGORIES[0]?.value || UNCATEGORIZED
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoriesInUse = useMemo(() => {
    const set = new Set(presets.map((p) => p.category || UNCATEGORIZED));
    return [
      ...PRESET_CATEGORIES.map((c) => c.value).filter((v) => set.has(v)),
      ...Array.from(set).filter((v) => !PRESET_CATEGORIES.some((c) => c.value === v)),
    ];
  }, [presets]);
  const presetsInCategory = presets.filter((p) => (p.category || UNCATEGORIZED) === category);
  const currentPreset = presets.find((p) => p.id === presetObjectId) || null;

  async function patch(fields: Record<string, any>) {
    const { error } = await supabase.from("attend_trigger_objects").update(fields).eq("id", object.id);
    if (error) setError(`保存に失敗しました: ${error.message}`);
  }

  async function handleSelectPreset(id: string) {
    setPresetObjectId(id);
    setObjectSource("preset");
    await patch({ object_source: "preset", preset_object_id: id, custom_model_url: null });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = `attend/${itemHash}/object-${object.id}-${Date.now()}${extOf(file.name) || ".glb"}`;
      const url = await uploadToAssets(supabase, path, file);
      setCustomModelUrl(url);
      setObjectSource("upload");
      await patch({ object_source: "upload", custom_model_url: url, preset_object_id: null });
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e.message ?? e}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("このオブジェクトを削除しますか？")) return;
    setDeleting(true);
    const { error } = await supabase.from("attend_trigger_objects").delete().eq("id", object.id);
    setDeleting(false);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    onDeleted();
  }

  const previewUrl = objectSource === "preset" ? currentPreset?.thumbnail_url || currentPreset?.model_url || null : customModelUrl;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
      <div className="flex gap-3">
        <Thumb url={previewUrl} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1">
              <input type="radio" checked={objectSource === "preset"} onChange={() => setObjectSource("preset")} />
              テンプレート
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={objectSource === "upload"} onChange={() => setObjectSource("upload")} />
              アップロード
            </label>
            <button type="button" onClick={handleDelete} disabled={deleting} className="ml-auto text-red-600 hover:underline">
              削除
            </button>
          </div>

          {objectSource === "preset" ? (
            <div className="flex gap-2 flex-wrap items-center">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-xs py-1">
                {categoriesInUse.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
              <select
                value={presetObjectId ?? ""}
                onChange={(e) => e.target.value && handleSelectPreset(e.target.value)}
                className="input text-xs py-1 flex-1 min-w-[8rem]"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {presetsInCategory.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="file"
                accept=".glb,.gltf,video/mp4,image/gif,image/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                className="text-xs"
              />
              {uploading && <p className="text-xs text-slate-500">アップロード中...</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] text-slate-500 space-y-0.5 block">
              位置(x y z)
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onBlur={() => patch({ position })}
                className="input text-xs py-1"
              />
            </label>
            <label className="text-[10px] text-slate-500 space-y-0.5 block">
              大きさ(任意, x y z)
              <input
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                onBlur={() => patch({ scale: scale || null })}
                placeholder="既定値"
                className="input text-xs py-1"
              />
            </label>
            <label className="text-[10px] text-slate-500 space-y-0.5 block">
              回転(度)
              <input
                value={rotationY}
                onChange={(e) => setRotationY(e.target.value)}
                onBlur={() => patch({ rotation_y: Number(rotationY) || 0 })}
                className="input text-xs py-1"
              />
            </label>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---- 発火条件カード ----

function TriggerCard({
  itemHash,
  trigger,
  presets,
  markers,
  onDeleted,
  onObjectsChanged,
}: {
  itemHash: string;
  trigger: AttendTriggerWithObjects;
  presets: PresetObject[];
  markers: AttendMarker[];
  onDeleted: () => void;
  onObjectsChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [label, setLabel] = useState(trigger.label ?? "");
  const [displayType, setDisplayType] = useState<AttendDisplayType>(trigger.display_type);
  const [markerUrl, setMarkerUrl] = useState<string | null>(trigger.marker_url);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(trigger.target_image_url);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(trigger.mind_file_url);
  const [faceAnchorIndex, setFaceAnchorIndex] = useState<number>(trigger.face_anchor_index ?? 10);
  const [gpsLat, setGpsLat] = useState(trigger.gps_lat != null ? String(trigger.gps_lat) : "");
  const [gpsLng, setGpsLng] = useState(trigger.gps_lng != null ? String(trigger.gps_lng) : "");
  const [gpsRadius, setGpsRadius] = useState(String(trigger.gps_radius_m ?? 20));

  const aframeMarkers = markers.filter((m) => m.type === "aframe");
  const mindarMarkers = markers.filter((m) => m.type === "mindar_image");

  const [markerUploading, setMarkerUploading] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingObject, setAddingObject] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  async function handleMarkerUpload(file: File) {
    setError(null);
    setMarkerUploading(true);
    try {
      const path = `attend/${itemHash}/trigger-${trigger.id}/marker-${Date.now()}${extOf(file.name) || ".patt"}`;
      const url = await uploadToAssets(supabase, path, file, "text/plain");
      setMarkerUrl(url);
    } catch (e: any) {
      setError(`マーカーのアップロードに失敗しました: ${e.message ?? e}`);
    } finally {
      setMarkerUploading(false);
    }
  }

  async function handleTargetImageUpload(file: File) {
    setError(null);
    setCompileProgress(0);
    try {
      const imgPath = `attend/${itemHash}/trigger-${trigger.id}/target-original-${Date.now()}${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(supabase, imgPath, file, file.type || "image/jpeg");
      setTargetImageUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `attend/${itemHash}/trigger-${trigger.id}/target-${Date.now()}.mind`;
      const mindUrl = await uploadToAssets(supabase, mindPath, blob, "application/octet-stream");
      setMindFileUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError("この端末では位置情報を取得できません");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(String(pos.coords.latitude));
        setGpsLng(String(pos.coords.longitude));
        setLocating(false);
      },
      (err) => {
        setError(`現在地の取得に失敗しました: ${err.message}`);
        setLocating(false);
      }
    );
  }

  async function handleSaveTrigger() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("attend_triggers")
      .update({
        label: label || null,
        display_type: displayType,
        marker_url: displayType === "aframe" ? markerUrl : null,
        target_image_url: displayType === "mindar_image" ? targetImageUrl : null,
        mind_file_url: displayType === "mindar_image" ? mindFileUrl : null,
        face_anchor_index: displayType === "mindar_face" ? faceAnchorIndex : null,
        gps_lat: displayType === "gps" && gpsLat ? Number(gpsLat) : null,
        gps_lng: displayType === "gps" && gpsLng ? Number(gpsLng) : null,
        gps_radius_m: displayType === "gps" && gpsRadius ? Number(gpsRadius) : null,
      })
      .eq("id", trigger.id);
    setSaving(false);
    if (error) {
      setError(`保存に失敗しました: ${error.message}`);
      return;
    }
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 1500);
  }

  async function handleDeleteTrigger() {
    if (!confirm("この発火条件を削除しますか？（内包するオブジェクトも削除されます）")) return;
    setDeleting(true);
    const { error } = await supabase.from("attend_triggers").delete().eq("id", trigger.id);
    setDeleting(false);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    onDeleted();
  }

  async function handleAddObject() {
    setAddingObject(true);
    setError(null);
    const { error } = await supabase.from("attend_trigger_objects").insert({
      trigger_id: trigger.id,
      object_source: "preset",
      position: "0 0.6 0",
      rotation_y: 0,
      sort_order: trigger.objects.length,
    });
    setAddingObject(false);
    if (error) {
      setError(`オブジェクトの追加に失敗しました: ${error.message}`);
      return;
    }
    onObjectsChanged();
  }

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-white">
      <Script
        src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"
        strategy="afterInteractive"
        onLoad={() => setMindarReady(true)}
      />

      <div className="flex items-center justify-between gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="発火条件のラベル（例: 本殿前GPS）"
          className="input font-medium flex-1"
        />
        <button type="button" onClick={handleDeleteTrigger} disabled={deleting} className="text-xs text-red-600 hover:underline whitespace-nowrap">
          発火条件を削除
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {ATTEND_DISPLAY_TYPES.map((t) => (
          <label
            key={t.value}
            className={`flex items-start gap-2 text-xs border rounded-lg p-2 cursor-pointer ${
              displayType === t.value ? "border-slate-900 ring-1 ring-slate-900" : ""
            }`}
          >
            <input type="radio" className="mt-0.5" checked={displayType === t.value} onChange={() => setDisplayType(t.value)} />
            <span>
              <span className="block font-medium">{t.label}</span>
              <span className="block text-[10px] text-slate-500">{t.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {displayType === "aframe" && (
        <div className="space-y-2 text-sm">
          <p className="text-xs text-slate-500">未指定の場合は共通の既定マーカーが使われます。</p>
          {aframeMarkers.length > 0 && (
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-600">この案件に登録済みのマーカーから選択</span>
              <select
                className="input text-xs"
                defaultValue=""
                onChange={(e) => {
                  const m = aframeMarkers.find((mm) => mm.id === e.target.value);
                  if (m) setMarkerUrl(m.pattern_file_url);
                }}
              >
                <option value="" disabled>
                  選択してください（{aframeMarkers.length}件登録済み）
                </option>
                {aframeMarkers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-slate-400">
            または新しく.pattファイルをアップロード（
            <a href="/admin/attend/markers" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              マーカー管理
            </a>
            に登録してこの案件で使い回すこともできます）
          </p>
          <input
            type="file"
            accept=".patt"
            disabled={markerUploading}
            onChange={(e) => e.target.files?.[0] && handleMarkerUpload(e.target.files[0])}
          />
          {markerUploading && <p className="text-xs text-slate-500">アップロード中...</p>}
          {markerUrl && <p className="text-xs text-emerald-700 break-all">設定済み: {markerUrl}</p>}
        </div>
      )}

      {displayType === "mindar_face" && (
        <div className="space-y-1 text-sm">
          <select value={faceAnchorIndex} onChange={(e) => setFaceAnchorIndex(Number(e.target.value))} className="input">
            {FACE_ANCHOR_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}（anchorIndex: {p.value}）
              </option>
            ))}
          </select>
        </div>
      )}

      {displayType === "gps" && (
        <div className="space-y-2 text-sm">
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} placeholder="緯度" className="input" />
            <input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} placeholder="経度" className="input" />
            <input value={gpsRadius} onChange={(e) => setGpsRadius(e.target.value)} placeholder="半径(m)" className="input" />
          </div>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {locating ? "取得中..." : "現在地を取得"}
          </button>
        </div>
      )}

      {displayType === "mindar_image" && (
        <div className="space-y-2 text-sm">
          {mindarMarkers.length > 0 && (
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-600">この案件に登録済みのターゲット画像から選択</span>
              <select
                className="input text-xs"
                defaultValue=""
                onChange={(e) => {
                  const m = mindarMarkers.find((mm) => mm.id === e.target.value);
                  if (m) {
                    setTargetImageUrl(m.target_image_url);
                    setMindFileUrl(m.mind_file_url);
                  }
                }}
              >
                <option value="" disabled>
                  選択してください（{mindarMarkers.length}件登録済み）
                </option>
                {mindarMarkers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-slate-400">
            または新しく画像をアップロード（自動で.mindファイルにコンパイルされます。
            <a href="/admin/attend/markers" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              マーカー管理
            </a>
            に登録してこの案件で使い回すこともできます）
          </p>
          <input
            type="file"
            accept="image/*"
            disabled={!mindarReady}
            onChange={(e) => e.target.files?.[0] && handleTargetImageUpload(e.target.files[0])}
          />
          {!mindarReady && <p className="text-xs text-slate-400">コンパイラを読み込み中...</p>}
          {compileProgress !== null && <p className="text-xs text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>}
          {targetImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={targetImageUrl} alt="target" className="h-20 rounded border" />
          )}
          {mindFileUrl && <p className="text-xs text-emerald-700 break-all">コンパイル済み: {mindFileUrl}</p>}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSaveTrigger}
        disabled={saving}
        className="bg-slate-900 text-white rounded-lg px-4 py-1.5 text-xs disabled:opacity-50"
      >
        {saving ? "保存中..." : savedOk ? "保存しました" : "この発火条件を保存"}
      </button>

      <div className="pt-2 border-t space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500">表示オブジェクト（複数配置できます）</h3>
          <button
            type="button"
            onClick={handleAddObject}
            disabled={addingObject}
            className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {addingObject ? "追加中..." : "+ オブジェクトを追加"}
          </button>
        </div>
        <div className="space-y-2">
          {trigger.objects.map((o) => (
            <ObjectRow key={o.id} itemHash={itemHash} object={o} presets={presets} onDeleted={onObjectsChanged} />
          ))}
          {trigger.objects.length === 0 && <p className="text-xs text-slate-400">まだオブジェクトがありません</p>}
        </div>
      </div>
    </div>
  );
}

// ---- アイテム全体 ----

const statusLabel: Record<AttendExperienceStatus, string> = {
  draft: "下書き",
  ready: "公開準備完了",
};

export default function AttendItemEditor({
  item,
  project,
  triggers,
  presets,
  markers,
}: {
  item: AttendItem;
  project: AttendProject;
  triggers: AttendTriggerWithObjects[];
  presets: PresetObject[];
  markers: AttendMarker[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState(item.name);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [status, setStatus] = useState<AttendExperienceStatus>(item.status);
  const [saving, setSaving] = useState(false);
  const [addingTrigger, setAddingTrigger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";
  const viewerUrl = `${siteOrigin}/a/${item.hash}`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("attend_items")
      .update({ name, notes: notes || null, status })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      setError(`保存に失敗しました: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function handleAddTrigger() {
    setAddingTrigger(true);
    setError(null);
    const { error } = await supabase.from("attend_triggers").insert({
      item_id: item.id,
      display_type: "aframe",
      sort_order: triggers.length,
    });
    setAddingTrigger(false);
    if (error) {
      setError(`発火条件の追加に失敗しました: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(viewerUrl);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1500);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">案件: {project?.client_name}</p>
          <h1 className="text-lg font-bold">アイテム編集</h1>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as AttendExperienceStatus)} className="text-xs border rounded-full px-3 py-1">
          {(Object.keys(statusLabel) as AttendExperienceStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">基本情報</h2>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">アイテム名（柄・グッズ名）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">メモ</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">
          {saving ? "保存中..." : "保存"}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">発火条件（1アイテムに複数設定できます）</h2>
          <button
            onClick={handleAddTrigger}
            disabled={addingTrigger}
            className="bg-pink-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {addingTrigger ? "追加中..." : "+ 発火条件を追加"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          例: 同じキーホルダーに「画像トラッキング」と「GPS」の両方を用意し、来訪者はどちらかを選んでAR体験を開始できます。
        </p>

        {triggers.map((t) => (
          <TriggerCard
            key={t.id}
            itemHash={item.hash}
            trigger={t}
            presets={presets}
            markers={markers}
            onDeleted={() => router.refresh()}
            onObjectsChanged={() => router.refresh()}
          />
        ))}
        {triggers.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">まだ発火条件がありません。「+ 発火条件を追加」から作成してください。</p>
        )}
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-2">
        <h2 className="font-semibold">クライアント提供URL</h2>
        <div className="flex items-center gap-2">
          <code className="text-sm bg-slate-100 rounded px-2 py-1 break-all">{viewerUrl}</code>
          <button type="button" onClick={handleCopy} className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 whitespace-nowrap">
            {copyOk ? "コピーしました" : "コピー"}
          </button>
        </div>
        <p className="text-xs text-amber-600">
          発火条件を1つ以上設定し、それぞれにオブジェクトを配置してから状態を「公開準備完了」に切り替えてください。
        </p>
      </section>
    </div>
  );
}
