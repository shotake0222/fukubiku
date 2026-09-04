"use client";

// fukubiku / あてんど両サービスのARビューアで共有する、表示オブジェクト関連のロジック。
// - assetKind: URLの拡張子から動画/画像/3Dモデルを判定
// - registerGifImageComponent: GIF/静止画をcanvasテクスチャとして再生するA-Frameコンポーネント
// - registerAlphaVideoComponent: 透過MP4(左半分RGB/右半分アルファ)を再生するA-Frameコンポーネント
// - ObjectEntity: 上記を踏まえてURLに応じた<a-entity>を出し分ける共通コンポーネント
//   (.glbの場合はanimation-mixer(aframe-extras)で埋め込みアニメーションを自動再生する)

export const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";
export const ARJS_SRC = "/vendor/aframe-ar.js";
export const MINDAR_IMAGE_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";
export const MINDAR_FACE_AFRAME_SRC =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-aframe.prod.js";
// .glbに埋め込まれたアニメーション(回転・拡縮・上下移動などのキーフレーム)を再生するために必要。
// gltf-model単体では埋め込みアニメーションは自動再生されないため、この拡張コンポーネントを読み込む。
export const AFRAME_EXTRAS_SRC =
  "https://cdn.jsdelivr.net/npm/aframe-extras@7/dist/aframe-extras.animation-mixer.min.js";

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
}: {
  url: string;
  position?: string;
  scale?: string | null;
  rotationY?: number;
}) {
  const kind = assetKind(url);
  const rotation = `0 ${rotationY} 0`;
  if (kind === "video") {
    return (
      <a-entity
        alpha-video={`src: ${url}`}
        position={position}
        rotation={rotation}
        scale={scale || undefined}
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
      ></a-entity>
    );
  }
  return (
    <a-entity
      gltf-model={`url(${url})`}
      position={position === "0 0.6 0" ? "0 0 0" : position}
      scale={scale || "0.05 0.05 0.05"}
      rotation={rotationY ? rotation : undefined}
      // .glbに埋め込まれたキーフレームアニメーション(回転・拡縮・上下移動など)を自動再生する。
      // クリップが無いモデルではanimation-mixerは何もしないため、外部フォールバックのanimationと共存できる。
      animation-mixer="loop: repeat"
      animation={
        rotationY
          ? undefined
          : "property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear"
      }
    ></a-entity>
  );
}
