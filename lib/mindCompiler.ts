"use client";

// MindAR の画像コンパイラをブラウザ上で動かすためのヘルパー。
// 事前に <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js" /> の
// 読み込みが完了している必要がある(window.MINDAR.IMAGE.Compiler が使えること)。
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
export async function compileMindTargets(
  images: HTMLImageElement[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
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
