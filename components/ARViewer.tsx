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
  scale,
  rotation,
  debug = false,
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
  /** 表示オブジェクトの拡大率(A-Frameのscale属性値、例: "0.15 0.15 0.15")。
   * 管理画面のプリセット登録時に設定した値がpreset_objects.scale経由で渡される。
   * 未指定(null/undefined)の場合はObjectEntity側の既定値を使う。 */
  scale?: string | null;
  /** 表示オブジェクトの向き(A-Frameのrotation属性値、例: "0 180 0")。
   * マーカーに対して正面を向けるための調整値。管理画面/URLの?rot=から渡される。 */
  rotation?: string | null;
  /** URLに ?debug=1 が付いている場合に、カメラ映像や要素の状態を画面上に表示する。
   * 実機(特にスマホ)で「真っ暗で何も映らない」原因を切り分けるための診断用。 */
  debug?: boolean;
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

  // AR.jsはカメラ映像の<video id="arjs-video">をz-index:-2でbody直下に置く。
  // z-indexが負の要素は「ルート(body)の背景より手前・通常のコンテンツより奥」に
  // 描画されるため、ビューア側で不透明な背景を敷くとカメラ映像が隠れてしまう
  // (PCで画面が黒くなっていた原因)。背景はbodyに置くことで、映像が届かない
  // 余白だけが黒くなり、映像自体は隠れないようにする。
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#000";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  // AR.js(A-Frameのarjsシステム)は、カメラ映像を画面全体で覆うために
  // videoを「画面より大きいサイズ + 負のmargin」で配置し、同じサイズをA-Frameの
  // canvasにもコピーして、映像と3D描画をピクセル単位で一致させる設計になっている。
  // ところがA-Frame側のリサイズ処理が後からcanvasのサイズをビューポート相当に
  // 戻してしまうため、canvasだけが小さいまま取り残され、
  //  - 画面の端にcanvasが届かない帯ができる
  //  - 3Dモデルの描画位置がカメラ映像に対してずれる
  // という状態になっていた。videoのサイズをcanvasへ定期的に反映し直して、
  // AR.jsが本来意図している「映像とcanvasが同じ大きさ」を維持する。
  // (位置合わせのmarginはa-scene側に既に効いているので、canvas自身は0にする)
  useEffect(() => {
    if (!ready || displayType !== "aframe") return;
    const sync = () => {
      const video = document.querySelector("#arjs-video") as HTMLElement | null;
      const canvas = document.querySelector(".a-canvas") as HTMLElement | null;
      if (!video || !canvas || !video.style.width || !video.style.height) return;
      if (canvas.style.width !== video.style.width || canvas.style.height !== video.style.height) {
        canvas.style.width = video.style.width;
        canvas.style.height = video.style.height;
        canvas.style.marginLeft = "0px";
        canvas.style.marginTop = "0px";
      }
    };
    const timer = setInterval(sync, 300);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [ready, displayType]);

  // ?debug=1 のときだけ、カメラ映像/canvasの状態を定期的に集めて画面に出す。
  // スマホをPCに繋がなくても、画面を見るだけで
  //  - カメラ映像の取得自体ができているか(videoW/H, paused)
  //  - 要素が画面内に収まっているか(rect)
  //  - 何かに隠されていないか(z-index, 最前面の要素)
  // が分かるようにしている。
  const [diag, setDiag] = useState<string[]>([]);
  useEffect(() => {
    if (!debug) return;
    const collect = () => {
      const lines: string[] = [];
      const v = document.querySelector("#arjs-video") as HTMLVideoElement | null;
      lines.push(`ready=${ready} err=${loadError ? "あり" : "なし"}`);
      if (!v) {
        lines.push("video: 要素なし(カメラ取得前/失敗)");
      } else {
        const r = v.getBoundingClientRect();
        const cs = getComputedStyle(v);
        lines.push(`video: ${v.videoWidth}x${v.videoHeight} paused=${v.paused} ready=${v.readyState}`);
        lines.push(`  rect ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        lines.push(`  z=${cs.zIndex} vis=${cs.visibility} op=${cs.opacity} disp=${cs.display}`);
        const st = (v as any).srcObject as MediaStream | null;
        const track = st?.getVideoTracks?.()[0];
        lines.push(`  stream=${st ? "あり" : "なし"} track=${track ? track.readyState : "-"}`);
      }
      const c = document.querySelector(".a-canvas") as HTMLCanvasElement | null;
      if (c) {
        const r = c.getBoundingClientRect();
        lines.push(
          `canvas: rect ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} z=${getComputedStyle(c).zIndex}`
        );
      } else {
        lines.push("canvas: なし");
      }
      const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      lines.push(`中央の最前面: ${top ? `${top.tagName}.${(top.className || "").toString().slice(0, 24)}` : "-"}`);
      lines.push(`window ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`);
      setDiag(lines);
    };
    collect();
    const t = setInterval(collect, 1000);
    return () => clearInterval(t);
  }, [debug, ready, loadError]);

  // スマホでカメラ映像が出ない場合の保険。AR.js側でも playsinline/muted/autoplay は
  // 設定されるが、モバイルのブラウザでは自動再生が保留されたまま
  // (映像が真っ暗のまま)になることがあるため、画面のタップを拾って再生を促す。
  // 既に再生中なら play() は何もしないので、余計な副作用はない。
  useEffect(() => {
    if (!ready || displayType !== "aframe") return;
    const kick = () => {
      const video = document.querySelector("#arjs-video") as HTMLVideoElement | null;
      if (!video) return;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      if (video.paused) video.play().catch(() => {});
    };
    kick();
    document.addEventListener("touchend", kick);
    document.addEventListener("click", kick);
    return () => {
      document.removeEventListener("touchend", kick);
      document.removeEventListener("click", kick);
    };
  }, [ready, displayType]);

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

  // 読み込み中・エラー時は黒背景で覆ってよいが、AR表示中(ready)は透明にしておく。
  // (不透明な背景を敷いたままだと、z-index:-2のカメラ映像が隠れてしまう)
  const wrapperBg = ready && !loadError ? "" : "bg-black";

  return (
    <div className={`h-screen w-screen relative ${wrapperBg}`}>
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

      {debug && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-black/75 text-green-300 text-[10px] leading-tight p-2 font-mono whitespace-pre-wrap pointer-events-none">
          {diag.join("\n")}
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
            <ObjectEntity
              url={modelUrl}
              scale={scale}
              rotation={rotation}
              visible={revealed}
              loop={false}
            />
            {!revealed && isCategorySuspenseAvailable(category) && (
              <CategorySuspenseEntity category={category} scale={scale} />
            )}
            {!revealed && !isCategorySuspenseAvailable(category) && <SuspenseEntity scale={scale} />}
          </a-entity>
        </a-scene>
      )}

      {ready && displayType === "aframe" && (
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          // A-Frameは端末の向きによって全画面の案内モーダル(.a-orientation-modal、
          // 背景#F4F4F4のほぼ白)を表示することがある。AR.jsはマーカー認識(画像処理)
          // でトラッキングしており端末の向きセンサーを使わないため、この案内自体が
          // 不要。スマホでのホワイトアウトの候補としても無効化しておく。
          device-orientation-permission-ui="enabled: false"
          arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3; trackingMethod: best; patternRatio: 0.9; sourceWidth: 1280; sourceHeight: 960; displayWidth: 1280; displayHeight: 960;"
          renderer="logarithmicDepthBuffer: true;"
        >
          <a-marker type="pattern" url={marker} ref={targetElRef}>
            <ObjectEntity
              url={modelUrl}
              scale={scale}
              rotation={rotation}
              visible={revealed}
              loop={false}
            />
            {!revealed && isCategorySuspenseAvailable(category) && (
              <CategorySuspenseEntity category={category} scale={scale} />
            )}
            {!revealed && !isCategorySuspenseAvailable(category) && <SuspenseEntity scale={scale} />}
          </a-marker>
          <a-entity camera></a-entity>
        </a-scene>
      )}
    </div>
  );
}
