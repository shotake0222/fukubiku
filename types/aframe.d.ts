// A-Frame / AR.js / MindAR のカスタム要素をJSXで使えるようにする型宣言
declare namespace JSX {
  interface IntrinsicElements {
    "a-scene": any;
    "a-assets": any;
    "a-asset-item": any;
    "a-camera": any;
    "a-entity": any;
    "a-gltf-model": any;
    "a-light": any;
    "a-marker": any;
  }
}
