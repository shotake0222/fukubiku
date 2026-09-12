/*
 * fukubiku / あてんど 共通のARオブジェクト用A-Frameコンポーネント。
 *
 * 以前は app/v/[hash]/route.ts の中に、1行のエスケープ済み文字列として
 * 埋め込まれていた(手を入れるのが現実的でない状態だった)。
 * 静的ファイルに切り出したことで、読める・キャッシュが効く・
 * route.ts のHTMLが軽くなる、の3つが同時に得られる。
 *
 * 提供するコンポーネント:
 *   alpha-video : 透過MP4(左半分=RGB / 右半分=アルファ)を平面に描画する
 *   gif-image   : GIF/静止画をcanvasテクスチャとして描画する(旧アセット互換)
 *
 * 端末差・回線差で「何も出ない」という状態にならないことを最優先にしている。
 * 失敗したときは必ず el に "ar-object-failed" イベントを投げるので、
 * 呼び出し側で代替表示(3Dモデル版へ切り替えるなど)に進める。
 */
(function () {
  "use strict";

  var D = (window.__AR_DIAG = window.__AR_DIAG || {});
  D.arObjects = { loaded: true, at: Date.now(), events: [] };
  function note(kind, detail) {
    try {
      D.arObjects.events.push({ t: Date.now(), kind: kind, detail: detail });
      if (D.arObjects.events.length > 60) D.arObjects.events.shift();
    } catch (e) {}
  }
  D.note = note;

  if (!window.AFRAME) {
    D.arObjects.aframeMissing = true;
    note("aframe-missing");
    return;
  }

  var AFRAME = window.AFRAME;
  var THREE = AFRAME.THREE;

  // 同じURLに ?cb= を足して、キャッシュを迂回した再取得を1度だけ試す。
  // 壊れた応答(古い404や途中で切れたファイル)がキャッシュに残っている端末で、
  // 再読み込みを促さずに自力で復帰できるようにするため。
  function bustCache(url) {
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "cb=" + Date.now();
  }

  // 親を辿って、実際に画面へ出ているかを調べる。
  // AR.js / MindAR はマーカー側のエンティティの visible を切り替えるので、
  // 自分の object3D.visible だけを見ても分からない。
  function isVisibleInScene(object3D) {
    var node = object3D;
    while (node) {
      if (!node.visible) return false;
      node = node.parent;
    }
    return true;
  }

  // 動画をDOMに入れずに再生しようとすると、端末によってはデコードが
  // 始まらない(Androidで報告例が多い)。かといって display:none や
  // visibility:hidden にすると、今度は合成対象から外れて同じことが起きる。
  // 1pxのほぼ透明な要素として実際に配置しておくのが、いちばん確実に動く。
  var HIDDEN_VIDEO_CSS =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;" +
    "pointer-events:none;z-index:-1;object-fit:contain;";

  if (!AFRAME.components["alpha-video"]) {
    AFRAME.registerComponent("alpha-video", {
      schema: {
        src: { type: "string" },
        // 既定は「1回だけ再生して最終フレームで停止」。
        // 結果発表は当たりが出たところで止まっていてほしいため。
        loop: { type: "boolean", default: false },
        // 再生が始まらない/進まないと判断するまでの猶予(ミリ秒)。
        stallMs: { type: "number", default: 6000 },
      },

      init: function () {
        var self = this;
        var src = this.data.src;
        this._src = src;
        this._failed = false;
        this._retried = false;
        this._wantsPlay = false;
        this._wasVisible = null;
        this._playStartedAt = 0;
        this._lastTime = -1;

        var video = document.createElement("video");
        video.setAttribute("data-alpha-video", "1");
        // インライン自動再生の必須条件。どれか欠けると play() が拒否され、
        // テクスチャが更新されないまま「何も出ない」状態になる。
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "true");
        video.loop = this.data.loop;
        video.preload = "auto";
        video.setAttribute("disableRemotePlayback", "");
        video.style.cssText = HIDDEN_VIDEO_CSS;
        // 同一オリジン配信ならcrossOriginは不要。別ドメインでCORSヘッダが無い場合、
        // crossOrigin="anonymous" を付けたままだと動画自体が読めず無表示になる。
        try {
          if (new URL(src, window.location.href).origin !== window.location.origin) {
            video.crossOrigin = "anonymous";
          }
        } catch (e) {}
        video.src = src;
        this.video = video;

        var tryPlay = function () {
          if (!self._wantsPlay || self._failed) return;
          var p = video.play();
          if (p && p.catch) {
            p.catch(function (err) {
              note("play-rejected", String(err && err.name));
            });
          }
        };
        this._tryPlay = tryPlay;

        video.addEventListener("loadedmetadata", function () {
          var w = video.videoWidth / 2 || 1;
          var h = video.videoHeight || 1;
          if (self.mesh) self.mesh.scale.set(1, h / w, 1);
          note("loadedmetadata", video.videoWidth + "x" + video.videoHeight);
        });
        video.addEventListener("loadeddata", tryPlay);
        video.addEventListener("canplay", tryPlay);
        video.addEventListener("playing", function () {
          self._playStartedAt = Date.now();
          note("playing");
        });
        // 最後まで再生したらそこで終わり。最終フレームがテクスチャに残るので、
        // 結果が表示されたまま静止する。
        video.addEventListener("ended", function () {
          self._wantsPlay = false;
          note("ended");
        });
        video.addEventListener("error", function () {
          var code = video.error ? video.error.code : 0;
          note("video-error", "code=" + code);
          // 1回目: crossOriginを外して再試行(CORSヘッダの無い別ドメイン配信向け)
          if (video.crossOrigin) {
            video.removeAttribute("crossorigin");
            video.crossOrigin = null;
            video.src = self._src;
            video.load();
            tryPlay();
            return;
          }
          // 2回目: キャッシュを迂回して再取得(壊れた応答が残っている端末向け)
          if (!self._retried) {
            self._retried = true;
            video.src = bustCache(self._src);
            video.load();
            tryPlay();
            return;
          }
          self.fail("動画を読み込めませんでした (code " + code + ")");
        });

        // 自動再生がブロックされている間は、ユーザー操作でも再生を試みる。
        var resume = function () { tryPlay(); };
        this._resume = resume;
        document.addEventListener("touchend", resume);
        document.addEventListener("click", resume);

        if (document.body) document.body.appendChild(video);
        video.load();

        var texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        // 端末によってはNPOT(1000x500)テクスチャの繰り返し指定で描画されないため明示する。
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;

        var material = new THREE.ShaderMaterial({
          uniforms: { map: { value: texture } },
          transparent: true,
          side: THREE.DoubleSide,
          vertexShader:
            "varying vec2 vUv;" +
            "void main(){ vUv = uv;" +
            " gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader:
            "precision mediump float;" +
            "uniform sampler2D map; varying vec2 vUv;" +
            "void main(){ vec2 cUv = vec2(vUv.x*0.5, vUv.y);" +
            " vec2 aUv = vec2(vUv.x*0.5+0.5, vUv.y);" +
            " vec3 c = texture2D(map, cUv).rgb;" +
            " float a = texture2D(map, aUv).r;" +
            " if (a < 0.02) discard;" +
            " gl_FragColor = vec4(c, a); }",
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        this.el.setObject3D("alpha-video-mesh", this.mesh);
      },

      // 代替表示へ進めるよう、失敗を必ず外へ知らせる。黙って消えるのが一番困る。
      fail: function (reason) {
        if (this._failed) return;
        this._failed = true;
        this._wantsPlay = false;
        note("failed", reason);
        // イベントは「飛んだ瞬間に誰かが聞いていないと消える」。
        // 読み込み順によっては、購読側(ar-boot.js)が構えるより先に失敗しうるので、
        // 事実を要素にも残しておき、後から来た側が拾えるようにする。
        this.el.__arFailed = { reason: reason, src: this._src };
        try {
          this.el.emit("ar-object-failed", { reason: reason, src: this._src }, true);
        } catch (e) {}
      },

      tick: function () {
        if (!this.video || this._failed) return;

        var visible = isVisibleInScene(this.el.object3D);
        if (visible !== this._wasVisible) {
          this._wasVisible = visible;
          if (visible) {
            // 表示された瞬間に頭から1回だけ再生する。
            // 見えていない間に再生し終えてしまうと、マーカーにかざした時には
            // 結果だけが出ている(演出が一度も見られない)ことになる。
            this._wantsPlay = true;
            this._playStartedAt = Date.now();
            this._lastTime = -1;
            try { this.video.currentTime = 0; } catch (e) {}
            this._tryPlay();
          } else {
            this._wantsPlay = false;
            this.video.pause();
            try { this.video.currentTime = 0; } catch (e) {}
          }
        }

        // 再生が始まらない/進まないまま猶予を過ぎたら失敗として扱う。
        // (デコーダ不足・自動再生ブロック・壊れたファイルなど、原因は端末次第)
        if (this._wantsPlay && this._playStartedAt) {
          var t = this.video.currentTime;
          if (t > 0 && t !== this._lastTime) {
            this._lastTime = t;
            this._playStartedAt = Date.now();
          } else if (Date.now() - this._playStartedAt > this.data.stallMs) {
            this.fail("再生が始まりませんでした (readyState " + this.video.readyState + ")");
          }
        }
      },

      remove: function () {
        if (this.mesh) this.el.removeObject3D("alpha-video-mesh");
        if (this.video) {
          this.video.pause();
          this.video.removeAttribute("src");
          this.video.load();
          if (this.video.parentNode) this.video.parentNode.removeChild(this.video);
        }
        if (this._resume) {
          document.removeEventListener("touchend", this._resume);
          document.removeEventListener("click", this._resume);
        }
      },
    });
  }

  if (!AFRAME.components["gif-image"]) {
    AFRAME.registerComponent("gif-image", {
      schema: { src: { type: "string" } },
      init: function () {
        var self = this;
        this._retried = false;
        this._src = this.data.src;
        this.img = document.createElement("img");
        try {
          if (new URL(this._src, window.location.href).origin !== window.location.origin) {
            this.img.crossOrigin = "anonymous";
          }
        } catch (e) {}
        this.canvas = document.createElement("canvas");
        this.canvas.width = 2;
        this.canvas.height = 2;
        this.ctx = this.canvas.getContext("2d");
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.img.onload = function () {
          var w0 = self.img.naturalWidth || 1;
          var h0 = self.img.naturalHeight || 1;
          self.canvas.width = w0;
          self.canvas.height = h0;
          var material = new THREE.MeshBasicMaterial({
            map: self.texture, transparent: true, side: THREE.DoubleSide,
          });
          self.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, h0 / w0), material);
          self.el.setObject3D("gif-mesh", self.mesh);
        };
        this.img.onerror = function () {
          if (!self._retried) {
            self._retried = true;
            self.img.src = bustCache(self._src);
            return;
          }
          note("image-failed", self._src);
          self.el.__arFailed = { reason: "画像を読み込めませんでした", src: self._src };
          try {
            self.el.emit("ar-object-failed", { reason: "画像を読み込めませんでした", src: self._src }, true);
          } catch (e) {}
        };
        this.img.src = this._src;
      },
      tick: function () {
        if (this.ctx && this.img.complete && this.img.naturalWidth) {
          try {
            this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
            this.texture.needsUpdate = true;
          } catch (e) {}
        }
      },
      remove: function () {
        if (this.mesh) this.el.removeObject3D("gif-mesh");
      },
    });
  }
})();
