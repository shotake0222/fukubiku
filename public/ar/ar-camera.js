/*
 * ar-camera.js : カメラ映像が「ボケる」問題への対策。
 *
 * A-Frame / AR.js / MindAR より先に読み込み、navigator.mediaDevices.getUserMedia を
 * 包んで、ライブラリが要求するカメラ設定に手を加える。ライブラリ本体には触らない。
 *
 * 【原因1: 解像度が低すぎる】
 *   AR.js はカメラに 640x480 を要求する(ArToolkitSource の既定値)。
 *   これを Pixel 7 Pro などの縦3120px の画面いっぱいに引き伸ばすので、
 *   映像そのものが常にぼやけて見えていた。
 *   → 要求を 1280x960 に上げる。
 *     マーカー検出は ArToolkitContext が別の 640x480 のキャンバスへ縮小してから
 *     行う(initWithDimensions(canvasWidth, canvasHeight))ので、検出の重さ・精度は
 *     従来とまったく同じ。変わるのは画面に映る映像の鮮明さだけ。
 *   → 縦横比(4:3)がずれると検出用キャンバスへの縮小で像が歪むため、
 *     返ってきた映像の縦横比が要求と違えば、従来どおりの要求で取り直す。
 *   MindAR は映像サイズのまま特徴点を計算する(inputWidth = videoWidth)ため、
 *   解像度を上げると処理が重くなる。MindAR には解像度の変更をかけない。
 *
 * 【原因2: ピントが迷う/固定される】
 *   端末によっては連続オートフォーカスになっていない。
 *   → 対応していれば focusMode: continuous を明示する。
 *   → 画面をタップするとピントを合わせ直す(single-shot → continuous)。
 *
 * 【原因3: 近づきすぎ】
 *   Pixel 7 Pro / 8 Pro のメインカメラは最短撮影距離が長く、純正カメラアプリは
 *   近距離で自動的にマクロ(超広角)へ切り替えている。ブラウザからはこの切り替えが
 *   できない(切り替えるとレンズの画角が変わり、ARの位置合わせが狂う)。
 *   → マーカーが見つからない状態が続いたら「少し離す/タップ」の案内を出す。
 *
 * ?debug=1 の診断パネルに、実際の解像度とフォーカス設定が出る(window.__AR_DIAG.camera)。
 */
(function () {
  "use strict";
  var md = navigator.mediaDevices;
  var D = (window.__AR_DIAG = window.__AR_DIAG || {});
  var C = (D.camera = { upgraded: false, events: [] });
  function note(kind, detail) {
    try {
      C.events.push({ t: Date.now(), kind: kind, detail: detail });
      if (C.events.length > 30) C.events.shift();
    } catch (e) {}
  }
  if (!md || !md.getUserMedia || md.__arCameraWrapped) return;

  var LONG_SIDE = 1280;
  var original = md.getUserMedia.bind(md);

  function num(x) {
    if (typeof x === "number") return x;
    if (x && typeof x === "object") return x.ideal || x.exact || x.max || null;
    return null;
  }

  // AR.js のように幅・高さを指定してくる要求だけを高解像度化する。
  // (MindAR は facingMode だけを指定してくるので、ここに該当せず素通りする)
  function upgrade(constraints) {
    var v = constraints && constraints.video;
    if (!v || typeof v !== "object") return null;
    var w = num(v.width);
    var h = num(v.height);
    if (!w || !h) return null;
    var longSide = Math.max(w, h);
    if (longSide >= LONG_SIDE) return null;
    var k = LONG_SIDE / longSide;
    var nv = {};
    for (var key in v) nv[key] = v[key];
    nv.width = { ideal: Math.round(w * k) };
    nv.height = { ideal: Math.round(h * k) };
    nv.aspectRatio = { ideal: w / h };
    var req = {};
    for (var key2 in constraints) req[key2] = constraints[key2];
    req.video = nv;
    return { req: req, ratio: Math.max(w, h) / Math.min(w, h), asked: w + "x" + h };
  }

  function ratioOf(track) {
    try {
      var s = track.getSettings ? track.getSettings() : {};
      if (!s.width || !s.height) return null;
      return { ratio: Math.max(s.width, s.height) / Math.min(s.width, s.height), size: s.width + "x" + s.height };
    } catch (e) {
      return null;
    }
  }

  function stopAll(stream) {
    try {
      stream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) {}
  }

  var track = null;
  function caps() {
    try {
      return track && track.getCapabilities ? track.getCapabilities() : {};
    } catch (e) {
      return {};
    }
  }
  function hasMode(mode) {
    var c = caps();
    return !!(c.focusMode && c.focusMode.indexOf(mode) !== -1);
  }

  function setupFocus(stream) {
    track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (!track) return;
    var c = caps();
    C.focusModes = c.focusMode || null;
    C.focusDistance = c.focusDistance || null;
    var r = ratioOf(track);
    C.size = r ? r.size : null;
    if (hasMode("continuous")) {
      track
        .applyConstraints({ advanced: [{ focusMode: "continuous" }] })
        .then(function () { C.focus = "continuous"; })
        .catch(function (e) { note("focus-error", String(e && e.name)); });
    } else {
      C.focus = "端末が指定に非対応";
    }
  }

  md.getUserMedia = function (constraints) {
    var up = upgrade(constraints);
    var p;
    if (!up) {
      p = original(constraints);
    } else {
      p = original(up.req).then(
        function (stream) {
          var t = stream.getVideoTracks()[0];
          var r = t ? ratioOf(t) : null;
          // 縦横比が要求どおりでなければ、従来の要求で取り直す(検出の精度を守る)。
          if (!r || Math.abs(r.ratio - up.ratio) > 0.03) {
            note("aspect-mismatch", { asked: up.asked, got: r && r.size });
            stopAll(stream);
            return original(constraints);
          }
          C.upgraded = true;
          note("upgraded", { asked: up.asked, got: r.size });
          return stream;
        },
        function (err) {
          // 高解像度の要求そのものが通らなかった端末は、従来どおりに戻す。
          note("upgrade-rejected", String(err && err.name));
          return original(constraints);
        }
      );
    }
    return p.then(function (stream) {
      try { setupFocus(stream); } catch (e) {}
      return stream;
    });
  };
  md.__arCameraWrapped = true;

  // ---------------------------------------------------------------
  // タップでピントを合わせ直す
  // ---------------------------------------------------------------
  var toast = null;
  function showToast(text, ms) {
    if (!document.body) return;
    if (!toast) {
      toast = document.createElement("div");
      toast.style.cssText =
        "position:absolute;left:50%;top:42%;transform:translateX(-50%);z-index:300;" +
        "padding:8px 14px;border-radius:999px;background:rgba(15,23,42,.78);color:#fff;" +
        "font:bold 13px/1.4 system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;" +
        "pointer-events:none;transition:opacity .3s;opacity:0;white-space:nowrap";
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.style.opacity = "0"; }, ms || 1600);
  }

  var refocusing = false;
  function refocus() {
    if (!track || refocusing) return;
    var back = hasMode("continuous") ? "continuous" : null;
    var once = hasMode("single-shot") ? "single-shot" : null;
    if (!back && !once) return;
    refocusing = true;
    showToast("ピントを合わせ直しています");
    var first = once || "manual";
    track
      .applyConstraints({ advanced: [{ focusMode: first }] })
      .catch(function () {})
      .then(function () {
        setTimeout(function () {
          var after = back || once;
          track
            .applyConstraints({ advanced: [{ focusMode: after }] })
            .catch(function () {})
            .then(function () { refocusing = false; });
        }, 700);
      });
    note("refocus");
  }

  function isUi(el) {
    while (el && el !== document.body) {
      if (el.id === "snap" || (el.classList && el.classList.contains("ui"))) return true;
      if (el.tagName === "A" || el.tagName === "BUTTON" || el.tagName === "INPUT") return true;
      el = el.parentNode;
    }
    return false;
  }
  document.addEventListener(
    "pointerup",
    function (e) {
      if (isUi(e.target)) return;
      refocus();
    },
    true
  );

  // ---------------------------------------------------------------
  // マーカーが見つからない状態が続いたら、距離とピントの案内を出す
  // ---------------------------------------------------------------
  var shown = false;
  document.addEventListener("ar-shown", function () { shown = true; hideHint(); }, true);
  var hint = null;
  function hideHint() {
    if (hint) hint.style.display = "none";
  }
  function showHint() {
    if (shown || !document.body) return;
    if (!hint) {
      hint = document.createElement("div");
      hint.style.cssText =
        "position:absolute;left:12px;right:12px;top:64px;z-index:200;padding:10px 14px;" +
        "border-radius:12px;background:rgba(15,23,42,.8);color:#fff;text-align:center;" +
        "font:bold 13px/1.6 system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;" +
        "pointer-events:none";
      hint.innerHTML =
        "マーカーが映らないときは<br>" +
        "スマホを少し離して(20cmほど) / 画面をタップしてピント合わせ";
      document.body.appendChild(hint);
    }
    hint.style.display = "block";
  }
  // カメラが動き始めてから一定時間たってもマーカーが見つからなければ出す
  var watchStart = null;
  setInterval(function () {
    if (shown) return;
    if (!track || track.readyState !== "live") return;
    if (watchStart === null) watchStart = Date.now();
    if (Date.now() - watchStart > 7000) showHint();
  }, 1000);
})();
