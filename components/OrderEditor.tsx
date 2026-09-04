"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import OrderDetailsForm, { type OrderDetailsValue } from "@/components/OrderDetailsForm";
import type { DisplayType, ObjectSource, Order, PresetObject } from "@/lib/types";

const ASSET_BUCKET = "assets";

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

export default function OrderEditor({
  order,
  presets,
}: {
  order: Order;
  presets: PresetObject[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [details, setDetails] = useState<OrderDetailsValue>({
    client_name: order.client_name,
    order_date: order.order_date,
    due_date: order.due_date ?? "",
    person_in_charge: order.person_in_charge ?? "",
    quantity: order.quantity != null ? String(order.quantity) : "",
    renewal_check_date: order.renewal_check_date ?? "",
    notes: order.notes ?? "",
  });

  const [displayType, setDisplayType] = useState<DisplayType>(order.display_type);
  const [objectSource, setObjectSource] = useState<ObjectSource>(order.object_source);
  const [presetObjectId, setPresetObjectId] = useState<string | null>(order.preset_object_id);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(order.custom_model_url);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(order.target_image_url);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(order.mind_file_url);
  const [status, setStatus] = useState(order.status);

  const [modelUploading, setModelUploading] = useState(false);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://fukubikiu.attend-ar.com";
  const viewerUrl = `${siteOrigin}/v/${order.hash}`;

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
      const path = `orders/${order.hash}/model-${Date.now()}${extOf(file.name) || ".glb"}`;
      const url = await uploadToAssets(path, file);
      setCustomModelUrl(url);
    } catch (e: any) {
      setError(`モデルのアップロードに失敗しました: ${e.message ?? e}`);
    } finally {
      setModelUploading(false);
    }
  }

  async function handleTargetImageUpload(file: File) {
    setError(null);
    setCompileProgress(0);
    try {
      const imgPath = `orders/${order.hash}/target-original-${Date.now()}${extOf(file.name) || ".jpg"}`;
      const imgUrl = await uploadToAssets(imgPath, file, file.type || "image/jpeg");
      setTargetImageUrl(imgUrl);

      const blob = await compileMindTarget(file, (p) => setCompileProgress(p));
      const mindPath = `orders/${order.hash}/target-${Date.now()}.mind`;
      const mindUrl = await uploadToAssets(mindPath, blob, "application/octet-stream");
      setMindFileUrl(mindUrl);
    } catch (e: any) {
      setError(`画像のコンパイルに失敗しました: ${e.message ?? e}`);
    } finally {
      setCompileProgress(null);
    }
  }

  function computeStatus(): "draft" | "ready" {
    const hasObject = objectSource === "preset" ? !!presetObjectId : !!customModelUrl;
    const hasMind = displayType === "mindar" ? !!mindFileUrl : true;
    return hasObject && hasMind ? "ready" : "draft";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const nextStatus = computeStatus();
    const { error } = await supabase
      .from("orders")
      .update({
        client_name: details.client_name,
        order_date: details.order_date,
        due_date: details.due_date || null,
        person_in_charge: details.person_in_charge || null,
        quantity: details.quantity ? Number(details.quantity) : null,
        renewal_check_date: details.renewal_check_date || null,
        notes: details.notes || null,
        display_type: displayType,
        object_source: objectSource,
        preset_object_id: objectSource === "preset" ? presetObjectId : null,
        custom_model_url: objectSource === "upload" ? customModelUrl : null,
        target_image_url: displayType === "mindar" ? targetImageUrl : null,
        mind_file_url: displayType === "mindar" ? mindFileUrl : null,
        status: nextStatus,
      })
      .eq("id", order.id);
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
        <h1 className="text-lg font-bold">注文編集: {order.client_name || "(未設定)"}</h1>
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {status === "ready" ? "公開準備完了" : "下書き"}
        </span>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">注文情報</h2>
        <OrderDetailsForm value={details} onChange={setDetails} />
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">表示方式</h2>
        <div className="flex gap-4">
          {(["aframe", "mindar"] as DisplayType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="displayType"
                checked={displayType === t}
                onChange={() => setDisplayType(t)}
              />
              {t === "aframe" ? "A-Frame（マーカーなし3D表示）" : "MindAR（画像トラッキングAR）"}
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">表示オブジェクト（3Dモデル）</h2>
        <div className="flex gap-4">
          {(["preset", "upload"] as ObjectSource[]).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="objectSource"
                checked={objectSource === s}
                onChange={() => setObjectSource(s)}
              />
              {s === "preset" ? "用意されたオブジェクトから選択" : "独自の3Dモデルをアップロード"}
            </label>
          ))}
        </div>

        {objectSource === "preset" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {presets.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPresetObjectId(p.id)}
                className={`border rounded-lg p-2 text-xs text-left space-y-2 ${
                  presetObjectId === p.id ? "ring-2 ring-slate-900 border-slate-900" : ""
                }`}
              >
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt={p.name} className="w-full h-20 object-cover rounded" />
                ) : (
                  <div className="w-full h-20 bg-slate-100 rounded" />
                )}
                <div className="truncate">{p.name}</div>
              </button>
            ))}
            {presets.length === 0 && (
              <p className="col-span-full text-sm text-slate-400">
                プリセットオブジェクトがありません。「オブジェクト管理」から登録してください。
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={(e) => e.target.files?.[0] && handleModelUpload(e.target.files[0])}
            />
            {modelUploading && <p className="text-sm text-slate-500">アップロード中...</p>}
            {customModelUrl && (
              <p className="text-xs text-emerald-700 break-all">アップロード済み: {customModelUrl}</p>
            )}
          </div>
        )}
      </section>

      {displayType === "mindar" && (
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
          {compileProgress !== null && (
            <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>
          )}
          {targetImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={targetImageUrl} alt="target" className="h-24 rounded border" />
          )}
          {mindFileUrl && (
            <p className="text-xs text-emerald-700 break-all">
              コンパイル済み: {mindFileUrl}
            </p>
          )}
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
            表示オブジェクト（MindARの場合はターゲット画像のコンパイルも）を設定して保存すると「公開準備完了」になります。
          </p>
        )}
      </section>
    </div>
  );
}
