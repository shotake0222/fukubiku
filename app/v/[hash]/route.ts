import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRESET_CATEGORIES } from "@/lib/types";
import type { DrawGroup, DrawGroupEntry, Order, PresetObject } from "@/lib/types";
import {
  buildLimitReachedMessage,
  isLimitPeriod,
  limitWindowStart,
} from "@/lib/drawLimit";
import {
  DRAW_COOLDOWN_HOURS,
  buildRetryMessage,
  decodeDrawCookieValue,
  drawCookieName,
  encodeDrawCookieValue,
  getRemainingCooldownMs,
} from "@/lib/drawCooldown";

// ARビューアは React を一切通さず、サーバーが組み立てたHTMLをそのまま返す。
//
// 経緯: Reactコンポーネント(ARViewer)としてA-Frame/AR.jsを描画していたが、
// 実機のスマホで表示できない状態が続いた。一方、同じマーカー・同じアセットで
// 動作実績のある素のHTML実装(index.html)は問題なく動く。
// 両者の差分を1つずつ潰すより、動く実装の構造をそのまま採用するほうが確実なため、
// このルートでは Route Handler で text/html を直接返す方式にした。
// 抽選(どの景品を出すか)はサーバー側で解決し、その結果だけをHTMLに埋め込む。
export const dynamic = "force-dynamic";

// 透過MP4/GIFを描画するA-Frameコンポーネントは public/ar/ar-objects.js に、
// 失敗検知と復帰処理は public/ar/ar-boot.js に切り出してある。
// (以前はこのファイルに1行のエスケープ済み文字列として埋め込まれており、
//  手を入れるのが現実的でなかった。静的ファイルにしたことで読める・
//  キャッシュが効く・HTMLが軽くなる、が同時に得られる)
const AR_OBJECTS_SRC = "/ar/ar-objects.js";
const AR_BOOT_SRC = "/ar/ar-boot.js";

// マーカーの姿勢を「マーカーの外側にある別エンティティ(ステージ)」へ写して描画する。
//
// AR.jsは検出処理のたびに、その回で検出できなかったマーカーのobject3D.visibleを
// falseへ戻す。つまり1フレーム検出を落としただけでオブジェクトが消えるため、
// マーカー直下にオブジェクトを置くと表示が途切れ続ける。
// そこでマーカーには何も置かず、姿勢だけをステージへ渡す:
//   - 姿勢は毎フレーム補間して追従させる(生の検出値をそのまま使うとガクガクする)
//   - 検出が途切れても hold(ミリ秒) の間は直前の姿勢で表示を維持する
// これによりMindAR側(targetLostで同様にvisibleが落ちる)も同じ扱いにできる。
const TRACKING_COMPONENT = `
if (window.AFRAME && !AFRAME.components["cap-pixel-ratio"]) {
  // 高精細なスマホ(devicePixelRatio 3など)では、描画するピクセル数が
  // 画面の9倍になりGPUが追いつかず、カクつきの原因になる。
  // AR.jsは映像サイズに合わせてrendererのsetSizeを呼び直すが、
  // setPixelRatioの値はその後も保持されるため、ここで一度だけ上限を設ける。
  // 背景がカメラ映像である以上、2倍を超える解像度は見た目にほぼ寄与しない。
  AFRAME.registerComponent("cap-pixel-ratio", {
    schema: { max: { default: 2 } },
    init: function () {
      var self = this;
      var apply = function () {
        var r = self.el.renderer;
        if (!r) return;
        var want = Math.min(window.devicePixelRatio || 1, self.data.max);
        if (r.getPixelRatio() !== want) r.setPixelRatio(want);
      };
      apply();
      this.el.addEventListener("renderstart", apply);
      window.addEventListener("arjs-video-loaded", apply);
      window.addEventListener("resize", apply);
    }
  });
}
if (window.AFRAME && !AFRAME.components["marker-pose"]) {
  // 1ユーロフィルタ(One Euro Filter)。
  //
  // 固定の平滑化係数だと「止まっているときの揺れを消す」と「動かしたときに
  // 遅れずについてくる」が両立しない。係数を強めると揺れは減るが、
  // マーカーを動かしたときにオブジェクトが遅れてついてくる。
  // このフィルタは変化の速さを見て係数を自動で切り替える:
  //   ほぼ止まっている → 強くならす(揺れが消える)
  //   速く動いている   → 追従を優先する(遅れが出ない)
  function OneEuro(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff;   // 静止時の遮断周波数(Hz)。小さいほど揺れに強い
    this.beta = beta;             // 速さに応じて遮断周波数を上げる度合い
    this.dCutoff = dCutoff;       // 速度自体をならす遮断周波数
    this.x = null;                // 直前の出力
    this.dx = 0;                  // ならした変化速度
  }
  OneEuro.prototype.alpha = function (cutoff, dtSec) {
    var tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dtSec);
  };
  OneEuro.prototype.filter = function (value, dtSec) {
    if (this.x === null) { this.x = value; return value; }
    var dRaw = (value - this.x) / dtSec;
    var aD = this.alpha(this.dCutoff, dtSec);
    this.dx = aD * dRaw + (1 - aD) * this.dx;
    var cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    var a = this.alpha(cutoff, dtSec);
    this.x = a * value + (1 - a) * this.x;
    return this.x;
  };

  AFRAME.registerComponent("marker-pose", {
    schema: {
      stage: { type: "string" },
      hold: { default: 1200 },
      // 静止時の遮断周波数(Hz)。小さいほど揺れに強いが、動かしたときの遅れが増える
      minCutoff: { default: 0.7 },
      // 速く動かしたときにどれだけ追従を優先するか
      beta: { default: 0.35 },
      // 回転の平滑化の強さ(位置と同じ考え方。単位はrad/s)
      rotMinCutoff: { default: 0.7 },
      rotBeta: { default: 0.6 }
    },
    init: function () {
      var THREE = AFRAME.THREE;
      this.p = new THREE.Vector3();
      this.q = new THREE.Quaternion();
      this.s = new THREE.Vector3();
      this.prevQ = new THREE.Quaternion();
      this.started = false;
      this.lastSeen = 0;
      this.shown = false;
      this.fx = new OneEuro(this.data.minCutoff, this.data.beta, 1);
      this.fy = new OneEuro(this.data.minCutoff, this.data.beta, 1);
      this.fz = new OneEuro(this.data.minCutoff, this.data.beta, 1);
      this.fRot = new OneEuro(this.data.rotMinCutoff, this.data.rotBeta, 1);
      this.rotSpeed = 0;
    },
    tick: function (time, dt) {
      var stageEl = this.stageEl || (this.stageEl = document.querySelector(this.data.stage));
      if (!stageEl || !stageEl.object3D) return;
      var THREE = AFRAME.THREE;
      var m = this.el.object3D;
      var st = stageEl.object3D;
      if (m.visible) {
        m.updateMatrixWorld(true);
        m.matrixWorld.decompose(this.p, this.q, this.s);
        // 四元数は符号が反転しても同じ回転を表す。前回と逆向きだと
        // 補間が遠回りして跳ねるため、近い側へ揃えておく。
        if (this.started && this.prevQ.dot(this.q) < 0) {
          this.q.set(-this.q.x, -this.q.y, -this.q.z, -this.q.w);
        }
        if (!this.started) {
          st.position.copy(this.p); st.quaternion.copy(this.q); st.scale.copy(this.s);
          this.prevQ.copy(this.q);
          this.started = true;
        } else {
          var dtSec = dt > 0 ? dt / 1000 : 1 / 60;
          st.position.set(
            this.fx.filter(this.p.x, dtSec),
            this.fy.filter(this.p.y, dtSec),
            this.fz.filter(this.p.z, dtSec)
          );
          // 回転も位置と同じ考え方。今の姿勢から目標までの角速度(rad/s)を
          // ならしたうえで、速いほど追従を優先するよう補間率を決める。
          var angle = 2 * Math.acos(Math.min(1, Math.abs(st.quaternion.dot(this.q))));
          var speed = this.fRot.filter(angle / dtSec, dtSec);
          var cutoff = this.data.rotMinCutoff + this.data.rotBeta * Math.abs(speed);
          var tau = 1 / (2 * Math.PI * cutoff);
          var aR = 1 / (1 + tau / dtSec);
          st.quaternion.slerp(this.q, Math.min(1, Math.max(0, aR)));
          this.prevQ.copy(this.q);
          // 大きさはほぼ揺れないので軽く追従させるだけでよい
          st.scale.lerp(this.s, Math.min(1, 0.2 * (dt / 16.7)));
        }
        this.lastSeen = time;
        if (!this.shown) {
          this.shown = true;
          st.visible = true;
          stageEl.emit("ar-shown");
        }
      } else if (this.shown && time - this.lastSeen > this.data.hold) {
        this.shown = false;
        st.visible = false;
        stageEl.emit("ar-hidden");
      }
    }
  });
}
`;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 抽選セットのentriesから、weight(重み)に応じて1件をランダムに選ぶ。
function pickWeighted(entries: DrawGroupEntry[]): DrawGroupEntry | null {
  const total = entries.reduce((sum, e) => sum + Number(e.weight), 0);
  if (total <= 0) return entries[0] ?? null;
  let r = Math.random() * total;
  for (const e of entries) {
    const w = Number(e.weight);
    if (r < w) return e;
    r -= w;
  }
  return entries[entries.length - 1];
}

// 全29カテゴリに <カテゴリ>_suspense_3d.glb と <カテゴリ>_cookie_3d.glb が存在する
// (public/presets/ 配下。存在は実ファイルで確認済み)。
const CATEGORY_SLUGS = new Set(PRESET_CATEGORIES.map((c) => c.value));

// 結果発表までの「焦らし」演出に使うモデル。結果バッジの無い、そのカテゴリの
// 実物がアニメーションしているだけの.glb。
function suspenseUrlFor(category: string | null): string | null {
  if (!category || !CATEGORY_SLUGS.has(category)) return null;
  return "/presets/" + category + "/" + category + "_suspense_3d.glb";
}

// クールダウン中(=すでに抽選済み)に表示する「またね」モデル。
// 旧実装(index.html)でCookie保持時に <カテゴリ>_cookie.mp4 を出していたのと同じ役割。
function cookieUrlFor(category: string | null): string | null {
  if (!category || !CATEGORY_SLUGS.has(category)) return null;
  return "/presets/" + category + "/" + category + "_cookie_3d.glb";
}

// 透過MP4/画像のURLから、同じ景品の3Dモデル版(.glb)のURLを導く。
//   /presets/darts/darts_atari.mp4 → /presets/darts/darts_atari_3d.glb
// テンプレートは命名規則が揃っているのでURLだけで対応が取れる。
// (DBを引き直す必要がないので、表示直前でも確実に用意できる)
function modelFallbackFor(url: string): string | null {
  const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  const m = /^\/presets\/([a-z0-9]+)\/([a-z0-9]+)_([a-z0-9]+)\.(mp4|gif|png|jpe?g|webp)$/i.exec(path);
  if (!m) return null;
  const [, dir, prefix, tier] = m;
  if (dir !== prefix || !CATEGORY_SLUGS.has(dir)) return null;
  return "/presets/" + dir + "/" + prefix + "_" + tier + "_3d.glb";
}

function assetKind(url: string): "video" | "image" | "model" {
  if (/\.mp4(\?|$)/i.test(url)) return "video";
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) return "image";
  return "model";
}

// "x y z" 形式の数値のみ受け付ける(不正値でオブジェクトが画面外へ飛ぶのを防ぐ)
function vec3(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums.join(" ");
}

function scaleValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 1 && parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n > 100)) return null;
  return nums.length === 1 ? nums[0] + " " + nums[0] + " " + nums[0] : nums.join(" ");
}

function simplePage(bodyHtml: string, status = 200): Response {
  const html =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    "<title>fukubiku</title><style>" +
    "html,body{height:100%;margin:0;background:#0f172a;color:#fff;" +
    "font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}" +
    ".c{height:100%;display:flex;align-items:center;justify-content:center;" +
    "text-align:center;padding:24px;font-size:15px;line-height:1.8}" +
    "</style></head><body><div class=\"c\">" +
    bodyHtml +
    "</div></body></html>";
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// 動作実績のある旧実装(index.html)と同じ構造のARページを組み立てる。
// 結果が出るまでの最低演出時間。旧実装は3〜5秒のランダムだったが、
// 「結果が出るのが早すぎる」ため5秒に固定する。
const REVEAL_DELAY_MS = 5000;

// 表示エンジンごとの「正面がカメラを向く」既定の向き。
//
// AR.js(マーカー): マーカー面がXZ平面で法線が+Y。正面が+Zのモデルは
//   X軸まわりに-90度回すと立ち上がって視聴者側を向く。
// MindAR(画像認識): ターゲット画像がXY平面で法線が+Z。つまり最初から
//   カメラの方を向いているので、回してはいけない。
//
// 以前は両方に -90 0 0 を使っていたため、画像認識ではオブジェクトが
// ターゲット画像と平行に寝てしまい、真横から見た状態になっていた。
// (Playwrightで実測: -90 0 0 は正面とカメラの向きの内積が-0.087=ほぼ直角、
//  0 0 0 なら0.996でほぼ正対)
function baseRotationFor(useMindAr: boolean): string {
  return useMindAr ? "0 0 0" : "-90 0 0";
}

function buildArHtml(opts: {
  modelUrl: string;
  markerUrl: string;
  rotation: string | null;
  scale: string;
  position: string;
  mindFileUrl: string | null;
  useMindAr: boolean;
  /** 結果発表前に表示する焦らし用モデル。nullなら焦らし無しで即表示する。 */
  suspenseUrl: string | null;
  /** クールダウン中などに画面下部へ出す案内文(プレーンテキスト)。 */
  notice: string | null;
  /** 透過MP4/画像が表示できなかった端末向けの代替(同じ景品の3Dモデル版)。 */
  fallbackUrl: string | null;
  fallbackScale: string | null;
  /** ?nocache=1 のとき、ライブラリのURLに ?cb= を足してキャッシュを迂回する。 */
  nocache: boolean;
}): string {
  const kind = assetKind(opts.modelUrl);
  const rotation = opts.rotation || baseRotationFor(opts.useMindAr);
  // 焦らし演出は「結果も3Dモデル」のときだけ入れる。
  // 平面(動画/画像)の結果に3Dの焦らしを挟むと見た目の連続性が崩れるため。
  const suspenseUrl = kind === "model" ? opts.suspenseUrl : null;

  // 透過MP4/画像が出せない端末のために、同じ景品の3Dモデル版を控えとして渡す。
  // ar-boot.js が ar-object-failed を受け取ったら、この属性を見て切り替える。
  const fallbackAttr =
    kind !== "model" && opts.fallbackUrl
      ? ' data-fallback-src="' + esc(opts.fallbackUrl) + '"' +
        ' data-fallback-scale="' + esc(opts.fallbackScale || "2 2 2") + '"'
      : "";

  let objectMarkup: string;
  if (kind === "video") {
    objectMarkup =
      '<a-entity id="ar-object" alpha-video="src: ' + esc(opts.modelUrl) + '"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(rotation) + '"' +
      ' scale="' + esc(opts.scale) + '"' + fallbackAttr + "></a-entity>";
  } else if (kind === "image") {
    objectMarkup =
      '<a-entity id="ar-object" gif-image="src: ' + esc(opts.modelUrl) + '"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(rotation) + '"' +
      ' scale="' + esc(opts.scale) + '"' + fallbackAttr + "></a-entity>";
  } else {
    objectMarkup =
      '<a-entity id="ar-object" gltf-model="url(' + esc(opts.modelUrl) + ')"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(rotation) + '"' +
      ' scale="' + esc(opts.scale) + '"' +
      // timeScale:0で待機させ、実際に表示された瞬間に再生を開始する。
      // (マーカーを見つける前に一度きりのアニメーションが終わってしまうのを防ぐ)
      ' animation-mixer="loop: once; clampWhenFinished: true; timeScale: 0"></a-entity>';
  }

  // 焦らし用モデル。結果と同じ位置/向き/大きさに置き、結果表示時に
  // 違和感なく差し替わるようにする。ループ再生で5秒間動かし続ける。
  const suspenseMarkup = suspenseUrl
    ? '<a-entity id="ar-suspense" gltf-model="url(' + esc(suspenseUrl) + ')"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(rotation) + '"' +
      ' scale="' + esc(opts.scale) + '"' +
      ' animation-mixer="loop: repeat; timeScale: 0"></a-entity>'
    : "";

  // 焦らしがある場合、結果オブジェクトは最初は非表示にしておく。
  const objectMarkupGated = suspenseUrl
    ? objectMarkup.replace('<a-entity id="ar-object"', '<a-entity id="ar-object" visible="false"')
    : objectMarkup;

  // 表示オブジェクトはマーカー(ターゲット)の子ではなく、独立したステージに置く。
  // マーカー側は姿勢の供給だけを担当する(marker-pose)。
  const stageMarkup =
    '<a-entity id="ar-stage" visible="false">' + suspenseMarkup + objectMarkupGated + "</a-entity>";
  const poseAttr = ' marker-pose="stage: #ar-stage; hold: 1200"';

  const sceneMarkup = opts.useMindAr
    ? '<a-scene mindar-image="imageTargetSrc: ' + esc(opts.mindFileUrl || "") + '; uiScanning: no; uiLoading: no;"' +
      ' color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"' +
      ' vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"' +
      ' cap-pixel-ratio>' +
      '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
      '<a-entity id="ar-target" mindar-image-target="targetIndex: 0"' + poseAttr + "></a-entity>" +
      stageMarkup +
      "</a-scene>"
    // 動作実績のある旧実装(index.html)のarjs指定をそのまま踏襲する。
    // 旧実装は debugUIEnabled / trackingMethod / patternRatio のみを指定し、
    // 他は既定値のまま(sourceType=webcam, detectionMode=mono)で動作していた。
    // cameraParametersUrlだけは、AR.jsをCDNではなく自前配信(/vendor/aframe-ar.js)
    // している都合で既定の相対パスが解決できないため明示する。
    : '<a-scene embedded' +
      // maxDetectionRateの既定は60。スマホでは毎秒60回のマーカー検出がCPUを占有し、
      // 描画のフレーム落ち(ガクガク)の原因になるため30へ下げる。
      // 検出間のフレームはmarker-pose側の補間が埋めるので見た目は滑らかになる。
      ' arjs="debugUIEnabled:false; trackingMethod:best; patternRatio: 0.9;' +
      ' maxDetectionRate: 30; cameraParametersUrl: /vendor/camera_para.dat;"' +
      ' vr-mode-ui="enabled: false" cap-pixel-ratio>' +
      '<a-marker id="ar-target" preset="custom" type="pattern" url="' + esc(opts.markerUrl) + '"' +
      poseAttr + "></a-marker>" +
      stageMarkup +
      "<a-entity camera></a-entity>" +
      "</a-scene>";

  // 端末に壊れたキャッシュが残っているケースからの復帰用。
  // エラー画面の「キャッシュを使わずに再読み込み」が ?nocache=1 を付けて開き直す。
  const bust = (url: string) => (opts.nocache ? url + "?cb=" + Date.now() : url);
  // 読み込みの成否を必ず記録する。onerror が無いと、ライブラリが1つ落ちただけで
  // 画面が真っ暗のまま何の手がかりも残らない(端末差の相談で毎回これが起きる)。
  const lib = (name: string, url: string) =>
    '<script src="' + bust(url) + '"' +
    ' onload="__arScript(\'' + name + '\',\'ok\')"' +
    ' onerror="__arScript(\'' + name + '\',\'error\')"><\/script>';

  const engineScript = opts.useMindAr
    ? lib("mindar", "/vendor/mindar-image-aframe-1.2.5.prod.js")
    : lib("arjs", "/vendor/aframe-ar.js");

  return [
    "<!DOCTYPE html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no">',
    "<title>fukubiku</title>",
    // 読み込み状況の記録先を最初に用意する(この後のonerrorが参照する)。
    "<script>window.__AR_DIAG={scripts:{},startedAt:Date.now()};" +
      "function __arScript(n,s){window.__AR_DIAG.scripts[n]=s;}<\/script>",
    lib("aframe", "/vendor/aframe-1.5.0.min.js"),
    lib("aframe-extras", "/vendor/aframe-extras-7.7.0.min.js"),
    engineScript,
    "<style>",
    "body { margin: 0; overflow: hidden; background: #000; }",
    ".a-enter-vr, .a-enter-ar { display: none !important; }",
    ".mindar-ui-loading, .mindar-ui-scanning { display: none !important; }",
    ".ui { position: absolute; z-index: 100; bottom: 0; left: 0; width: 100%;",
    "  margin: 0; padding: 10px 15px 30px; text-align: center; box-sizing: border-box; }",
    ".ui a { display: inline-block; width: 62px; height: 62px; background-color: #fff;",
    "  color: #303030; margin: 8px; border-radius: 50%; position: relative; text-decoration: none; }",
    ".ui a span { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);",
    "  font: bold 11px/1.2 sans-serif; white-space: nowrap; }",
    ".ui a.disabled { pointer-events: none; color: #ccc; }",
    "#snap { position: absolute; top: 0; left: 0; width: 100%; height: 100%;",
    "  object-fit: contain; z-index: 500; display: none; background: rgba(0,0,0,0.85); }",
    ".notice { position: absolute; left: 12px; right: 12px; bottom: 110px; z-index: 100;",
    "  padding: 12px 16px; border-radius: 12px; background: rgba(15,23,42,0.82); color: #fff;",
    "  font: bold 14px/1.7 system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;",
    "  text-align: center; pointer-events: none; }",
    ".datetime-container { position: absolute; top: 20px; left: 0; width: 100%; z-index: 100;",
    "  text-align: center; color: #2196F3; font-size: 18px; font-weight: bold; pointer-events: none;",
    "  box-sizing: border-box; padding: 0 10px; text-shadow: 1px 1px 2px rgba(255,255,255,0.8); }",
    "</style>",
    // 透過MP4/GIFのコンポーネントは、a-sceneが解析される前に登録しておく必要がある。
    lib("ar-objects", AR_OBJECTS_SRC),
    lib("ar-boot", AR_BOOT_SRC),
    "<script>",
    TRACKING_COMPONENT,
    "<\/script>",
    "</head>",
    "<body>",
    '<div class="datetime-container"><span id="display-date"></span></div>',
    opts.notice ? '<div class="notice">' + esc(opts.notice) + "</div>" : "",
    '<img id="snap" alt="">',
    sceneMarkup,
    '<div class="ui">',
    '<a href="#" id="delete-photo" class="disabled"><span>削除</span></a>',
    '<a href="#" id="take-photo"><span>撮影</span></a>',
    '<a href="#" id="download-photo" class="disabled" download="fukubiku.png"><span>保存</span></a>',
    "</div>",
    "<script>",
    "(function(){",
    "  var week = ['日','月','火','水','木','金','土'];",
    "  function stamp(){",
    "    var d = new Date();",
    "    document.getElementById('display-date').innerText =",
    "      d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+",
    "      d.getHours()+'時'+String(d.getMinutes()).padStart(2,'0')+'分 '+week[d.getDay()]+'曜日';",
    "  }",
    "  stamp(); setInterval(stamp, 30000);",
    "  // 表示・非表示(マーカー追従)はmarker-poseコンポーネントが管理する。",
    "  // ここでは初回表示をきっかけに『焦らし→結果発表』の進行を行う。",
    "  var stage = document.getElementById('ar-stage');",
    "  var obj = document.getElementById('ar-object');",
    "  var sus = document.getElementById('ar-suspense');",
    "  var startAnim = function(el){",
    "    if (el && el.getAttribute('animation-mixer')) {",
    "      el.setAttribute('animation-mixer', 'timeScale', 1);",
    "    }",
    "  };",
    "  if (stage) {",
    "    stage.addEventListener('ar-shown', function(){",
    "      if (!sus) { startAnim(obj); return; }",
    "      // 焦らし用モデルをループ再生し、" + String(REVEAL_DELAY_MS / 1000) + "秒後に結果へ差し替える。",
    "      startAnim(sus);",
    "      setTimeout(function(){",
    "        sus.setAttribute('visible', 'false');",
    "        if (obj) { obj.setAttribute('visible', 'true'); startAnim(obj); }",
    "      }, " + String(REVEAL_DELAY_MS) + ");",
    "    }, { once: true });",
    "  }",
    "  var snapImg = document.getElementById('snap');",
    "  var takeBtn = document.getElementById('take-photo');",
    "  var delBtn = document.getElementById('delete-photo');",
    "  var dlBtn = document.getElementById('download-photo');",
    "  takeBtn.addEventListener('click', function(e){",
    "    e.preventDefault();",
    // 透過MP4用のvideo要素もDOMに入っている(端末によってはDOMに無いと
    // デコードが始まらないため)。撮影時に取り違えないよう除外する。
    "    var bgVideo = document.querySelector('#arjs-video') ||",
    "      document.querySelector('video:not([data-alpha-video])');",
    "    var sceneEl = document.querySelector('a-scene');",
    "    var arCanvas = null;",
    "    try { arCanvas = sceneEl.components.screenshot.getCanvas('perspective'); } catch (err) { arCanvas = null; }",
    "    if (!arCanvas) { arCanvas = document.querySelector('.a-canvas'); }",
    "    // AR.jsはカメラ映像とWebGLキャンバスを画面より大きく描画し、",
    "    // 負のmarginで中央に寄せている(例: 390px幅の画面に1125px幅の映像)。",
    "    // そのため合成時も、各要素が画面上で実際に占めている矩形をそのまま使う。",
    "    // 画面いっぱいに引き伸ばすとオブジェクトが横に潰れてしまう。",
    "    var w = window.innerWidth, h = window.innerHeight;",
    "    var canvas = document.createElement('canvas');",
    "    canvas.width = w; canvas.height = h;",
    "    var ctx = canvas.getContext('2d');",
    "    var place = function(el, src){",
    "      if (!el) return;",
    "      var r = el.getBoundingClientRect();",
    "      if (!r.width || !r.height) return;",
    "      ctx.drawImage(src || el, r.left, r.top, r.width, r.height);",
    "    };",
    "    if (bgVideo && bgVideo.videoWidth) { place(bgVideo); }",
    "    if (arCanvas) { place(document.querySelector('.a-canvas'), arCanvas); }",
    "    var label = document.getElementById('display-date').innerText;",
    "    var fs = Math.max(16, Math.round(w / 22));",
    "    ctx.font = 'bold ' + fs + 'px sans-serif';",
    "    ctx.textAlign = 'center'; ctx.textBaseline = 'top';",
    "    ctx.lineWidth = Math.max(3, fs / 5); ctx.lineJoin = 'round';",
    "    ctx.strokeStyle = 'rgba(255,255,255,0.9)';",
    "    ctx.strokeText(label, w / 2, Math.round(fs * 1.2));",
    "    ctx.fillStyle = '#2196F3';",
    "    ctx.fillText(label, w / 2, Math.round(fs * 1.2));",
    "    var url = canvas.toDataURL('image/png');",
    "    snapImg.src = url; snapImg.style.display = 'block';",
    "    delBtn.classList.remove('disabled'); dlBtn.classList.remove('disabled');",
    "    dlBtn.href = url;",
    "  });",
    "  delBtn.addEventListener('click', function(e){",
    "    e.preventDefault(); snapImg.style.display = 'none';",
    "    delBtn.classList.add('disabled'); dlBtn.classList.add('disabled');",
    "  });",
    "})();",
    "<\/script>",
    "</body></html>",
  ].join("\n");
}

export async function GET(
  _request: Request,
  { params }: { params: { hash: string } }
): Promise<Response> {
  const supabase = createAdminClient();
  const markerUrl = "/markers/patternkuji.patt";
  // エラー画面の「キャッシュを使わずに再読み込み」から戻ってきたときだけ立つ。
  const nocache = new URL(_request.url).searchParams.get("nocache") === "1";

  const respondAr = (o: {
    modelUrl: string | null;
    mindFileUrl: string | null;
    displayType: string;
    scale: string | null;
    rotation: string | null;
    position: string | null;
    /** テンプレート(カテゴリ)。焦らし演出のモデルを決めるのに使う。 */
    category?: string | null;
    /** 焦らし演出を入れない(クールダウン中の「またね」表示など)。 */
    noSuspense?: boolean;
    notice?: string | null;
    setCookie?: string;
  }): Response => {
    if (!o.modelUrl) {
      return simplePage("このコンテンツはまだ準備中です。<br>しばらくしてから再度お試しください。");
    }
    const useMindAr = o.displayType === "mindar" && !!o.mindFileUrl;
    const kind = assetKind(o.modelUrl);
    const html = buildArHtml({
      modelUrl: o.modelUrl,
      markerUrl,
      mindFileUrl: o.mindFileUrl,
      useMindAr,
      suspenseUrl: o.noSuspense ? null : suspenseUrlFor(o.category ?? null),
      notice: o.notice ?? null,
      // 向きの既定値は表示エンジンによって変わるため buildArHtml 側で決める
      // (baseRotationFor を参照)。保存された値があればそれを優先する。
      rotation: o.rotation,
      // 既定の大きさ。実機で「小さい」という指摘が続いたため、
      // 3Dモデル 1→2、平面(動画/画像) 3→6 と2倍に引き上げている。
      // プリセットに個別の大きさが保存されている場合はそちらが優先される。
      scale: o.scale || (kind === "model" ? "2 2 2" : "6 6 6"),
      position: o.position || "0 0 0",
      // 透過MP4/画像が出せない端末のための控え(同じ景品の3Dモデル版)。
      fallbackUrl: kind === "model" ? null : modelFallbackFor(o.modelUrl),
      fallbackScale: "2 2 2",
      nocache,
    });
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    };
    if (o.setCookie) headers["set-cookie"] = o.setCookie;
    return new Response(html, { headers });
  };

  // hashは orders と draw_groups のどちらかに一致する。
  // 順番に問い合わせるとDBへの往復が2回直列になり、そのぶん表示開始が遅れるため
  // 同時に投げる(Supabaseがアプリと別リージョンにある場合ほど効果が大きい)。
  const [orderRes, groupRes] = await Promise.all([
    supabase.from("orders").select("*").eq("hash", params.hash).maybeSingle(),
    supabase.from("draw_groups").select("*").eq("hash", params.hash).maybeSingle(),
  ]);

  const order = orderRes.data as Order | null;
  const group = groupRes.data as DrawGroup | null;

  if (!order && !group) {
    return simplePage("お探しのページは見つかりませんでした。", 404);
  }

  // --- クールダウン判定(注文フロー・抽選セットフロー共通) ---
  // 旧実装(index.html)はCookieの有無だけを見ており、注文/抽選の区別は無かった。
  // ここでも同じく、どちらのフローでも「一度見たら一定時間は再表示しない」を適用する。
  // (以前は抽選セットのみに適用していたため、注文URLでは何も起きなかった)
  const cookieName = drawCookieName(params.hash);
  const decoded = decodeDrawCookieValue(cookies().get(cookieName)?.value);
  // クールダウン時間は注文/抽選セットそれぞれの設定値を使う。
  // 未設定(null)なら既定値、0なら「制限なし」(何度でも表示できる)。
  const configuredCooldown = order ? order.cooldown_hours : group!.cooldown_hours;
  const cooldownHours = configuredCooldown ?? DRAW_COOLDOWN_HOURS;
  const remainingMs = decoded ? getRemainingCooldownMs(decoded.drawnAtMs, cooldownHours) : 0;
  const displayType = order ? order.display_type : group!.display_type;
  const mindFileUrl = order ? order.mind_file_url : group!.mind_file_url;

  if (remainingMs > 0) {
    // 旧実装がCookie保持時に <カテゴリ>_cookie.mp4(=「またね」)を出していたのと同じ役割。
    // 「時間をおいて再チャレンジ」の案内文を重ねて表示する。
    const message = buildRetryMessage(decoded?.category ?? null, remainingMs);
    const cookieUrl = cookieUrlFor(decoded?.category ?? null);
    if (!cookieUrl) return simplePage(esc(message));
    return respondAr({
      modelUrl: cookieUrl,
      mindFileUrl,
      displayType,
      category: decoded?.category ?? null,
      noSuspense: true,
      notice: message,
      scale: null,
      rotation: null,
      position: null,
    });
  }

  // 0(制限なし)のときはCookie自体を発行しない。
  // 営業デモのように同じ端末で何度も見せ直す用途で使う。
  const buildSetCookie = (category: string | null): string | undefined =>
    cooldownHours > 0
      ? cookieName +
        "=" +
        encodeDrawCookieValue(category) +
        "; Max-Age=" +
        Math.round(cooldownHours * 3600) +
        "; Path=/; SameSite=Lax"
      : undefined;

  // --- 表示回数の上限(注文フローのみ) ---
  // Cookieは端末ごとにしか効かないため、景品の個数そのものを守るには
  // サーバー側で実際の表示回数を数える必要がある。
  // orders.quantity を上限回数、orders.limit_period をその期間として扱う。
  if (order && order.quantity && order.quantity > 0) {
    const period = isLimitPeriod(order.limit_period) ? order.limit_period : "none";
    const windowStart = limitWindowStart(period);
    if (windowStart) {
      // 先に1行記録してから件数を数える。
      // 「数えてから記録」だと同時アクセスで上限を超えて配布されうるが、
      // 「記録してから数える」なら各リクエストが必ず異なる件数を見るため超過しない。
      const { data: logRow } = await supabase
        .from("draw_logs")
        .insert({ hash: params.hash })
        .select("id")
        .single();

      const { count } = await supabase
        .from("draw_logs")
        .select("id", { count: "exact", head: true })
        .eq("hash", params.hash)
        .gte("drawn_at", windowStart.toISOString());

      if ((count ?? 0) > order.quantity) {
        // 自分の分は配布しなかったので記録から取り消す(件数を正確に保つ)
        if (logRow?.id) await supabase.from("draw_logs").delete().eq("id", logRow.id);
        return simplePage(esc(buildLimitReachedMessage(period)));
      }
    }
  }

  // 1) 注文(orders): 1件に固定の景品が割り当てられているフロー
  if (order) {
    const o = order;
    let modelUrl: string | null = o.custom_model_url;
    let category: string | null = null;
    let scale: string | null = null;
    let rotation: string | null = null;
    let position: string | null = null;
    if (o.object_source === "preset" && o.preset_object_id) {
      const { data: preset } = await supabase
        .from("preset_objects")
        .select("*")
        .eq("id", o.preset_object_id)
        .single();
      const p = preset as PresetObject | null;
      modelUrl = p?.model_url ?? null;
      category = p?.category ?? null;
      scale = scaleValue(p?.scale);
      rotation = vec3(p?.rotation);
      position = vec3(p?.position);
    }
    return respondAr({
      modelUrl,
      mindFileUrl: o.mind_file_url,
      displayType: o.display_type,
      category,
      scale,
      rotation,
      position,
      setCookie: buildSetCookie(category),
    });
  }

  // 2) 抽選セット(draw_groups): アクセスの都度その場で抽選するフロー
  const g = group!;

  const { data: entries } = await supabase
    .from("draw_group_entries")
    .select("*")
    .eq("draw_group_id", g.id);

  const entryList = ((entries as DrawGroupEntry[]) ?? []).filter((e) => Number(e.weight) > 0);
  const chosen = pickWeighted(entryList);
  if (!chosen) {
    return simplePage("この抽選セットには景品が登録されていません。", 404);
  }

  let modelUrl: string | null = chosen.custom_model_url;
  let category: string | null = null;
  let scale: string | null = null;
  let rotation: string | null = null;
  let position: string | null = null;
  if (chosen.object_source === "preset" && chosen.preset_object_id) {
    const { data: preset } = await supabase
      .from("preset_objects")
      .select("*")
      .eq("id", chosen.preset_object_id)
      .single();
    const p = preset as PresetObject | null;
    modelUrl = p?.model_url ?? null;
    category = p?.category ?? null;
    scale = scaleValue(p?.scale);
    rotation = vec3(p?.rotation);
    position = vec3(p?.position);
  }

  return respondAr({
    modelUrl,
    mindFileUrl: g.mind_file_url,
    displayType: g.display_type,
    category,
    scale,
    rotation,
    position,
    setCookie: buildSetCookie(category),
  });
}
