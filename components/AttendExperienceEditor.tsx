"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import type {
  AttendDisplayType,
  AttendExperience,
  AttendExperienceStatus,
  AttendProject,
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

function PresetPreview({ url }: { url: string }) {
  if (/\.mp4(\?|$)/i.test(url)) {
    return (
      <video src={url} className="w-full h-20 object-cover rounded bg-slate-100" autoPlay muted loop playsInline />
    );
  }
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full h-20 object-cover rounded" />;
  }
  return <div className="w-full h-20 bg-slate-100 rounded" />;
}

export default function AttendExperienceEditor({
  experience,
  project,
  presets,
}: {
  experience: AttendExperience;
  project: AttendProject;
  presets: PresetObject[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState(experience.name);
  const [displayType, setDisplayType] = useState<AttendDisplayType>(experience.display_type);
  const [objectSource, setObjectSource] = useState<ObjectSource>(experience.object_source);
  const [presetObjectId, setPresetObjectId] = useState<string | null>(experience.preset_object_id);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(experience.custom_model_url);
  const [markerUrl, setMarkerUrl] = useState<string | null>(experience.marker_url);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(experience.target_image_url);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(experience.mind_file_url);
  const [faceAnchorIndex, setFaceAnchorIndex] = useState<number>(experience.face_anchor_index ?? 10);
  const [gpsLat, setGpsLat] = useState(experience.gps_lat != null ? String(experience.gps_lat) : "");
  const [gpsLng, setGpsLng] = useState(experience.gps_lng != null ? String(experience.gps_lng) : "");
  const [gpsRadius, setGpsRadius] = useState(String(experience.gps_radius_m ?? 20));
  const [notes, setNotes] = useState(experience.notes ?? "");
  const [status, setStatus] = useState<AttendExperienceStatus>(experience.status);

  const [modelUploading, setModelUploading] = useState(false);
  const [markerUploading, setMarkerUploading] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const categoriesInUse = useMemo(() => {
    const set = new Set(presets.map((p) => p.category || UNCATEGORIZED));
    const ordered = [
      ...PRESET_CATEGORIES.map((c) => c.value).filter((v) => set.has(v)),
      ...Array.from(set).filter((v) => !PRESET_CATEGORIES.some((c) => c.value === v)),
    ];
    return ordered;
  }, [presets]);

  const selectedPreset = presets.find((p) => p.id === presetObjectId) || null;
  const [selectedCategory, setSelectedCategory] = useState<string>(
    selectedPreset?.category || categoriesInUse[0] || UNCATEGORIZED
  );
  const presetsInCategory = presets.filter((p) => (p.category || UNCATEGORIZED) === selectedCategory);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";
  const viewerUrl = `${siteOrigin}/a/${experience.hash}`;

  async function uploadToAssets(path: string, file: File | Blob, contentType?: string) {
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleModelUpload(file: File) {
    setError(null);
    setModelUploading(true);
    try {
      const path = `attend/${experience.hash}/model-${Date.now()}${extOf(file.name) || ".glb"}`;
      const url = await uploadToAssets(path, file);
      setCustomModelUrl(url);
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e.message ?? e}`);
    } finally {
      setModelUploading(false);
    }
  }

  async function handleMarkerUpload(file: File) {
    setError(null);
    setMarkerUploading(true);
    try {
      const path = `attend/${experience.hash}/marker-${Date.now()}${extOf(file.name) || ".patt"}`;
      const url = await uploadToAssets(path, file, "text/plain");
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
      const imgPath = `attend/${experience.hash}/target-original-${Date.now()}${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setTargetImageUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `attend/${experience.hash}/target-${Date.now()}.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
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

  function computeStatus(): AttendExperienceStatus {
    const hasObject = objectSource === "preset" ? !!presetObjectId : !!customModelUrl;
    const hasMind = displayType === "mindar_image" ? !!mindFileUrl : true;
    const hasGps = displayType === "gps" ? !!gpsLat && !!gpsLng : true;
    return hasObject && hasMind && hasGps ? "ready" : "draft";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const nextStatus = computeStatus();
    const { error } = await supabase
      .from("attend_experiences")
      .update({
        name,
        display_type: displayType,
        object_source: objectSource,
        preset_object_id: objectSource === "preset" ? presetObjectId : null,
        custom_model_url: objectSource === "upload" ? customModelUrl : null,
        marker_url: displayType === "aframe" ? markerUrl : null,
        target_image_url: displayType === "mindar_image" ? targetImageUrl : null,
        mind_file_url: displayType === "mindar_image" ? mindFileUrl : null,
        face_anchor_index: displayType === "mindar_face" ? faceAnchorIndex : null,
        gps_lat: displayType === "gps" && gpsLat ? Number(gpsLat) : null,
        gps_lng: displayType === "gps" && gpsLng ? Number(gpsLng) : null,
        gps_radius_m: displayType === "gps" && gpsRadius ? Number(gpsRadius) : null,
        notes: notes || null,
        status: nextStatus,
      })
      .eq("id", experience.id);
    setSaving(false);
    if (error) {
      setError(`保存に失敗しました: ${error.message}`);
      return;
    }
    setStatus(nextStatus);
    router.refresh();
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
        <div>
          <p className="text-xs text-slate-400">案件: {project?.client_name}</p>
          <h1 className="text-lg font-bold">体験編集</h1>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {status === "ready" ? "公開準備完了" : "下書き"}
        </span>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">基本情報</h2>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">体験名（拠点名・シーン名）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">メモ</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </label>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">ARモード</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {ATTEND_DISPLAY_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex items-start gap-2 text-sm border rounded-lg p-3 cursor-pointer ${
                displayType === t.value ? "border-slate-900 ring-1 ring-slate-900" : ""
              }`}
            >
              <input
                type="radio"
                name="displayType"
                className="mt-1"
                checked={displayType === t.value}
                onChange={() => setDisplayType(t.value)}
              />
              <span>
                <span className="block font-medium">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {displayType === "aframe" && (
        <section className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold">マーカー画像（.patt）</h2>
          <p className="text-sm text-slate-500">
            未指定の場合は共通の既定マーカーが使われます。専用マーカーを使う場合はAR.js形式の.pattファイルをアップロードしてください。
          </p>
          <input
            type="file"
            accept=".patt"
            disabled={markerUploading}
            onChange={(e) => e.target.files?.[0] && handleMarkerUpload(e.target.files[0])}
          />
          {markerUploading && <p className="text-sm text-slate-500">アップロード中...</p>}
          {markerUrl && <p className="text-xs text-emerald-700 break-all">設定済み: {markerUrl}</p>}
        </section>
      )}

      {displayType === "mindar_face" && (
        <section className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold">顔アンカー位置</h2>
          <p className="text-sm text-slate-500">
            表示オブジェクトを追従させる顔のパーツを選択してください。実機での見え方に応じて後から調整してください。
          </p>
          <select
            value={faceAnchorIndex}
            onChange={(e) => setFaceAnchorIndex(Number(e.target.value))}
            className="input"
          >
            {FACE_ANCHOR_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}（anchorIndex: {p.value}）
              </option>
            ))}
          </select>
        </section>
      )}

      {displayType === "gps" && (
        <section className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold">GPS位置</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1 block">
              <span className="text-sm font-medium">緯度</span>
              <input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} className="input" placeholder="35.681236" />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">経度</span>
              <input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} className="input" placeholder="139.767125" />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">起動半径（m）</span>
              <input value={gpsRadius} onChange={(e) => setGpsRadius(e.target.value)} className="input" />
            </label>
          </div>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {locating ? "取得中..." : "現在地を取得"}
          </button>
        </section>
      )}

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">表示オブジェクト</h2>
        <div className="flex gap-4">
          {(["preset", "upload"] as ObjectSource[]).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input type="radio" name="objectSource" checked={objectSource === s} onChange={() => setObjectSource(s)} />
              {s === "preset" ? "用意されたテンプレートから選択" : "独自の動画/GIF/画像/3Dモデルをアップロード"}
            </label>
          ))}
        </div>

        {objectSource === "preset" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {categoriesInUse.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    selectedCategory === cat ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              ))}
              {categoriesInUse.length === 0 && (
                <p className="text-sm text-slate-400">
                  テンプレートがありません。「オブジェクト管理」から登録してください。
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {presetsInCategory.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPresetObjectId(p.id)}
                  className={`border rounded-lg p-2 text-xs text-left space-y-2 ${
                    presetObjectId === p.id ? "ring-2 ring-slate-900 border-slate-900" : ""
                  }`}
                >
                  <PresetPreview url={p.thumbnail_url || p.model_url} />
                  <div className="truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="file"
              accept=".glb,.gltf,video/mp4,image/gif,image/*"
              onChange={(e) => e.target.files?.[0] && handleModelUpload(e.target.files[0])}
            />
            <p className="text-xs text-slate-400">動画(.mp4)、GIF/画像、または.glb形式の3Dモデルをアップロードできます。</p>
            {modelUploading && <p className="text-sm text-slate-500">アップロード中...</p>}
            {customModelUrl && (
              <div className="space-y-1">
                <PresetPreview url={customModelUrl} />
                <p className="text-xs text-emerald-700 break-all">アップロード済み: {customModelUrl}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {displayType === "mindar_image" && (
        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold">MindAR ターゲット画像</h2>
          <p className="text-sm text-slate-500">
            クライアントから提供された画像をアップロードすると、自動でARマーカー用データ(.mind)にコンパイルされます。
          </p>
          <input
            type="file"
            accept="image/*"
            disabled={!mindarReady}
            onChange={(e) => e.target.files?.[0] && handleTargetImageUpload(e.target.files[0])}
          />
          {!mindarReady && <p className="text-xs text-slate-400">コンパイラを読み込み中...</p>}
          {compileProgress !== null && <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>}
          {targetImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={targetImageUrl} alt="target" className="h-24 rounded border" />
          )}
          {mindFileUrl && <p className="text-xs text-emerald-700 break-all">コンパイル済み: {mindFileUrl}</p>}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-2">
        <h2 className="font-semibold">クライアント提供URL</h2>
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
        {status !== "ready" && (
          <p className="text-xs text-amber-600">
            表示オブジェクト（モードに応じてマーカー/ターゲット画像/GPS座標）を設定して保存すると「公開準備完了」になります。
          </p>
        )}
      </section>
    </div>
  );
}
