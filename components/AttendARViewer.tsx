"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { AttendDisplayType } from "@/lib/types";
import {
  AFRAME_SRC,
  ARJS_SRC,
  MINDAR_FACE_AFRAME_SRC,
  MINDAR_IMAGE_AFRAME_SRC,
  ObjectEntity,
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
  /** mindar_imageの.mindファイルに含まれる画像のtargetIndex一覧(検出対象として描画するエンティティ数)。未指定時は[0]。 */
  targetImageIndices: number[];
  objects: ResolvedObject[];
}

const displayTypeShortLabel: Record<AttendDisplayType, string> = {
  aframe: "マーカー",
  mindar_image: "画像認識",
  mindar_face: "顔認識",
  gps: "GPS",
};

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

function TriggerScene({ trigger }: { trigger: ResolvedTrigger }) {
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const registeredRef = useRef(false);

  useEffect(() => {
    const AFRAME = (window as any).AFRAME;
    if (aframeLoaded && AFRAME && !registeredRef.current) {
      registerGifImageComponent(AFRAME);
      registerAlphaVideoComponent(AFRAME);
      registeredRef.current = true;
    }
  }, [aframeLoaded]);

  const ready = aframeLoaded && engineLoaded;
  const marker = trigger.markerUrl || DEFAULT_MARKER_URL;
  const anchorIndex = trigger.faceAnchorIndex ?? 10;
  const engineSrc = engineSrcFor(trigger.displayType);

  return (
    <div className="h-full w-full bg-black relative">
      <Script src={AFRAME_SRC} strategy="afterInteractive" onLoad={() => setAframeLoaded(true)} />
      {engineSrc && (
        <Script src={engineSrc} strategy="afterInteractive" onLoad={() => setEngineLoaded(true)} />
      )}

      {!ready && (
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
                  <ObjectEntity key={i} url={o.url} position={o.position} scale={o.scale} rotationY={o.rotationY} />
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
              <ObjectEntity key={i} url={o.url} position={o.position} scale={o.scale} rotationY={o.rotationY} />
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
              <ObjectEntity key={i} url={o.url} position={o.position} scale={o.scale} rotationY={o.rotationY} />
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
              <ObjectEntity key={i} url={o.url} position={o.position} scale={o.scale} rotationY={o.rotationY} />
            ))}
          </a-entity>
        </a-scene>
      )}
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
