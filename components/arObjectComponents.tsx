"use client";

// fukubiku / あてんど両サービスのARビューアで共有する、表示オブジェクト関連のロジック。
// - assetKind: URLの拡張子から動画/画像/3Dモデルを判定
// - registerGifImageComponent: GIF/静止画をcanvasテクスチャとして再生するA-Frameコンポーネント
// - registerAlphaVideoComponent: 透過MP4(左半分RGB/右半分アルファ)を再生するA-Frameコンポーネント
// - ObjectEntity: 上記を踏まえてURLに応じた<a-entity>を出し分ける共通コンポーネント
//   (.glbの場合はanimation-mixer(aframe-extras)で埋め込みアニメーションを自動再生する)
//   visible=falseの間はDOM上に残したまま非表示にする(結果発表を焦らす間もアセットの先読みを進めるため)
// - SuspenseEntity: 結果(ObjectEntity)が表示されるまでの「焦らし」演出用プレースホルダー。
//   何の絵柄か分からないガチャカプセル風のオブジェクトを高速回転+上下バウンドさせる。

// .glbモデルにscale未指定(プリセット未設定)の場合の既定拡大率。
// 以前は0.05だったが、実機で「小さすぎて判別できない」との声を受けて引き上げた。
// 個別のプリセットで大きさが合わない場合は、管理画面(表示オブジェクト管理)の
// サイズ欄からこの既定値を上書きできる。
export const DEFAULT_MODEL_SCALE = "0.15 0.15 0.15";

export const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";
export const ARJS_SRC = "/vendor/aframe-ar.js";
export const MINDAR_IMAGE_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";
export const MINDAR_FACE_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-aframe.prod.js";
// .glbに埋め込まれたアニメーション(回転・拡縮・上下移動などのキーフレーム)を再生するために必要。
// gltf-model単体では埋め込みアニメーションは自動再生されないため、この拡張コンポーネントを読み込む。
//
// 以前は "aframe-extras@7"(メジャーバージョンを固定しないフローティング指定)+
// 機能別に分割された "aframe-extras.animation-mixer.min.js" を読み込んでいたが、
// aframe-extrasの最新7.x(7.7.0時点)ではdist配下のファイル構成が変わり、この
// animation-mixer単体バンドルが削除されて404を返すようになっていた
// (実機で「読み込みに失敗しました」エラーになる不具合として発覚。しばらくの間、
// 気づかれないまま本番で.glbのアニメーション再生に影響していた可能性がある)。
// 同様の「フローティング指定のCDN URLが将来のリリースでファイル構成ごと変わり、
// ある日突然404になる」事故を防ぐため、具体的なバージョンに固定した上で、
// animation-mixerコンポーネントを含むことを確認済みの統合バンドル
// (aframe-extras.min.js、controls/loaders/misc/animation-mixer等をすべて含む)を使う。
export const AFRAME_EXTRAS_SRC =
  "https://cdn.jsdelivr.net/npm/aframe-extras@7.7.0/dist/aframe-extras.min.js";

// スクリプトの読み込み完了(またはエラー/タイムアウト)を待つ。
// 以前はA-Frame本体/aframe-extras/AR.js(またはMindAR)をnext/scriptの
// strategy="afterInteractive"で複数並べて読み込んでいたが、次の2つの問題があった。
// 1. 外部CDN(A-Frame本体)より同一オリジンのローカルファイル(AR.js)の方が先に
//    読み込み完了してしまう回線環境で、A-Frame本体のグローバル(AFRAME/THREE)が
//    まだ無い状態で依存側のスクリプトが実行されクラッシュする
// 2. 1を避けるためA-Frame本体の読み込み完了を待ってから依存スクリプトを追加しても、
//    next/script内部のキャッシュ/検知の癖により、onLoadコールバックが発火しない
//    (ブラウザ上は読み込めているのに、Reactの状態が更新されない)ケースがある
// のどちらでも「読み込み中...」のまま無限に固まってしまう(fukubiku/あてんど両方の
// ARビューアで実機のAndroid Chromeにて確認)。そのため、next/scriptに頼らず、
// document.createElement("script")で明示的に生成した<script>タグのonload/onerror
// イベントとタイムアウトだけを頼りに読み込み完了を判定する、確実な方式に統一している。
// 呼び出し側は「A-Frame本体を読み込み終えてから、それに依存するスクリプトを読み込む」
// という順序を守ること。
export function loadArScript(src: string, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    const timer = setTimeout(() => {
      reject(new Error(`読み込みがタイムアウトしました: ${src}`));
    }, timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`読み込みに失敗しました: ${src}`));
    };
    document.head.appendChild(el);
  });
}

export function assetKind(url: string): "video" | "image" | "model" {
  if (/\.mp4(\?|$)/i.test(url)) return "video";
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) return "image";
  return "model";
}

// GIF/静止画をA-Frame上でテクスチャとして再生するコンポーネント(旧式のアップロード互換用)。
// DOM上で再生中の<img>の現在フレームを毎フレームcanvasへ描画し、そのcanvasをテクスチャとして使う。
export function registerGifImageComponent(AFRAME: any) {
  if (AFRAME.components["gif-image"]) return;
  AFRAME.registerComponent("gif-image", {
    schema: { src: { type: "string" } },
    init() {
      const THREE = AFRAME.THREE;
      this.img = document.createElement("img");
      this.img.crossOrigin = "anonymous";
      this.canvas = document.createElement("canvas");
      this.canvas.width = 2;
      this.canvas.height = 2;
      this.ctx = this.canvas.getContext("2d");
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.mesh = null;
      this.img.onload = () => {
        const w0 = this.img.naturalWidth || 1;
        const h0 = this.img.naturalHeight || 1;
        this.canvas.width = w0;
        this.canvas.height = h0;
        const material = new THREE.MeshBasicMaterial({
          map: this.texture,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const geometry = new THREE.PlaneGeometry(1, h0 / w0);
        this.mesh = new THREE.Mesh(geometry, material);
        this.el.setObject3D("gif-mesh", this.mesh);
      };
      this.img.src = this.data.src;
    },
    tick() {
      if (this.ctx && this.img.complete && this.img.naturalWidth) {
        try {
          this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
          this.texture.needsUpdate = true;
        } catch {
          /* 読み込み中は無視 */
        }
      }
    },
    remove() {
      if (this.mesh) this.el.removeObject3D("gif-mesh");
    },
  });
}

// 透過MP4(左半分=RGB, 右半分=アルファのグレースケール)を再生するコンポーネント。
// GIF由来のアニメーションをffmpegで変換したファイルを想定している。
export function registerAlphaVideoComponent(AFRAME: any) {
  if (AFRAME.components["alpha-video"]) return;
  AFRAME.registerComponent("alpha-video", {
    schema: { src: { type: "string" } },
    init() {
      const THREE = AFRAME.THREE;
      const video = document.createElement("video");
      video.src = this.data.src;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("playsinline", "true");
      this.video = video;

      const tryPlay = () => video.play().catch(() => {});
      tryPlay();
      const resumeOnGesture = () => {
        tryPlay();
      };
      document.addEventListener("touchend", resumeOnGesture, { once: true });
      document.addEventListener("click", resumeOnGesture, { once: true });
      this._resumeOnGesture = resumeOnGesture;

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying vec2 vUv;
          void main() {
            vec2 colorUv = vec2(vUv.x * 0.5, vUv.y);
            vec2 alphaUv = vec2(vUv.x * 0.5 + 0.5, vUv.y);
            vec3 color = texture2D(map, colorUv).rgb;
            float alpha = texture2D(map, alphaUv).r;
            if (alpha < 0.02) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });

      const geometry = new THREE.PlaneGeometry(1, 1);
      this.mesh = new THREE.Mesh(geometry, material);
      this.el.setObject3D("alpha-video-mesh", this.mesh);

      video.addEventListener("loadedmetadata", () => {
        const w = video.videoWidth / 2 || 1;
        const h = video.videoHeight || 1;
        this.mesh.scale.set(1, h / w, 1);
      });
    },
    remove() {
      if (this.mesh) this.el.removeObject3D("alpha-video-mesh");
      if (this.video) {
        this.video.pause();
        this.video.src = "";
      }
      if (this._resumeOnGesture) {
        document.removeEventListener("touchend", this._resumeOnGesture);
        document.removeEventListener("click", this._resumeOnGesture);
      }
    },
  });
}

export function ObjectEntity({
  url,
  position = "0 0.6 0",
  scale,
  rotationY = 0,
  visible = true,
  loop = true,
}: {
  url: string;
  position?: string;
  scale?: string | null;
  rotationY?: number;
  /** falseの間もエンティティ自体はマウントしたままにする(動画のプリロード/再生開始やモデルの読み込みを裏で進めるため)。 */
  visible?: boolean;
  /**
   * .glbの埋め込みアニメーションをループ再生するかどうか(true=デフォルト、焦らし演出用)。
   * falseにすると1回再生した後、最終フレーム(=結果バッジが表示された状態)で静止したままになる
   * (アニメーションをループさせるかどうかはコード側=ここで決める、というポリシー)。
   */
  loop?: boolean;
}) {
  const kind = assetKind(url);
  const rotation = `0 ${rotationY} 0`;
  const visibleAttr = visible ? "true" : "false";
  if (kind === "video") {
    return (
      <a-entity
        alpha-video={`src: ${url}`}
        position={position}
        rotation={rotation}
        scale={scale || undefined}
        visible={visibleAttr}
      ></a-entity>
    );
  }
  if (kind === "image") {
    return (
      <a-entity
        gif-image={`src: ${url}`}
        position={position}
        rotation={rotation}
        scale={scale || undefined}
        visible={visibleAttr}
      ></a-entity>
    );
  }
  return (
    <a-entity
      gltf-model={`url(${url})`}
      position={position === "0 0.6 0" ? "0 0 0" : position}
      scale={scale || DEFAULT_MODEL_SCALE}
      rotation={rotationY ? rotation : undefined}
      // .glbに埋め込まれたキーフレームアニメーション(回転・拡縮・上下移動など)を自動再生する。
      // クリップが無いモデルではanimation-mixerは何もしないため、外部フォールバックのanimationと共存できる。
      // loop=falseの場合は1回再生後に最終フレーム(結果バッジ表示状態)で停止したままにする。
      animation-mixer={loop ? "loop: repeat" : "loop: once; clampWhenFinished: true"}
      // 汎用の回転フォールバックは「焦らし」演出(loop=true)専用。
      // 以前はrotationYの有無だけで判定していたため、結果発表(loop=false)の
      // 実オブジェクトにもこの永久回転が常に重なってしまい、.glbに埋め込まれた
      // 本来の演出アニメーションが常時回転にかき消されて「ぐるぐる回っているだけ」に
      // 見える不具合があった。loop=falseの結果表示ではこの回転を付けず、
      // animation-mixerが再生する本来のアニメーションだけに任せる。
      animation={
        !loop || rotationY
          ? undefined
          : "property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear"
      }
      visible={visibleAttr}
    ></a-entity>
  );
}

// fukubikuの固定6カテゴリ。焦らし演出をカテゴリ専用にする際、この値以外(カスタムアップロード等)は
// 汎用のガチャカプセル演出にフォールバックする。
const CATEGORY_SUSPENSE_SLUGS = ["amida", "box", "darts", "garagara", "omikuji", "scratch"];

// カテゴリ専用の「焦らし」演出。そのカテゴリの実物(あみだくじの盤/抽選箱/鳥居とおみくじ/
// ダーツの的/福引きドラム/スクラッチカード)が結果バッジ無しでアニメーションしているだけの
// .glbを表示する(公開テンプレートと同じpublic/presets/<category>/配下から配信)。
export function CategorySuspenseEntity({
  category,
  position = "0 0.6 0",
  scale,
}: {
  category: string;
  position?: string;
  scale?: string | null;
}) {
  const url = `/presets/${category}/${category}_suspense_3d.glb`;
  return <ObjectEntity url={url} position={position} scale={scale} />;
}

export function isCategorySuspenseAvailable(category: string | null | undefined): category is string {
  return !!category && CATEGORY_SUSPENSE_SLUGS.includes(category);
}

// 結果発表前の「焦らし」演出プレースホルダー(汎用フォールバック版)。中身が分からないガチャカプセルを
// 模したオブジェクトで、ObjectEntityと同じposition/scaleの既定値を使うことで、結果発表時に
// 違和感なく差し替わるようにしている。カテゴリが判定できない(カスタムアップロード)場合に使う。
export function SuspenseEntity({
  position = "0 0.6 0",
  scale,
}: {
  position?: string;
  scale?: string | null;
}) {
  const entityPosition = position === "0 0.6 0" ? "0 0 0" : position;
  return (
    <a-entity position={entityPosition} scale={scale || DEFAULT_MODEL_SCALE}>
      <a-entity
        animation__spin="property: rotation; to: 0 360 0; loop: true; dur: 700; easing: linear"
        animation__bob="property: position; dir: alternate; loop: true; dur: 500; easing: easeInOutSine; to: 0 0.18 0"
      >
        <a-sphere radius="0.55" color="#ff4d6d" theta-start="0" theta-length="90"></a-sphere>
        <a-sphere radius="0.55" color="#ffffff" theta-start="90" theta-length="90"></a-sphere>
        <a-torus
          radius="0.56"
          radius-tubular="0.03"
          segments-tubular="24"
          color="#222222"
          rotation="90 0 0"
        ></a-torus>
        <a-text
          value="?"
          align="center"
          color="#222222"
          width="4"
          position="0 0 0.58"
        ></a-text>
        <a-text
          value="?"
          align="center"
          color="#222222"
          width="4"
          position="0 0 -0.58"
          rotation="0 180 0"
        ></a-text>
      </a-entity>
    </a-entity>
  );
}
