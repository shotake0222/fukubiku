"use client";

import { useState } from "react";
import Script from "next/script";
import type { DisplayType } from "@/lib/types";

const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";
const MINDAR_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";

export default function ARViewer({
  displayType,
  modelUrl,
  mindFileUrl,
}: {
  displayType: DisplayType;
  modelUrl: string | null;
  mindFileUrl: string | null;
}) {
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [mindarLoaded, setMindarLoaded] = useState(false);

  const ready = displayType === "aframe" ? aframeLoaded : aframeLoaded && mindarLoaded;

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
      {displayType === "mindar" && (
        <Script
          src={MINDAR_AFRAME_SRC}
          strategy="afterInteractive"
          onLoad={() => setMindarLoaded(true)}
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
          <a-assets>
            <a-asset-item id="model" src={modelUrl}></a-asset-item>
          </a-assets>
          <a-camera position="0 0 0" look-controls-enabled="false"></a-camera>
          <a-entity mindar-image-target="targetIndex: 0">
            <a-gltf-model
              src="#model"
              position="0 0 0"
              rotation="0 0 0"
              scale="0.05 0.05 0.05"
              animation="property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear"
            ></a-gltf-model>
          </a-entity>
        </a-scene>
      )}

      {ready && displayType === "aframe" && (
        <a-scene embedded vr-mode-ui="enabled: false">
          <a-assets>
            <a-asset-item id="model" src={modelUrl}></a-asset-item>
          </a-assets>
          <a-light type="ambient" color="#ffffff"></a-light>
          <a-light type="directional" position="1 2 1" intensity="0.6"></a-light>
          <a-entity
            gltf-model="#model"
            position="0 0 -3"
            scale="1 1 1"
            animation="property: rotation; to: 0 360 0; loop: true; dur: 10000; easing: linear"
          ></a-entity>
          <a-camera position="0 0.5 0" look-controls wasd-controls></a-camera>
        </a-scene>
      )}
    </div>
  );
}
