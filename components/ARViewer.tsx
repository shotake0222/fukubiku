"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { DisplayType } from "@/lib/types";
import {
  AFRAME_EXTRAS_SRC,
  AFRAME_SRC,
  ARJS_SRC,
  MINDAR_IMAGE_AFRAME_SRC,
  ObjectEntity,
  registerAlphaVideoComponent,
  registerGifImageComponent,
} from "./arObjectComponents";

const DEFAULT_MARKER_URL = "/markers/patternkuji.patt";

export default function ARViewer({
  displayType,
  modelUrl,
  mindFileUrl,
  markerUrl,
}: {
  displayType: DisplayType;
  modelUrl: string | null;
  mindFileUrl: string | null;
  markerUrl?: string | null;
}) {
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false); // arjs or mindar
  const [extrasLoaded, setExtrasLoaded] = useState(false); // aframe-extras (animation-mixer)
  const registeredRef = useRef(false);

  useEffect(() => {
    const AFRAME = (window as any).AFRAME;
    if (aframeLoaded && AFRAME && !registeredRef.current) {
      registerGifImageComponent(AFRAME);
      registerAlphaVideoComponent(AFRAME);
      registeredRef.current = true;
    }
  }, [aframeLoaded]);

  const ready = aframeLoaded && engineLoaded && extrasLoaded;
  const marker = markerUrl || DEFAULT_MARKER_URL;

  if (!modelUrl || (displayType === "mindar" && !mindFileUrl)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
        このコンテンツはまだ準備中です。しばらくしてから再度お試しください。
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative">
      <Script src={AFRAME_SRC} strategy="afterInteractive" onLoad={() => setAframeLoaded(true)} />
      <Script
        src={AFRAME_EXTRAS_SRC}
        strategy="afterInteractive"
        onLoad={() => setExtrasLoaded(true)}
      />
      {displayType === "aframe" && (
        <Script src={ARJS_SRC} strategy="afterInteractive" onLoad={() => setEngineLoaded(true)} />
      )}
      {displayType === "mindar" && (
        <Script
          src={MINDAR_IMAGE_AFRAME_SRC}
          strategy="afterInteractive"
          onLoad={() => setEngineLoaded(true)}
        />
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm z-10">
          読み込み中...
        </div>
      )}

      {ready && displayType === "mindar" && (
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

      {ready && displayType === "aframe" && (
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
    </div>
  );
}
