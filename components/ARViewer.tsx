"use client";

import { useEffect, useRef, useState } from "react";
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
  loadArScript,
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
  cooldownHours = DRAW_COOLDOWN_HOURS,
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
  /** 再抽選クールダウン時間(時間単位)。抽選セットごとに管理画面で設定した値が渡される。
   * Cookie発行時のmax-ageに使う。未指定時はDRAW_COOLDOWN_HOURS(デフォルト値)。 */
  cooldownHours?: number;
}) {
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [engineLoaded, setEngineLoaded] = useState(false); // arjs or mindar
  const [extrasLoaded, setExtrasLoaded] = useState(false); // aframe-extras (animation-mixer)
  const [loadError, setLoadError] = useState<string | null>(null);
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
    document.cookie = `${name}=${value}; max-age=${cooldownHours * 3600}; path=/`;
  }, [blocked, hash, category, cooldownHours]);

  // A-Frame本体を読み込んでから、それに依存するaframe-extrasとAR.js/MindARを読み込む。
  // (blocked時や景品未設定時はAR自体を描画しないので、その場合は何もしない)
  useEffect(() => {
    if (blocked || !modelUrl || (displayType === "mindar" && !mindFileUrl)) return;
    let cancelled = false;

    async function run() {
      try {
        await loadArScript(AFRAME_SRC);
        if (cancelled) return;
        setAframeLoaded(true);

        const engineSrc = displayType === "mindar" ? MINDAR_IMAGE_AFRAME_SRC : ARJS_SRC;
        await Promise.all([
          loadArScript(AFRAME_EXTRAS_SRC).then(() => {
            if (!cancelled) setExtrasLoaded(true);
          }),
          loadArScript(engineSrc).then(() => {
            if (!cancelled) setEngineLoaded(true);
          }),
        ]);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? String(e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [blocked, modelUrl, mindFileUrl, displayType]);

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
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white text-sm px-6 text-center z-20">
          <p>読み込みに失敗しました。電波状況の良い場所でもう一度お試しください。</p>
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
