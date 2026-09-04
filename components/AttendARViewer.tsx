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

function engineSrcFor(displayType: AttendDisplayType): string | null {
  if (displayType === "aframe" || displayType === "gps") return ARJS_SRC;
  if (displayType === "mindar_image") return MINDAR_IMAGE_AFRAME_SRC;
  if (displayType === "mindar_face") return MINDAR_FACE_AFRAME_SRC;
  return null;
}

export default function AttendARViewer({
  displayType,
  modelUrl,
  mindFileUrl,
  markerUrl,
  faceAnchorIndex,
  gpsLat,
  gpsLng,
}: {
  displayType: AttendDisplayType;
  modelUrl: string | null;
  mindFileUrl: string | null;
  markerUrl?: string | null;
  faceAnchorIndex?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
}) {
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
  const marker = markerUrl || DEFAULT_MARKER_URL;
  const anchorIndex = faceAnchorIndex ?? 10;
  const engineSrc = engineSrcFor(displayType);

  const missingContent =
    !modelUrl ||
    (displayType === "mindar_image" && !mindFileUrl) ||
    (displayType === "gps" && (gpsLat == null || gpsLng == null));

  if (missingContent) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
        このコンテンツはまだ準備中です。しばらくしてから再度お試しください。
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative">
      <Script src={AFRAME_SRC} strategy="afterInteractive" onLoad={() => setAframeLoaded(true)} />
      {engineSrc && (
        <Script src={engineSrc} strategy="afterInteractive" onLoad={() => setEngineLoaded(true)} />
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm z-10">
          読み込み中...
        </div>
      )}

      {ready && displayType === "mindar_image" && modelUrl && (
        <a-scene
          mindar-image={`imageTargetSrc: ${mindFileUrl}; autoStart: true; uiScanning: yes; uiLoading: yes;`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: true"
          embedded
        >
          <a-camera position="0 0 0" look-controls-enabled="false"></a-camera>
          <a-entity mindar-image-target="targetIndex: 0">
            <ObjectEntity url={modelUrl} />
          </a-entity>
        </a-scene>
      )}

      {ready && displayType === "mindar_face" && modelUrl && (
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
            <ObjectEntity url={modelUrl} position="0 0 0" />
          </a-entity>
        </a-scene>
      )}

      {ready && displayType === "aframe" && modelUrl && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
          renderer="logarithmicDepthBuffer: true;"
        >
          <a-marker type="pattern" url={marker}>
            <ObjectEntity url={modelUrl} />
          </a-marker>
          <a-entity camera></a-entity>
        </a-scene>
      )}

      {ready && displayType === "gps" && modelUrl && gpsLat != null && gpsLng != null && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;"
          renderer="logarithmicDepthBuffer: true;"
        >
          <a-camera gps-camera="gpsMinDistance: 1" rotation-reader></a-camera>
          <a-entity gps-entity-place={`latitude: ${gpsLat}; longitude: ${gpsLng}`} scale="8 8 8">
            <ObjectEntity url={modelUrl} position="0 0 0" />
          </a-entity>
        </a-scene>
      )}
    </div>
  );
}
