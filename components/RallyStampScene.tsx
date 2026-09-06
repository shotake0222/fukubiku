"use client";

import { useEffect, useRef, useState } from "react";
import {
  AFRAME_EXTRAS_SRC,
  AFRAME_SRC,
  ObjectEntity,
  loadArScript,
  registerAlphaVideoComponent,
  registerGifImageComponent,
} from "./arObjectComponents";

/**
 * スポットに到着した時／コンプリートした時に出すARの見せ場。
 *
 * マーカーも位置も判定しない（到着判定はGPSやQRで既に済んでいる）ので、
 * AR.jsは使わずカメラ映像をそのまま背景に敷き、その手前にオブジェクトを浮かべる。
 * AR.jsは認識対象が無いと映像サイズの計算が破綻することを実測で確認しているため、
 * ここでは getUserMedia で取得した映像を直接 <video> に流している。
 */
export default function RallyStampScene({
  modelUrl,
  position = "0 0 0",
  scale,
  rotationY = 0,
  children,
}: {
  modelUrl: string | null;
  position?: string;
  scale?: string | null;
  rotationY?: number;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const registeredRef = useRef(false);

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
        // カメラが使えなくてもスタンプ自体は取得済みなので、
        // 背景を暗くしてオブジェクトだけ見せる（体験を止めない）。
        setCameraError("カメラを利用できませんでした");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        await loadArScript(AFRAME_SRC);
        if (cancelled) return;
        await loadArScript(AFRAME_EXTRAS_SRC);
        if (cancelled) return;
        const AFRAME = (window as any).AFRAME;
        if (AFRAME && !registeredRef.current) {
          registerGifImageComponent(AFRAME);
          registerAlphaVideoComponent(AFRAME);
          registeredRef.current = true;
        }
        setReady(true);
      } catch (e) {
        console.error("[RallyStampScene] スクリプト読み込みエラー:", e);
        // 3Dが読めなくても演出のオーバーレイだけは出す
        setReady(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />
      {cameraError && <div className="absolute inset-0 bg-slate-900/80" />}

      {ready && modelUrl && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          renderer="alpha: true; colorManagement: true"
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
        >
          {/* カメラは原点。少し前方に置くと目の前に浮かんで見える */}
          <a-entity position="0 0 -2.4">
            <ObjectEntity
              url={modelUrl}
              position={position}
              scale={scale}
              rotation={`0 ${rotationY} 0`}
            />
          </a-entity>
          <a-entity light="type: ambient; intensity: 0.9"></a-entity>
          <a-entity light="type: directional; intensity: 0.6" position="1 2 1"></a-entity>
          <a-entity camera look-controls="magicWindowTrackingEnabled: true; mouseEnabled: false; touchEnabled: false"></a-entity>
        </a-scene>
      )}

      <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>
    </div>
  );
}
