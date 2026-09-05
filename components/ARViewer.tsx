"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { DisplayType } from "@/lib/types";
import {
  AFRAME_EXTRAS_SRC,
  AFRAME_SRC,
  ARJS_SRC,
  MINDAR_IMAGE_AFRAME_SRC,
  CategorySuspenseEntity,
  ObjectEntity,
  SuspenseEntity,
  isCategorySuspenseAvailable,
  registerAlphaVideoComponent,
  registerGifImageComponent,
} from "./arObjectComponents";
import {
  DRAW_COOLDOWN_HOURS,
  buildRetryMessage,
  drawCookieName,
  encodeDrawCookieValue,
} from "@/lib/drawCooldown";

const DEFAULT_MARKER_URL = "/markers/patternkuji.patt";
// マーカー/ターゲットを検出してから結果を表示するまでの「焦らし」時間(ミリ秒)。
// 毎回同じ長さだと味気ないため、この範囲でランダムに揺らす。
const REVEAL_DELAY_MIN_MS = 3000;
const REVEAL_DELAY_MAX_MS = 5000;

export default function ARViewer({
  displayType,
  modelUrl,
  mindFileUrl,
  markerUrl,
  category,
  hash,
  blocked = false,
  retryCategory = null,
  remainingMs = 0,
}: {
  displayType: DisplayType;
  modelUrl: string | null;
  mindFileUrl: string | null;
  markerUrl?: string | null;
  /** fukubikuの固定カテゴリ(あみだ/ボックス/おみくじ/ダーツ/ガラガラ/スクラッチ/...)。
   * 焦らし演出をカテゴリ専用のものにするために使う。カスタムアップロード等ではnull。 */
  category?: string | null;
  /** 抽選セット(draw_groups)の共有URLのハッシュ。再抽選クールダウン用のCookieを
   * このハッシュ単位で発行するために使う(orders側の固定景品フローでは未指定でよい)。 */
  hash?: string;
  /** trueの場合、クールダウン中(Cookieで検出済み)につきAR演出自体を行わず、
   * 「時間をおいて再チャレンジ」の案内だけを表示する。 */
  blocked?: boolean;
  /** blocked時、前回の抽選で選ばれていたカテゴリ(案内文言の出し分けに使用)。 */
  retryCategory?: string | null;
  /** blocked時の残りクールダウン時間(ミリ秒)。 */
  remainingMs?: number;
}) {
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false); // arjs or mindar
  const [extrasLoaded, setExtrasLoaded] = useState(false); // aframe-extras (animation-mixer)
  const [revealed, setRevealed] = useState(false);
  const registeredRef = useRef(false);
  const targetElRef = useRef<any>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cookieSetRef = useRef(false);

  // 新規に抽選が行われた(blockedでない)場合、クールダウン用のCookieを1回だけ発行する。
  // このページ自体はサーバーコンポーネントでレンダーされるため、レンダー中にCookieを
  // 発行することはできない(Server Action / Route Handler以外では不可)。そのため、
  // クライアント側でマウント時にdocument.cookieへ書き込む形にしている。
  useEffect(() => {
    if (blocked || !hash || cookieSetRef.current) return;
    cookieSetRef.current = true;
    const name = drawCookieName(hash);
    const value = encodeDrawCookieValue(category ?? null);
    document.cookie = `${name}=${value}; max-age=${DRAW_COOLDOWN_HOURS * 3600}; path=/`;
  }, [blocked, hash, category]);

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

  // マーカー(またはMindARターゲット)を検出したタイミングを起点に、少し焦らしてから結果を表示する。
  useEffect(() => {
    if (!ready || revealed) return;
    const el = targetElRef.current;
    if (!el) return;
    const eventName = displayType === "mindar" ? "targetFound" : "markerFound";
    const onFound = () => {
      if (revealTimerRef.current) return;
      const delay =
        REVEAL_DELAY_MIN_MS + Math.random() * (REVEAL_DELAY_MAX_MS - REVEAL_DELAY_MIN_MS);
      revealTimerRef.current = setTimeout(() => setRevealed(true), delay);
    };
    el.addEventListener(eventName, onFound);
    return () => {
      el.removeEventListener(eventName, onFound);
    };
  }, [ready, revealed, displayType]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  if (blocked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
        {buildRetryMessage(retryCategory, remainingMs)}
      </div>
    );
  }

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
          <a-entity mindar-image-target="targetIndex: 0" ref={targetElRef}>
            <ObjectEntity url={modelUrl} visible={revealed} loop={false} />
            {!revealed && isCategorySuspenseAvailable(category) && (
              <CategorySuspenseEntity category={category} />
            )}
            {!revealed && !isCategorySuspenseAvailable(category) && <SuspenseEntity />}
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
          <a-marker type="pattern" url={marker} ref={targetElRef}>
            <ObjectEntity url={modelUrl} visible={revealed} loop={false} />
            {!revealed && isCategorySuspenseAvailable(category) && (
              <CategorySuspenseEntity category={category} />
            )}
            {!revealed && !isCategorySuspenseAvailable(category) && <SuspenseEntity />}
          </a-marker>
          <a-entity camera></a-entity>
        </a-scene>
      )}
    </div>
  );
}
