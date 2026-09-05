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
  registerCenterModelComponent,
  registerGifImageComponent,
  registerMarkerHoldComponent,
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
  position,
  thresholdMode = 2,
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
  /** 表示オブジェクトの位置(A-Frameのposition属性値、例: "0 0 -0.3")。
   * マーカーに対する上下左右・奥行きの微調整に使う。 */
  position?: string | null;
  /** ARToolKitの二値化しきい値モード(0=手動/1=中央値/2=大津/3=適応的/4=ブラケット)。
   * 照明ムラやグレアに弱い場合の調整用。URLの ?thresh= で上書きできる。 */
  thresholdMode?: number;
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
  // AR.jsのカメラ映像とA-Frameのcanvasを閉じ込める描画用コンテナ
  const arViewportRef = useRef<HTMLDivElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 診断用: マーカー(ターゲット)を何回検出したか
  const foundCountRef = useRef(0);
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
      registerCenterModelComponent(AFRAME);
      registerMarkerHoldComponent(AFRAME);
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
      foundCountRef.current += 1;
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

  // AR.jsはカメラ映像の<video id="arjs-video">をz-index:-2でbody直下に置くが、
  // 実機のスマホではこの映像がページ背景の下に隠れてしまい、まったく表示されない
  // (背景を白にすれば白一色、黒にすれば黒一色になる)状態が確認された。
  // そこで負のz-index+body直下という配置に依存するのをやめ、
  //   1. isolation:isolate で独立した重なり順を持つコンテナへvideoを移動し
  //   2. video=0 / a-scene・canvas=1 という明示的な重なり順を与え
  //   3. サイズと位置はCSS側で100%固定にする
  // という構成にする(AR.js+MindARを実運用している別サービスと同じ考え方)。
  // AR.jsとA-Frameは初期化後もインラインstyleでサイズや負のmarginを書き戻してくるため、
  // 競合するインライン指定を定期的に消してCSSが効く状態を保つ。
  useEffect(() => {
    if (!ready || displayType !== "aframe") return;

    const normalize = () => {
      const container = arViewportRef.current;
      if (!container) return;

      const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
      const cameraVideos = videos.filter((v) => v.id === "arjs-video" || Boolean(v.srcObject));

      cameraVideos.forEach((video) => {
        // body直下に置かれたカメラ映像をコンテナ内へ取り込む
        if (!container.contains(video)) container.prepend(video);
        // モバイルで自動再生が保留されたままになるケースへの保険
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        if (video.paused) video.play().catch(() => {});
      });

      const scene = container.querySelector("a-scene") as HTMLElement | null;
      const canvas = container.querySelector(".a-canvas") as HTMLElement | null;
      const targets = [scene, canvas, ...cameraVideos].filter(
        (el): el is HTMLElement => !!el && container.contains(el)
      );
      // AR.jsは<body>自体にも幅・高さ・負のmarginを書き込んでページ全体をずらすため、
      // CSS(ar-active)だけに頼らずインライン指定も消しておく。
      targets.push(document.body, document.documentElement, container);
      targets.forEach((el) => {
        el.style.removeProperty("width");
        el.style.removeProperty("height");
        el.style.removeProperty("margin-left");
        el.style.removeProperty("margin-top");
        el.style.removeProperty("transform");
      });
    };

    // AR表示中だけ、bodyのサイズ/marginを固定するクラスを付ける
    document.documentElement.classList.add("ar-active");
    document.body.classList.add("ar-active");

    normalize();
    const timer = setInterval(normalize, 300);
    window.addEventListener("resize", normalize);
    window.addEventListener("orientationchange", normalize);
    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", normalize);
      window.removeEventListener("orientationchange", normalize);
      observer.disconnect();
      document.documentElement.classList.remove("ar-active");
      document.body.classList.remove("ar-active");
    };
  }, [ready, displayType]);

  // ARToolKitの二値化(しきい値)モードを設定する。
  // 既定は固定しきい値で、印刷物の照り返し(グレア)や照明ムラがあると
  // 黒枠を安定して拾えず「正面からだと反応しないのに斜めだと反応する」
  // といった不安定さが出る。フレームごとに最適なしきい値を計算するモードに
  // 切り替えて、明るさのばらつきに強くする。
  //   0=手動 1=中央値 2=大津の手法 3=適応的 4=ブラケット
  // 既定は2(大津)。端末で試したい場合は ?thresh=3 のように上書きできる。
  useEffect(() => {
    if (!ready || displayType !== "aframe") return;
    let done = false;
    const applyThreshold = () => {
      if (done) return;
      const scene = document.querySelector("a-scene") as any;
      const sys = scene?.systems?.arjs;
      const controller = (sys?._arSession ?? sys?.arSession)?.arContext?.arController;
      if (!controller?.setThresholdMode) return;
      try {
        controller.setThresholdMode(thresholdMode);
        done = true;
        console.log("[ARViewer] しきい値モードを設定:", thresholdMode);
      } catch (e) {
        console.warn("[ARViewer] しきい値モードの設定に失敗:", e);
      }
    };
    applyThreshold();
    const timer = setInterval(() => {
      applyThreshold();
      if (done) clearInterval(timer);
    }, 500);
    // 初期化に時間がかかる端末もあるので、一定時間で諦める
    const stop = setTimeout(() => clearInterval(timer), 15000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [ready, displayType, thresholdMode]);

  // ?debug=1 のときだけ、カメラ映像/canvasの状態を定期的に集めて画面に出す。
  // スマホをPCに繋がなくても、画面を見るだけで
  //  - カメラ映像の取得自体ができているか(videoW/H, paused)
  //  - 要素が画面内に収まっているか(rect)
  //  - 何かに隠されていないか(z-index, 最前面の要素)
  // が分かるようにしている。
  const [diag, setDiag] = useState<string[]>([]);

  // 画面に出す日時(旧実装のindex.htmlと同じ「YYYY年M月D日 H時M分 曜日」形式)。
  // サーバーとクライアントで文字列がずれるとhydrationエラーになるため、
  // マウント後にクライアント側で組み立てる。
  const [nowLabel, setNowLabel] = useState("");
  useEffect(() => {
    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const render = () => {
      const d = new Date();
      setNowLabel(
        `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ` +
          `${d.getHours()}時${String(d.getMinutes()).padStart(2, "0")}分 ${week[d.getDay()]}曜日`
      );
    };
    render();
    const timer = setInterval(render, 30000);
    return () => clearInterval(timer);
  }, []);

  // 撮影した画像(データURL)。表示中は画面全体にプレビューを出す。
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // カメラ映像とARの描画(canvas)を1枚に合成して写真にする。
  // 旧実装のスナップショット機能と同じ考え方だが、映像の縦横比が画面と違っても
  // 切れ方が不自然にならないよう、画面と同じ「はみ出した分を切り取る」方式で合成する。
  const takeSnapshot = () => {
    setSnapshotError(null);
    try {
      const container = arViewportRef.current;
      const video = (container?.querySelector("video") ??
        document.querySelector("#arjs-video")) as HTMLVideoElement | null;
      const arCanvas = document.querySelector(".a-canvas") as HTMLCanvasElement | null;
      if (!video && !arCanvas) {
        setSnapshotError("カメラ映像がまだ準備できていません。少し待ってからもう一度お試しください。");
        return;
      }

      const width = Math.round(container?.clientWidth || window.innerWidth);
      const height = Math.round(container?.clientHeight || window.innerHeight);
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d");
      if (!ctx) {
        setSnapshotError("画像の生成に失敗しました。");
        return;
      }

      if (video && video.videoWidth > 0) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = width / height;
        let drawW: number, drawH: number, offsetX: number, offsetY: number;
        if (videoRatio > canvasRatio) {
          drawH = height;
          drawW = height * videoRatio;
          offsetX = (width - drawW) / 2;
          offsetY = 0;
        } else {
          drawW = width;
          drawH = width / videoRatio;
          offsetX = 0;
          offsetY = (height - drawH) / 2;
        }
        ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
      }
      if (arCanvas) {
        ctx.drawImage(arCanvas, 0, 0, width, height);
      }
      setSnapshot(out.toDataURL("image/png"));
    } catch (e: any) {
      console.error("[ARViewer] 撮影に失敗:", e);
      setSnapshotError(`撮影に失敗しました: ${e?.message ?? e}`);
    }
  };
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
      // オブジェクト側の状態(スマホで「カメラは映るがオブジェクトが出ない」の切り分け用)
      lines.push(`マーカー検出=${foundCountRef.current}回 結果表示=${revealed}`);
      const modelEl = document.querySelector("[gltf-model]") as any;
      if (!modelEl) {
        lines.push("model: エンティティ無し");
      } else {
        const obj = modelEl.object3D;
        const loaded = !!obj && obj.children.length > 0;
        lines.push(
          `model: 読込=${loaded ? "済" : "まだ"} visible=${modelEl.getAttribute("visible")}` +
            ` scale=${modelEl.getAttribute("scale") ?? "-"} rot=${modelEl.getAttribute("rotation") ?? "-"}`
        );
      }
      lines.push(`body style=${document.body.getAttribute("style") || "(なし)"}`);

      const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      lines.push(`中央の最前面: ${top ? `${top.tagName}.${(top.className || "").toString().slice(0, 24)}` : "-"}`);
      lines.push(`window ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`);
      setDiag(lines);
    };
    collect();
    const t = setInterval(collect, 1000);
    return () => clearInterval(t);
  }, [debug, ready, loadError, revealed]);

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

      {/* 日時表示(旧実装と同じ位置・体裁)。撮影した写真にも写り込むよう常時表示する。 */}
      {ready && !debug && nowLabel && (
        <div
          className="absolute top-5 left-0 w-full px-3 text-center z-20 pointer-events-none text-[#2196F3] font-bold text-[18px]"
          style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.8)" }}
        >
          {nowLabel}
        </div>
      )}

      {/* 撮影した写真のプレビュー */}
      {snapshot && (
        <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot} alt="撮影した写真" className="max-w-full max-h-[75%] object-contain rounded-lg" />
          <div className="flex gap-3">
            <a
              href={snapshot}
              download={`fukubiku_${Date.now()}.png`}
              className="px-5 py-3 rounded-full bg-white text-slate-900 text-sm font-bold shadow-lg"
            >
              保存する
            </a>
            <button
              type="button"
              onClick={() => setSnapshot(null)}
              className="px-5 py-3 rounded-full border border-white/60 text-white text-sm font-bold"
            >
              閉じる
            </button>
          </div>
          <p className="text-white/60 text-xs text-center">
            うまく保存できない場合は、写真を長押しして「画像を保存」からも保存できます。
          </p>
        </div>
      )}

      {/* 撮影ボタン */}
      {ready && !snapshot && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-24 pt-4 flex flex-col items-center gap-2">
          {snapshotError && (
            <p className="text-white text-xs bg-black/70 rounded px-3 py-1 mx-4 text-center">{snapshotError}</p>
          )}
          <button
            type="button"
            onClick={takeSnapshot}
            aria-label="写真を撮る"
            className="w-16 h-16 rounded-full bg-white/95 shadow-2xl border-4 border-white/60 flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className="block w-11 h-11 rounded-full border-[3px] border-slate-800" />
          </button>
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
              position={position || undefined}
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
        <div ref={arViewportRef} className="ar-camera-viewport">
        <a-scene
          embedded
          vr-mode-ui="enabled: false"
          // A-Frameは端末の向きによって全画面の案内モーダル(.a-orientation-modal、
          // 背景#F4F4F4のほぼ白)を表示することがある。AR.jsはマーカー認識(画像処理)
          // でトラッキングしており端末の向きセンサーを使わないため、この案内自体が
          // 不要。スマホでのホワイトアウトの候補としても無効化しておく。
          device-orientation-permission-ui="enabled: false"
          // 実績のある旧実装(index.html)の指定に揃える。スマホでだけARが出ない件の
          // 切り分けとして、こちらで足していた差分(matrixコード検出/解像度の固定指定)を
          // 外し、同じマーカーで動作実績のある最小構成に戻す。
          //  - detectionMode: パターンマーカーのみ使うので mono で十分
          //    (mono_and_matrix はマトリクスコード検出も並行して行い、端末によっては
          //     処理が重くなって検出が不安定になりうる)
          //  - sourceWidth/Height の固定指定は外し、端末が得意な解像度に任せる
          // cameraParametersUrl: マーカー検出に使うカメラ内部パラメータ。
          // 未指定だとAR.jsは既定で外部(https://ar-js-org.github.io/AR.js/data/data/camera_para.dat)へ
          // 毎回取りに行く。ここが失敗すると検出器を初期化できず、
          // 「カメラ映像は出るがマーカーにまったく反応せず、エラーも出ない」状態になる。
          // 回線やDNS、拡張機能の影響を受けるため端末差が出やすい(スマホだけ動かない典型)。
          // ファイルは176バイトと小さいので同一オリジンに同梱して外部依存をなくす。
          arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono; trackingMethod: best; patternRatio: 0.9; cameraParametersUrl: /vendor/camera_para.dat; maxDetectionRate: 30;"
          // preserveDrawingBuffer: 描画後もWebGLのバッファを保持する指定。
          // これが無いと、撮影時にcanvasを読み出しても中身が空になることがある。
          // logarithmicDepthBuffer はGPUの拡張機能に依存し、端末によっては
          // 描画されない原因になりうるため外した(旧実装でも未指定)。
          // preserveDrawingBuffer は撮影機能に必要。
          renderer="alpha: true; preserveDrawingBuffer: true;"
        >
          {/* preset="custom" は旧実装と同じ指定。省略時の既定プリセットに
              引きずられないよう、独自パターンを使うことを明示しておく。 */}
          {/* smooth系: AR.jsの姿勢スムージング。1フレームでも検出を外すと
              オブジェクトが消えてチカチカするため、数フレーム分を平均して安定させる。
              marker-hold: それでも一瞬途切れた場合に、最後の姿勢のまま少しだけ
              表示を保って明滅を吸収する(独自コンポーネント)。 */}
          <a-marker
            preset="custom"
            type="pattern"
            url={marker}
            smooth="true"
            smoothCount="10"
            smoothTolerance="0.01"
            smoothThreshold="5"
            marker-hold="ms: 700"
            ref={targetElRef}
          >
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
        </div>
      )}
    </div>
  );
}
