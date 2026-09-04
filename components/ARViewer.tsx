"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { DisplayType } from "@/lib/types";

const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";
const ARJS_SRC = "/vendor/aframe-ar.js";
const MINDAR_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";
const DEFAULT_MARKER_URL = "/markers/patternkuji.patt";

function assetKind(url: string): "video" | "image" | "model" {
  if (/\.mp4(\?|$)/i.test(url)) return "video";
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) return "image";
  return "model";
}

// GIF/静止画をA-Frame上でテクスチャとして再生するコンポーネント(旧式のアップロード互換用)。
// DOM上で再生中の<img>の現在フレームを毎フレームcanvasへ描画し、そのcanvasをテクスチャとして使う。
function registerGifImageComponent(AFRAME: any) {
  if (AFRAME.components["gif-image"]) return;
  AFRAME.registerComponent("gif-image", {
    schema: { src: { type: "string" } },
    init() {
      const THREE = AFRAME.THREE;
      this.img = document.createElement("img");
      this.img.crossOrigin = "anonymous";
      this.canvas = document.createElement("canvas");
      this.canvas.width = 2;
      this.canvas.height = 2;
      this.ctx = this.canvas.getContext("2d");
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.mesh = null;
      this.img.onload = () => {
        const w0 = this.img.naturalWidth || 1;
        const h0 = this.img.naturalHeight || 1;
        this.canvas.width = w0;
        this.canvas.height = h0;
        const material = new THREE.MeshBasicMaterial({
          map: this.texture,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const geometry = new THREE.PlaneGeometry(1, h0 / w0);
        this.mesh = new THREE.Mesh(geometry, material);
        this.el.setObject3D("gif-mesh", this.mesh);
      };
      this.img.src = this.data.src;
    },
    tick() {
      if (this.ctx && this.img.complete && this.img.naturalWidth) {
        try {
          this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
          this.texture.needsUpdate = true;
        } catch {
          /* 読み込み中は無視 */
        }
      }
    },
    remove() {
      if (this.mesh) this.el.removeObject3D("gif-mesh");
    },
  });
}

// 透過MP4(左半分=RGB, 右半分=アルファのグレースケール)を再生するコンポーネント。
// GIF由来のアニメーションをffmpegで変換したファイルを想定している。
function registerAlphaVideoComponent(AFRAME: any) {
  if (AFRAME.components["alpha-video"]) return;
  AFRAME.registerComponent("alpha-video", {
    schema: { src: { type: "string" } },
    init() {
      const THREE = AFRAME.THREE;
      const video = document.createElement("video");
      video.src = this.data.src;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("playsinline", "true");
      this.video = video;

      const tryPlay = () => video.play().catch(() => {});
      tryPlay();
      const resumeOnGesture = () => {
        tryPlay();
      };
      document.addEventListener("touchend", resumeOnGesture, { once: true });
      document.addEventListener("click", resumeOnGesture, { once: true });
      this._resumeOnGesture = resumeOnGesture;

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying vec2 vUv;
          void main() {
            vec2 colorUv = vec2(vUv.x * 0.5, vUv.y);
            vec2 alphaUv = vec2(vUv.x * 0.5 + 0.5, vUv.y);
            vec3 color = texture2D(map, colorUv).rgb;
            float alpha = texture2D(map, alphaUv).r;
            if (alpha < 0.02) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });

      const geometry = new THREE.PlaneGeometry(1, 1);
      this.mesh = new THREE.Mesh(geometry, material);
      this.el.setObject3D("alpha-video-mesh", this.mesh);

      video.addEventListener("loadedmetadata", () => {
        const w = video.videoWidth / 2 || 1;
        const h = video.videoHeight || 1;
        this.mesh.scale.set(1, h / w, 1);
      });
    },
    remove() {
      if (this.mesh) this.el.removeObject3D("alpha-video-mesh");
      if (this.video) {
        this.video.pause();
        this.video.src = "";
      }
      if (this._resumeOnGesture) {
        document.removeEventListener("touchend", this._resumeOnGesture);
        document.removeEventListener("click", this._resumeOnGesture);
      }
    },
  });
}

function ObjectEntity({ url }: { url: string }) {
  const kind = assetKind(url);
  if (kind === "video") {
    return <a-entity alpha-video={`src: ${url}`} position="0 0.6 0"></a-entity>;
  }
  if (kind === "image") {
    return <a-entity gif-image={`src: ${url}`} position="0 0.6 0"></a-entity>;
  }
  return (
    <a-entity
      gltf-model={`url(${url})`}
      position="0 0 0"
      scale="0.05 0.05 0.05"
      animation="property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear"
    ></a-entity>
  );
}

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
      {displayType === "aframe" && (
        <Script src={ARJS_SRC} strategy="afterInteractive" onLoad={() => setEngineLoaded(true)} />
      )}
      {displayType === "mindar" && (
        <Script
          src={MINDAR_AFRAME_SRC}
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
