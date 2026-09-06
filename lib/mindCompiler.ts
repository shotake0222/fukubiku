"use client";

// MindAR の画像コンパイラをブラウザ上で動かすためのヘルパー。
//
// 重要: mind-ar 1.2.5 の dist/mindar-image.prod.js は266バイトの「ESモジュール」で、
// 中身は隣のチャンク(controller-*.js / ui-*.js)への import 文しかない。
// これを通常の <script src>(classic script)として読み込むと
//   Uncaught SyntaxError: Cannot use import statement outside a module
// で実行そのものが失敗し、window.MINDAR が一切定義されない。
// にもかかわらず「リソースの取得」自体は成功するため load イベントは発火する。
// そのため画面上はコンパイル可能に見えるのに、実行すると必ず
// 「MindARコンパイラの読み込みが完了していません」になっていた。
// (Playwrightで classic / module 両方を実測して確認済み)
//
// 対策として、ここで type="module" のscriptタグを自前で挿入して読み込む。
// module scriptはロード完了ではなく「評価完了後」に load が発火するため、
// load を待てば window.MINDAR.IMAGE.Compiler が使える状態になっている。
//
// MindARのコンパイラはもともと複数画像を1つの.mindファイルにまとめてコンパイルできる
// (compileImageTargets は画像の配列を受け取り、配列のインデックスがそのまま
// mindar-image-target の targetIndex になる)。1つの.mindファイルで複数の絵柄を
// 同時にトラッキングできるのがMindARの標準的な使い方のため、複数画像対応を既定の
// コンパイル関数として実装し、単一画像はその特別ケース(要素数1の配列)として扱う。

declare global {
  interface Window {
    MINDAR?: {
      IMAGE?: {
        Compiler: new () => {
          compileImageTargets: (
            images: HTMLImageElement[],
            onProgress: (progress: number) => void
          ) => Promise<unknown>;
          exportData: () => Promise<ArrayBuffer> | ArrayBuffer;
        };
      };
    };
  }
}

export async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
  });
  return img;
}

export async function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`画像の読み込みに失敗しました: ${url}`));
  });
  return img;
}

/**
 * 複数画像をまとめて1つの.mindファイルにコンパイルする。
 * images の配列インデックスが、そのまま mindar-image-target の targetIndex に対応する。
 */
export const MINDAR_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js";

let mindArLoader: Promise<void> | null = null;

/**
 * MindARのコンパイラを読み込む(1回だけ)。
 * すでに読み込み済みなら即座に返る。読み込みは type="module" で行う。
 */
export function ensureMindArCompiler(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ブラウザ上でのみ実行できます。"));
  }
  if (window.MINDAR?.IMAGE?.Compiler) return Promise.resolve();
  if (mindArLoader) return mindArLoader;

  mindArLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mindar-compiler="1"]'
    );
    const el = existing ?? document.createElement("script");
    const done = () => {
      if (window.MINDAR?.IMAGE?.Compiler) resolve();
      else reject(new Error("MindARコンパイラの初期化に失敗しました。"));
    };
    el.addEventListener("load", done, { once: true });
    el.addEventListener(
      "error",
      () =>
        reject(
          new Error(
            "MindARコンパイラの読み込みに失敗しました。通信環境を確認して再度お試しください。"
          )
        ),
      { once: true }
    );
    if (!existing) {
      el.type = "module";
      el.async = true;
      el.dataset.mindarCompiler = "1";
      el.src = MINDAR_SCRIPT_URL;
      document.head.appendChild(el);
    }
  }).catch((e) => {
    // 失敗した読み込みを握ったままにすると、再試行しても同じエラーが返り続けるため
    mindArLoader = null;
    throw e;
  });

  return mindArLoader;
}

export async function compileMindTargets(
  images: HTMLImageElement[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  await ensureMindArCompiler();
  if (!window.MINDAR?.IMAGE?.Compiler) {
    throw new Error(
      "MindARコンパイラの読み込みが完了していません。少し待ってから再度お試しください。"
    );
  }
  if (images.length === 0) {
    throw new Error("コンパイル対象の画像がありません。");
  }
  const compiler = new window.MINDAR.IMAGE.Compiler();
  await compiler.compileImageTargets(images, (p) => onProgress?.(p));
  const exportedBuffer = await compiler.exportData();
  return new Blob([exportedBuffer], { type: "application/octet-stream" });
}

/** 単一画像(File)を.mindにコンパイルする(compileMindTargetsの単一要素版)。 */
export async function compileMindTarget(
  file: File,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const img = await loadImageElement(file);
  return compileMindTargets([img], onProgress);
}
