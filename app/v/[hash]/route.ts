import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DrawGroup, DrawGroupEntry, Order, PresetObject } from "@/lib/types";
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

const ALPHA_VIDEO_COMPONENT = "\nif (window.AFRAME && !AFRAME.components[\"alpha-video\"]) {\n  AFRAME.registerComponent(\"alpha-video\", {\n    schema: { src: { type: \"string\" } },\n    init: function () {\n      var THREE = AFRAME.THREE;\n      var self = this;\n      var video = document.createElement(\"video\");\n      video.src = this.data.src;\n      video.crossOrigin = \"anonymous\";\n      video.loop = true;\n      video.muted = true;\n      video.playsInline = true;\n      video.setAttribute(\"playsinline\", \"\");\n      video.setAttribute(\"webkit-playsinline\", \"true\");\n      this.video = video;\n      var tryPlay = function () { video.play().catch(function () {}); };\n      tryPlay();\n      document.addEventListener(\"touchend\", tryPlay, { once: true });\n      document.addEventListener(\"click\", tryPlay, { once: true });\n      var texture = new THREE.VideoTexture(video);\n      texture.minFilter = THREE.LinearFilter;\n      texture.magFilter = THREE.LinearFilter;\n      var material = new THREE.ShaderMaterial({\n        uniforms: { map: { value: texture } },\n        transparent: true,\n        side: THREE.DoubleSide,\n        vertexShader:\n          \"varying vec2 vUv; void main(){ vUv = uv;\" +\n          \" gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }\",\n        fragmentShader:\n          \"uniform sampler2D map; varying vec2 vUv;\" +\n          \" void main(){ vec2 cUv = vec2(vUv.x*0.5, vUv.y);\" +\n          \" vec2 aUv = vec2(vUv.x*0.5+0.5, vUv.y);\" +\n          \" vec3 c = texture2D(map, cUv).rgb;\" +\n          \" float a = texture2D(map, aUv).r;\" +\n          \" if (a < 0.02) discard;\" +\n          \" gl_FragColor = vec4(c, a); }\"\n      });\n      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);\n      this.mesh = mesh;\n      this.el.setObject3D(\"alpha-video-mesh\", mesh);\n      video.addEventListener(\"loadedmetadata\", function () {\n        var w = video.videoWidth / 2 || 1;\n        var h = video.videoHeight || 1;\n        self.mesh.scale.set(1, h / w, 1);\n      });\n    },\n    remove: function () {\n      if (this.mesh) this.el.removeObject3D(\"alpha-video-mesh\");\n      if (this.video) { this.video.pause(); this.video.src = \"\"; }\n    }\n  });\n}\nif (window.AFRAME && !AFRAME.components[\"gif-image\"]) {\n  AFRAME.registerComponent(\"gif-image\", {\n    schema: { src: { type: \"string\" } },\n    init: function () {\n      var THREE = AFRAME.THREE;\n      var self = this;\n      this.img = document.createElement(\"img\");\n      this.img.crossOrigin = \"anonymous\";\n      this.canvas = document.createElement(\"canvas\");\n      this.canvas.width = 2; this.canvas.height = 2;\n      this.ctx = this.canvas.getContext(\"2d\");\n      this.texture = new THREE.CanvasTexture(this.canvas);\n      this.img.onload = function () {\n        var w0 = self.img.naturalWidth || 1, h0 = self.img.naturalHeight || 1;\n        self.canvas.width = w0; self.canvas.height = h0;\n        var material = new THREE.MeshBasicMaterial({\n          map: self.texture, transparent: true, side: THREE.DoubleSide\n        });\n        self.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, h0 / w0), material);\n        self.el.setObject3D(\"gif-mesh\", self.mesh);\n      };\n      this.img.src = this.data.src;\n    },\n    tick: function () {\n      if (this.ctx && this.img.complete && this.img.naturalWidth) {\n        try {\n          this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);\n          this.texture.needsUpdate = true;\n        } catch (e) {}\n      }\n    },\n    remove: function () { if (this.mesh) this.el.removeObject3D(\"gif-mesh\"); }\n  });\n}\n";

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
function buildArHtml(opts: {
  modelUrl: string;
  markerUrl: string;
  rotation: string;
  scale: string;
  position: string;
  mindFileUrl: string | null;
  useMindAr: boolean;
}): string {
  const kind = assetKind(opts.modelUrl);

  // 表示オブジェクトのマークアップ。旧実装と同じく最初は visible="false" で置き、
  // マーカーを検出したタイミングで表示する。
  let objectMarkup: string;
  if (kind === "video") {
    objectMarkup =
      '<a-entity id="ar-object" alpha-video="src: ' + esc(opts.modelUrl) + '"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(opts.rotation) + '"' +
      ' scale="' + esc(opts.scale) + '" visible="false"></a-entity>';
  } else if (kind === "image") {
    objectMarkup =
      '<a-entity id="ar-object" gif-image="src: ' + esc(opts.modelUrl) + '"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(opts.rotation) + '"' +
      ' scale="' + esc(opts.scale) + '" visible="false"></a-entity>';
  } else {
    objectMarkup =
      '<a-entity id="ar-object" gltf-model="url(' + esc(opts.modelUrl) + ')"' +
      ' position="' + esc(opts.position) + '" rotation="' + esc(opts.rotation) + '"' +
      ' scale="' + esc(opts.scale) + '"' +
      ' animation-mixer="loop: once; clampWhenFinished: true" visible="false"></a-entity>';
  }

  const sceneMarkup = opts.useMindAr
    ? '<a-scene mindar-image="imageTargetSrc: ' + esc(opts.mindFileUrl || "") + '; uiScanning: no; uiLoading: no;"' +
      ' color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"' +
      ' vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">' +
      '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
      '<a-entity id="ar-target" mindar-image-target="targetIndex: 0">' + objectMarkup + "</a-entity>" +
      "</a-scene>"
    // 動作実績のある旧実装(index.html)のarjs指定をそのまま踏襲する。
    // 旧実装は debugUIEnabled / trackingMethod / patternRatio のみを指定し、
    // 他は既定値のまま(sourceType=webcam, detectionMode=mono)で動作していた。
    // cameraParametersUrlだけは、AR.jsをCDNではなく自前配信(/vendor/aframe-ar.js)
    // している都合で既定の相対パスが解決できないため明示する。
    : '<a-scene embedded' +
      ' arjs="debugUIEnabled:false; trackingMethod:best; patternRatio: 0.9;' +
      ' cameraParametersUrl: /vendor/camera_para.dat;"' +
      ' vr-mode-ui="enabled: false">' +
      '<a-marker id="ar-target" preset="custom" type="pattern" url="' + esc(opts.markerUrl) + '">' +
      objectMarkup +
      "</a-marker>" +
      "<a-entity camera></a-entity>" +
      "</a-scene>";

  const engineScript = opts.useMindAr
    ? '<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>'
    : '<script src="/vendor/aframe-ar.js"></script>';

  const foundEvent = opts.useMindAr ? "targetFound" : "markerFound";

  return [
    "<!DOCTYPE html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no">',
    "<title>fukubiku</title>",
    '<script src="https://aframe.io/releases/1.5.0/aframe.min.js"><\/script>',
    '<script src="https://cdn.jsdelivr.net/npm/aframe-extras@7.7.0/dist/aframe-extras.min.js"><\/script>',
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
    ".datetime-container { position: absolute; top: 20px; left: 0; width: 100%; z-index: 100;",
    "  text-align: center; color: #2196F3; font-size: 18px; font-weight: bold; pointer-events: none;",
    "  box-sizing: border-box; padding: 0 10px; text-shadow: 1px 1px 2px rgba(255,255,255,0.8); }",
    "</style>",
    // 透過MP4(左半分=RGB / 右半分=アルファ)とGIF/画像を描画するコンポーネント。
    // a-sceneが解析される前に登録しておく必要があるため、head内で登録する。
    "<script>",
    ALPHA_VIDEO_COMPONENT,
    "<\/script>",
    "</head>",
    "<body>",
    '<div class="datetime-container"><span id="display-date"></span></div>',
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
    "  var target = document.getElementById('ar-target');",
    "  var obj = document.getElementById('ar-object');",
    "  if (target && obj) {",
    "    target.addEventListener('" + foundEvent + "', function(){ obj.setAttribute('visible','true'); });",
    "  }",
    "  var snapImg = document.getElementById('snap');",
    "  var takeBtn = document.getElementById('take-photo');",
    "  var delBtn = document.getElementById('delete-photo');",
    "  var dlBtn = document.getElementById('download-photo');",
    "  takeBtn.addEventListener('click', function(e){",
    "    e.preventDefault();",
    "    var bgVideo = document.querySelector('#arjs-video') || document.querySelector('video');",
    "    var sceneEl = document.querySelector('a-scene');",
    "    var arCanvas = null;",
    "    try { arCanvas = sceneEl.components.screenshot.getCanvas('perspective'); } catch (err) { arCanvas = null; }",
    "    if (!arCanvas) { arCanvas = document.querySelector('.a-canvas'); }",
    // AR.jsはカメラ映像とWebGLキャンバスを画面より大きく描画し、",
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

  const respondAr = (o: {
    modelUrl: string | null;
    mindFileUrl: string | null;
    displayType: string;
    scale: string | null;
    rotation: string | null;
    position: string | null;
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
      // 旧実装(index.html)と同じ既定値。
      // AR.jsのマーカー座標系は「マーカー面=XZ平面 / 法線=+Y」であることを実測済みで、
      // 正面が+Zのモデル/平面はX軸まわりに-90度回すと視聴者側を向く。
      rotation: o.rotation || "-90 0 0",
      scale: o.scale || (kind === "model" ? "1 1 1" : "3 3 3"),
      position: o.position || "0 0 0",
    });
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    };
    if (o.setCookie) headers["set-cookie"] = o.setCookie;
    return new Response(html, { headers });
  };

  // 1) 注文(orders): 1件に固定の景品が割り当てられているフロー
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (order) {
    const o = order as Order;
    let modelUrl: string | null = o.custom_model_url;
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
      scale = scaleValue(p?.scale);
      rotation = vec3(p?.rotation);
      position = vec3(p?.position);
    }
    return respondAr({
      modelUrl,
      mindFileUrl: o.mind_file_url,
      displayType: o.display_type,
      scale,
      rotation,
      position,
    });
  }

  // 2) 抽選セット(draw_groups): アクセスの都度その場で抽選するフロー
  const { data: group } = await supabase
    .from("draw_groups")
    .select("*")
    .eq("hash", params.hash)
    .single();

  if (!group) {
    return simplePage("お探しのページは見つかりませんでした。", 404);
  }

  const g = group as DrawGroup;
  const cookieName = drawCookieName(params.hash);
  const decoded = decodeDrawCookieValue(cookies().get(cookieName)?.value);
  const cooldownHours = g.cooldown_hours ?? DRAW_COOLDOWN_HOURS;
  const remainingMs = decoded ? getRemainingCooldownMs(decoded.drawnAtMs, cooldownHours) : 0;

  if (remainingMs > 0) {
    return simplePage(esc(buildRetryMessage(decoded?.category ?? null, remainingMs)));
  }

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

  const cookieValue = encodeDrawCookieValue(category);
  const setCookie =
    cookieName + "=" + cookieValue + "; Max-Age=" + Math.round(cooldownHours * 3600) + "; Path=/";

  return respondAr({
    modelUrl,
    mindFileUrl: g.mind_file_url,
    displayType: g.display_type,
    scale,
    rotation,
    position,
    setCookie,
  });
}
