"use client";

// MindAR の画像コンパイラをブラウザ上で動かすためのヘルパー。
// 事前に <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js" /> の
// 読み込みが完了している必要がある(window.MINDAR.IMAGE.Compiler が使えること)。

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
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    });
    return img;
  } finally {
    // exportData の完了後に呼び出し側で revokeしても良いが、ここでは呼び出し元に任せる
  }
}

export async function compileMindTarget(
  file: File,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  if (!window.MINDAR?.IMAGE?.Compiler) {
    throw new Error(
      "MindARコンパイラの読み込みが完了していません。少し待ってから再度お試しください。"
    );
  }
  const img = await loadImageElement(file);
  const compiler = new window.MINDAR.IMAGE.Compiler();
  await compiler.compileImageTargets([img], (p) => onProgress?.(p));
  const exportedBuffer = await compiler.exportData();
  return new Blob([exportedBuffer], { type: "application/octet-stream" });
}
