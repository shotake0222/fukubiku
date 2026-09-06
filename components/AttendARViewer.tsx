"use client";

import { useEffect, useRef, useState } from "react";
import type { AttendDisplayType } from "@/lib/types";
import {
  AFRAME_EXTRAS_SRC,
  AFRAME_SRC,
  ARJS_SRC,
  MINDAR_FACE_AFRAME_SRC,
  MINDAR_IMAGE_AFRAME_SRC,
  ObjectEntity,
  loadArScript,
  registerAlphaVideoComponent,
  registerGifImageComponent,
} from "./arObjectComponents";

const DEFAULT_MARKER_URL = "/markers/patternkuji.patt";

export interface ResolvedObject {
  url: string;
  position: string;
  scale: string | null;
  rotationY: number;
  /** mindar_imageで複数画像マーカーを使う場合、どの画像(targetIndex)で表示するか。nullは全画像共通で表示。 */
  targetIndex: number | null;
}

export interface ResolvedTrigger {
  id: string;
  label: string | null;
  displayType: AttendDisplayType;
  markerUrl: string | null;
  mindFileUrl: string | null;
  faceAnchorIndex: number | null;
  gpsLat: number | null;
  gpsLng: number | null;
  /** この距離(m)まで近づくと表示する。未指定なら20m。 */
  gpsRadiusM: number | null;
  /** mindar_imageの.mindファイルに含まれる画像のtargetIndex一覧(検出対象として描画するエンティティ数)。未指定時は[0]。 */
  targetImageIndices: number[];
  objects: ResolvedObject[];
}

const displayTypeShortLabel: Record<AttendDisplayType, string> = {
  nfc: "NFC",
  aframe: "マーカー",
  mindar_image: "画像認識",
  mindar_face: "顔認識",
  gps: "GPS",
};

// 2点間の距離(m)。地球を半径6371kmの球とみなすハバサイン公式。
// 数十m〜数kmの案内には十分な精度がある。
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km`;
  return `${Math.round(m / 10) * 10}m`;
}

// 目的地に近づくまでの案内。圏内に入ったら onArrive で本編へ切り替える。
function GpsGuide({
  lat,
  lng,
  radiusM,
  onArrive,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  onArrive: () => void;
}) {
  const [distance, setDistance] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("この端末では位置情報を取得できません。");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setAccuracy(pos.coords.accuracy);
        const d = distanceMeters(pos.coords.latitude, pos.coords.longitude, lat, lng);
        setDistance(d);
        // 測位誤差を足して判定する。誤差が大きい端末で永久に入れなくなるのを防ぐ。
        if (d <= radiusM + Math.min(pos.coords.accuracy || 0, 30)) onArrive();
      },
      (e) => {
        setError(
          e.code === e.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。ブラウザの設定から許可してください。"
            : "位置情報を取得できませんでした。屋外で再度お試しください。"
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [lat, lng, radiusM, onArrive]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white px-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-sm text-slate-300">この場所でだけ見られるコンテンツです</p>
        {distance == null && !error && <p className="text-lg">現在地を確認しています...</p>}
        {distance != null && (
          <>
            <p className="text-4xl font-bold tracking-tight">あと {formatDistance(distance)}</p>
            <p className="text-sm text-slate-300">
              目的地に近づくと自動でARが始まります（半径{radiusM}m）
            </p>
            {accuracy != null && accuracy > 50 && (
              <p className="text-xs text-slate-400">
                measuring… 測位の精度が粗い状態です（誤差 約{Math.round(accuracy)}m）。
                屋外や見晴らしの良い場所だと安定します。
              </p>
            )}
          </>
        )}
        {error && <p className="text-sm text-amber-300">{error}</p>}
      </div>
    </div>
  );
}

// 表示エンジンごとの「正面がカメラを向く」基準の向き。
//
// AR.js(マーカー): マーカー面がXZ平面で法線が+Y。正面が+Zのモデルは
//   X軸まわりに-90度回すと立ち上がって視聴者側を向く。
// それ以外(画像認識・顔認識・GPS・NFC): 面の法線が+Zで最初からカメラを向くため、
//   回してはいけない。回すと画像や地面と平行に寝てしまう。
//
// 以前はすべてに -90 0 0 を掛けていたため、GPSの
// ランドマークが横倒しになっていた。
function baseRotationFor(displayType: AttendDisplayType, rotationY: number): string {
  const x = displayType === "aframe" ? -90 : 0;
  return `${x} ${rotationY} 0`;
}

function engineSrcFor(displayType: AttendDisplayType): string | null {
  if (displayType === "aframe" || displayType === "gps") return ARJS_SRC;
  if (displayType === "mindar_image") return MINDAR_IMAGE_AFRAME_SRC;
  if (displayType === "mindar_face") return MINDAR_FACE_AFRAME_SRC;
  return null;
}

function isTriggerUsable(t: ResolvedTrigger): boolean {
  if (t.objects.length === 0) return false;
  if (t.displayType === "mindar_image" && !t.mindFileUrl) return false;
  if (t.displayType === "gps" && (t.gpsLat == null || t.gpsLng == null)) return false;
  return true;
}

// NFCタグで開いたときの表示。マーカーも位置も判定せず、
// カメラ映像を背景に敷いた上へオブジェクトを浮かべる。
function NfcScene({ trigger }: { trigger: ResolvedTrigger }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        setError("カメラを利用できませんでした。ブラウザの設定でカメラを許可してください。");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="fixed inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />
      {error && (
        <p className="fixed inset-x-0 top-4 z-20 text-center text-sm text-amber-200 px-6">{error}</p>
      )}
      <a-scene
        embedded
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: true"
        renderer="alpha: true;"
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
      >
        {/* カメラは原点。少し前方に置くと目の前に浮かんで見える */}
        <a-entity position="0 0 -2">
          {trigger.objects.map((o, i) => (
            <ObjectEntity
                key={i}
                url={o.url}
                position={o.position}
                scale={o.scale}
                rotation={baseRotationFor(trigger.displayType, o.rotationY)}
              />
          ))}
        </a-entity>
        <a-entity camera look-controls="magicWindowTrackingEnabled: true; mouseEnabled: false; touchEnabled: false"></a-entity>
      </a-scene>
    </>
  );
}

function TriggerScene({ trigger }: { trigger: ResolvedTrigger }) {
  // GPSは半径内に入るまでARを起動せず、距離案内だけを出す。
  // (半径は保存されているだけで使われていなかった)
  const [arrived, setArrived] = useState(trigger.displayType !== "gps");
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const [extrasLoaded, setExtrasLoaded] = useState(false); // aframe-extras (animation-mixer)
  const [loadError, setLoadError] = useState<string | null>(null);
  const registeredRef = useRef(false);

  const engineSrc = engineSrcFor(trigger.displayType);

  if (
    trigger.displayType === "gps" &&
    !arrived &&
    trigger.gpsLat != null &&
    trigger.gpsLng != null
  ) {
    return (
      <GpsGuide
        lat={trigger.gpsLat}
        lng={trigger.gpsLng}
        radiusM={trigger.gpsRadiusM ?? 20}
        onArrive={() => setArrived(true)}
      />
    );
  }

  // A-Frame本体を読み込んでから、それに依存するaframe-extrasとAR.js/MindARを読み込む
  // (loadArScriptの実装/経緯はarObjectComponents.tsxのコメント参照)。
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadArScript(AFRAME_SRC);
        if (cancelled) return;
        setAframeLoaded(true);

        const tasks = [
          loadArScript(AFRAME_EXTRAS_SRC).then(() => {
            if (!cancelled) setExtrasLoaded(true);
          }),
        ];
        if (engineSrc) {
          tasks.push(
            loadArScript(engineSrc).then(() => {
              if (!cancelled) setEngineLoaded(true);
            })
          );
        } else {
          setEngineLoaded(true);
        }
        await Promise.all(tasks);
      } catch (e: any) {
        // 原因調査のため、コンソールにも実際のエラー内容を残しておく
        // (画面には簡潔な案内文だけを出し、詳細は下に小さく併記する)。
        console.error("[ARViewer] スクリプト読み込みエラー:", e);
        if (!cancelled) setLoadError(e?.message ?? String(e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [engineSrc]);

  useEffect(() => {
    const AFRAME = (window as any).AFRAME;
    if (aframeLoaded && AFRAME && !registeredRef.current) {
      registerGifImageComponent(AFRAME);
      registerAlphaVideoComponent(AFRAME);
      registeredRef.current = true;
    }
  }, [aframeLoaded]);

  const ready = aframeLoaded && engineLoaded && extrasLoaded;
  const marker = trigger.markerUrl || DEFAULT_MARKER_URL;
  const anchorIndex = trigger.faceAnchorIndex ?? 10;

  return (
    <div className="h-full w-full bg-black relative">
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white text-sm px-6 text-center z-20">
          <p>読み込みに失敗しました。電波状況の良い場所でもう一度お試しください。</p>
          <p className="text-xs text-white/50 break-all">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-white/40 hover:bg-white/10"
          >
            再読み込み
          </button>
        </div>
      )}

      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm z-10">
          読み込み中...
        </div>
      )}

      {ready && trigger.displayType === "mindar_image" && (
        <a-scene
          mindar-image={`imageTargetSrc: ${trigger.mindFileUrl}; autoStart: true; uiScanning: yes; uiLoading: yes;`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: true"
          embedded
        >
          <a-camera position="0 0 0" look-controls-enabled="false"></a-camera>
          {(trigger.targetImageIndices.length > 0 ? trigger.targetImageIndices : [0]).map((idx) => (
            <a-entity key={idx} mindar-image-target={`targetIndex: ${idx}`}>
              {trigger.objects
                .filter((o) => o.targetIndex == null || o.targetIndex === idx)
                .map((o, i) => (
                  <ObjectEntity
                key={i}
                url={o.url}
                position={o.position}
                scale={o.scale}
                rotation={baseRotationFor(trigger.displayType, o.rotationY)}
              />
                ))}
            </a-entity>
          ))}
        </a-scene>
      )}

      {ready && trigger.displayType === "mindar_face" && (
        <a-scene
          mindar-face="autoStart: true; uiScanning: no; uiLoading: no;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: true"
          embedded
        >
          <a-camera active="false" position="0 0 0"></a-camera>
          <a-entity mindar-face-target={`anchorIndex: ${anchorIndex}`}>
            {trigger.objects.map((o, i) => (
              <ObjectEntity
                key={i}
                url={o.url}
                position={o.position}
                scale={o.scale}
                rotation={baseRotationFor(trigger.displayType, o.rotationY)}
              />
            ))}
          </a-entity>
        </a-scene>
      )}

      {ready && trigger.displayType === "aframe" && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
          renderer="logarithmicDepthBuffer: true;"
        >
          <a-marker type="pattern" url={marker}>
            {trigger.objects.map((o, i) => (
              <ObjectEntity
                key={i}
                url={o.url}
                position={o.position}
                scale={o.scale}
                rotation={baseRotationFor(trigger.displayType, o.rotationY)}
              />
            ))}
          </a-marker>
          <a-entity camera></a-entity>
        </a-scene>
      )}

      {ready && trigger.displayType === "gps" && trigger.gpsLat != null && trigger.gpsLng != null && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;"
          renderer="logarithmicDepthBuffer: true;"
        >
          <a-camera gps-camera="gpsMinDistance: 1" rotation-reader></a-camera>
          <a-entity gps-entity-place={`latitude: ${trigger.gpsLat}; longitude: ${trigger.gpsLng}`} scale="8 8 8">
            {trigger.objects.map((o, i) => (
              <ObjectEntity
                key={i}
                url={o.url}
                position={o.position}
                scale={o.scale}
                rotation={baseRotationFor(trigger.displayType, o.rotationY)}
              />
            ))}
          </a-entity>
        </a-scene>
      )}

      {/* NFC: マーカーも位置も見ないので、AR.jsは使わずカメラ映像を直接背景に敷く。
          (AR.jsはマーカー前提の作りで、認識対象が無いと映像サイズの計算が破綻し、
           4000px超のvideoを作ってしまうことを実測で確認したため) */}
      {ready && trigger.displayType === "nfc" && <NfcScene trigger={trigger} />}
    </div>
  );
}

export default function AttendARViewer({
  itemName,
  triggers,
}: {
  itemName: string;
  triggers: ResolvedTrigger[];
}) {
  const usable = triggers.filter(isTriggerUsable);
  const [activeId, setActiveId] = useState<string | null>(usable[0]?.id ?? null);
  const active = usable.find((t) => t.id === activeId) ?? usable[0] ?? null;

  if (usable.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
        このコンテンツはまだ準備中です。しばらくしてから再度お試しください。
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col">
      {usable.length > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/50 backdrop-blur rounded-full p-1">
          {usable.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${
                active?.id === t.id ? "bg-white text-black" : "text-white"
              }`}
            >
              {t.label || displayTypeShortLabel[t.displayType]}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1">{active && <TriggerScene key={active.id} trigger={active} />}</div>
    </div>
  );
}
