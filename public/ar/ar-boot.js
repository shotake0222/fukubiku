/*
 * ARビューアの「絶対に無言で失敗させない」ための面倒を全部見るスクリプト。
 *
 * 端末によって見える/見えないが変わる、という報告への対処。
 * 原因は端末ごとに違う(回線・キャッシュ・デコーダ・GPU・自動再生ポリシー)ので、
 * 個別に潰しにいくのではなく、次の3段構えにしている。
 *
 *   1. 失敗を検知する   … スクリプト・WebGL・カメラ・オブジェクトの各段階を見張る
 *   2. 自力で復帰する   … キャッシュを迂回した再取得、3Dモデル版への切り替え
 *   3. それでも駄目なら … 原因を画面に出す(白画面のまま放置しない)
 *
 * window.__AR_DIAG に状況が全部入るので、URLに ?debug=1 を付けると画面で読める。
 */
(function () {
  "use strict";

  var D = (window.__AR_DIAG = window.__AR_DIAG || {});
  D.scripts = D.scripts || {};
  D.startedAt = D.startedAt || Date.now();
  var note = D.note || function () {};

  var params = new URLSearchParams(window.location.search);
  var DEBUG = params.get("debug") === "1";

  function markScript(name, status) {
    D.scripts[name] = status;
    note("script:" + name, status);
  }
  window.__arScript = markScript;

  // ---------------------------------------------------------------
  // 端末情報の収集(原因の切り分けに必要な最小限)
  // ---------------------------------------------------------------
  function collect() {
    var gl = null, renderer = "-", glVersion = "-";
    try {
      var c = document.querySelector(".a-canvas") || document.createElement("canvas");
      gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
      if (gl) {
        glVersion = gl.getParameter(gl.VERSION);
        var ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
    } catch (e) {}

    var v = document.querySelector("video[data-alpha-video]");
    var cam = document.querySelector("#arjs-video") || document.querySelector("video:not([data-alpha-video])");

    return {
      時刻: new Date().toLocaleString("ja-JP"),
      URL: window.location.href,
      端末: navigator.userAgent,
      画面: window.innerWidth + "x" + window.innerHeight + " dpr" + (window.devicePixelRatio || 1),
      オンライン: navigator.onLine,
      スクリプト: D.scripts,
      AFRAME: window.AFRAME ? window.AFRAME.version || "あり" : "なし",
      THREE: window.AFRAME && window.AFRAME.THREE ? window.AFRAME.THREE.REVISION : "なし",
      WebGL: glVersion,
      GPU: renderer,
      カメラ映像: cam ? cam.videoWidth + "x" + cam.videoHeight + " readyState" + cam.readyState : "なし",
      カメラ設定: D.camera
        ? {
            高解像度化: D.camera.upgraded,
            取得サイズ: D.camera.size,
            フォーカス: D.camera.focus,
            対応モード: D.camera.focusModes,
            最短距離: D.camera.focusDistance,
            経過: (D.camera.events || []).slice(-8),
          }
        : "なし",
      結果動画: v
        ? {
            src: v.currentSrc || v.src,
            readyState: v.readyState,
            networkState: v.networkState,
            サイズ: v.videoWidth + "x" + v.videoHeight,
            currentTime: Math.round(v.currentTime * 100) / 100,
            paused: v.paused,
            error: v.error ? v.error.code : null,
          }
        : "なし",
      経過: D.arObjects && D.arObjects.events ? D.arObjects.events.slice(-25) : [],
    };
  }
  D.collect = collect;

  // ---------------------------------------------------------------
  // 画面に出す(白画面のまま終わらせない)
  // ---------------------------------------------------------------
  var panel = null;
  function overlay(title, message, fatal) {
    if (panel) return;
    if (!document.body) {
      whenBody(function () { overlay(title, message, fatal); });
      return;
    }
    panel = document.createElement("div");
    panel.setAttribute("data-ar-overlay", "1");
    panel.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;" +
      "background:rgba(8,12,20,.94);color:#fff;" +
      "font:14px/1.8 system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;" +
      "padding:24px;box-sizing:border-box;overflow:auto;-webkit-overflow-scrolling:touch;";
    var btn = fatal
      ? '<button id="ar-retry" style="appearance:none;border:0;border-radius:999px;' +
        "background:#fff;color:#0f172a;font:bold 15px/1 system-ui;padding:14px 24px;" +
        'margin:8px 8px 0 0;cursor:pointer;">キャッシュを使わずに再読み込み</button>'
      : "";
    panel.innerHTML =
      '<div style="max-width:560px;margin:0 auto;">' +
      '<p style="font-size:17px;font-weight:bold;margin:0 0 8px;">' + title + "</p>" +
      '<p style="margin:0 0 16px;color:#cbd5e1;">' + message + "</p>" +
      btn +
      '<button id="ar-detail" style="appearance:none;border:1px solid #475569;border-radius:999px;' +
      "background:transparent;color:#cbd5e1;font:bold 13px/1 system-ui;padding:13px 20px;" +
      'margin:8px 0 0;cursor:pointer;">詳細を表示</button>' +
      '<pre id="ar-detail-body" style="display:none;white-space:pre-wrap;word-break:break-all;' +
      'background:#0b1220;border-radius:10px;padding:12px;margin-top:14px;font-size:11px;color:#94a3b8;"></pre>' +
      "</div>";
    document.body.appendChild(panel);

    var retry = panel.querySelector("#ar-retry");
    if (retry) {
      retry.addEventListener("click", function () {
        // nocache=1 を付けて開き直すと、サーバー側がライブラリのURLに
        // ?cb= を足して返すので、端末に残った壊れたキャッシュを迂回できる。
        var u = new URL(window.location.href);
        u.searchParams.set("nocache", "1");
        u.searchParams.set("_r", String(Date.now()));
        window.location.replace(u.toString());
      });
    }
    var det = panel.querySelector("#ar-detail");
    var body = panel.querySelector("#ar-detail-body");
    det.addEventListener("click", function () {
      body.style.display = body.style.display === "none" ? "block" : "none";
      body.textContent = JSON.stringify(collect(), null, 1);
    });
  }
  D.overlay = overlay;

  function whenBody(fn) {
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function banner(text) {
    var el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:110px;z-index:900;padding:12px 16px;" +
      "border-radius:12px;background:rgba(15,23,42,.9);color:#fff;text-align:center;" +
      "font:bold 14px/1.7 system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;";
    el.textContent = text;
    document.body.appendChild(el);
  }

  // ---------------------------------------------------------------
  // 1) ライブラリが読めたか(読めていなければ画面は永遠に真っ暗)
  // ---------------------------------------------------------------
  function checkLibraries() {
    if (window.AFRAME) {
      markScript("aframe", "ok");
      if (!window.AFRAME.components["animation-mixer"]) {
        // .glbの埋め込みアニメーションが再生されないだけで、表示自体はできる。
        note("extras-missing");
      }
      return true;
    }
    var failed = [];
    for (var k in D.scripts) if (D.scripts[k] === "error") failed.push(k);
    overlay(
      "ARを開始できませんでした",
      "表示に必要なファイルを読み込めませんでした。" +
        (failed.length ? "（" + failed.join("、") + "）" : "") +
        "電波の弱い場所や、通信を制限する設定が入っている端末で起きやすい状態です。" +
        "下のボタンで、キャッシュを使わずに読み込み直せます。",
      true
    );
    return false;
  }

  // ---------------------------------------------------------------
  // 2) WebGLが生きているか(コンテキストロストは端末・メモリ状況次第で起きる)
  // ---------------------------------------------------------------
  function watchWebgl() {
    var canvas = document.querySelector(".a-canvas");
    if (!canvas) return;
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      note("webglcontextlost");
      overlay(
        "表示が中断されました",
        "端末の描画処理が中断されました。他のアプリやタブを閉じてから読み込み直すと復帰します。",
        true
      );
    });
    canvas.addEventListener("webglcontextrestored", function () {
      note("webglcontextrestored");
    });
  }

  // ---------------------------------------------------------------
  // 3) 表示オブジェクトが出せなかったときの切り替え
  //    透過MP4が駄目な端末でも、同じ景品の3Dモデル版に切り替えれば出せる。
  // ---------------------------------------------------------------
  function useFallback(obj, reason) {
    if (!obj) return;
    // HTMLElement側のgetAttributeを使う。A-Frameのエンティティは
    // getAttributeがコンポーネント用に差し替わっているため。
    var get = function (n) {
      return HTMLElement.prototype.getAttribute.call(obj, n);
    };
    var fb = get("data-fallback-src");
    if (!fb || obj.__fellBack) {
      note("fallback-unavailable", reason);
      whenBody(function () {
        banner("表示できませんでした。通信状況の良い場所で開き直してください。");
      });
      return;
    }
    obj.__fellBack = true;
    note("fallback", fb);
    // 透過MP4が出せない端末でも、同じ景品の3Dモデル版なら出せることが多い。
    obj.removeAttribute("alpha-video");
    obj.removeAttribute("gif-image");
    var sc = get("data-fallback-scale");
    if (sc) obj.setAttribute("scale", sc);
    obj.setAttribute("gltf-model", "url(" + fb + ")");
    obj.setAttribute("animation-mixer", "loop: once; clampWhenFinished: true");
    obj.setAttribute("visible", "true");
  }

  // 失敗イベントの購読は、読み込み直後(このスクリプトが走った瞬間)に始める。
  // boot()まで待つと、その前に失敗したぶんを取りこぼす。
  document.addEventListener(
    "ar-object-failed",
    function (e) {
      useFallback(e.target && e.target.id === "ar-object" ? e.target : document.getElementById("ar-object"),
        e.detail && e.detail.reason);
    },
    true
  );

  function wireFallback() {
    var obj = document.getElementById("ar-object");
    if (!obj) return;
    // 購読を始める前に失敗していた場合の取りこぼし対策。
    if (obj.__arFailed && !obj.__fellBack) {
      useFallback(obj, obj.__arFailed.reason);
    }
    // .glb側が読めなかった場合。1度だけキャッシュを迂回して取り直す。
    obj.addEventListener("model-error", function () {
      var cur = HTMLElement.prototype.getAttribute.call(obj, "gltf-model");
      note("model-error", String(cur));
      if (!obj.__modelRetried) {
        obj.__modelRetried = true;
        var m = /url\(([^)]+)\)/.exec(String(cur));
        if (m) {
          var u = m[1];
          obj.setAttribute("gltf-model", "url(" + u + (u.indexOf("?") === -1 ? "?" : "&") + "cb=" + Date.now() + ")");
          return;
        }
      }
      banner("表示できませんでした。通信状況の良い場所で開き直してください。");
    });
  }

  // ---------------------------------------------------------------
  // 4) ?debug=1 のときの常時表示パネル
  // ---------------------------------------------------------------
  function debugPanel() {
    var box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;top:0;left:0;right:0;max-height:45vh;overflow:auto;z-index:9998;" +
      "margin:0;padding:8px;background:rgba(0,0,0,.8);color:#7dd3fc;font:10px/1.4 ui-monospace,monospace;" +
      "white-space:pre-wrap;word-break:break-all;-webkit-overflow-scrolling:touch;";
    document.body.appendChild(box);
    setInterval(function () {
      box.textContent = JSON.stringify(collect(), null, 1);
    }, 500);
  }

  function boot() {
    if (!checkLibraries()) {
      if (DEBUG) debugPanel();
      return;
    }
    wireFallback();
    if (DEBUG) debugPanel();
    // a-sceneのcanvasは少し遅れて作られる
    setTimeout(watchWebgl, 1500);
    // カメラが一度も立ち上がらない端末向けの最終手段。
    // 立ち上がりの遅い端末を誤って失敗扱いにしないよう、2段階で見る。
    function cameraReady() {
      var cam = document.querySelector("#arjs-video") || document.querySelector("video:not([data-alpha-video])");
      return !!(cam && cam.videoWidth);
    }
    setTimeout(function () {
      if (cameraReady()) return;
      note("camera-slow");
      setTimeout(function () {
        if (cameraReady()) return;
        note("camera-missing");
        overlay(
          "カメラ映像を取得できませんでした",
          "カメラの使用が許可されていない可能性があります。" +
            "ブラウザのアドレスバー左のアイコンからカメラを「許可」にして開き直してください。" +
            "（他のアプリがカメラを使っている場合も起きます）",
          true
        );
      }, 13000);
    }, 12000);
  }

  // ライブラリの読み込み完了を待ってから判定する。
  // onload/onerror が来ない端末もあるので、時間でも打ち切る。
  function whenReady() {
    var waited = 0;
    var timer = setInterval(function () {
      waited += 300;
      if (window.AFRAME || waited >= 20000) {
        clearInterval(timer);
        boot();
      }
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whenReady);
  } else {
    whenReady();
  }
})();
