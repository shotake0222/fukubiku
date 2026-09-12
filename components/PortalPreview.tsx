"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderPortalPreview } from "@/lib/portal/render";
import type { PortalData } from "@/lib/portal/types";

// 受け皿サイトの描画処理(lib/portal/render.ts)はサーバー専用の依存を一切
// 持たない純粋な関数なので、そのままブラウザでも動く。
// おかげで「保存 → 別タブで確認」ではなく、入力しながら即座に確認できる。

const WIDTHS: { key: string; label: string; w: number }[] = [
  { key: "phone", label: "スマホ", w: 390 },
  { key: "tablet", label: "タブレット", w: 768 },
  { key: "pc", label: "PC", w: 1200 },
];

export default function PortalPreview({
  data,
  publicUrl,
}: {
  data: PortalData;
  publicUrl: string;
}) {
  const [device, setDevice] = useState("phone");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);

  const width = WIDTHS.find((w) => w.key === device)?.w ?? 390;

  // 入力のたびに作り直すと重いので、1テンポ置いてから反映する。
  const [html, setHtml] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setHtml(renderPortalPreview(data));
      } catch (e) {
        setHtml(
          `<body style="font:14px sans-serif;padding:24px;color:#b91c1c">プレビューを描画できませんでした: ${
            e instanceof Error ? e.message : String(e)
          }</body>`
        );
      }
    }, 180);
    return () => clearTimeout(t);
  }, [data]);

  // 枠に収まるように縮小する(PC幅でも全体が見える)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!boxW) return 1;
    return Math.min(1, boxW / width);
  }, [boxW, width]);

  const frameH = device === "phone" ? 780 : device === "tablet" ? 900 : 820;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">プレビュー</span>
        <div className="inline-flex rounded-full border overflow-hidden">
          {WIDTHS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setDevice(w.key)}
              className={`text-xs px-3 py-1 ${
                device === w.key ? "bg-slate-900 text-white" : "hover:bg-slate-50"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">
          {width}px幅{scale < 1 ? `・${Math.round(scale * 100)}%表示` : ""}
        </span>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-pink-600 hover:underline"
        >
          公開URLを開く →
        </a>
      </div>

      <div
        ref={boxRef}
        className="border rounded-xl bg-slate-100 overflow-hidden"
        style={{ height: frameH * scale + 2 }}
      >
        <iframe
          title="受け皿サイトのプレビュー"
          srcDoc={html}
          // 参加ボタンなどでプレビュー内が遷移してしまわないよう、遷移だけ止める。
          // 見た目の確認が目的なので、スクリプトも必要ない。
          sandbox=""
          style={{
            width,
            height: frameH,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "#fff",
          }}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        入力すると自動で反映されます（保存しなくても確認できます）。
        リンクはプレビュー内では動きません。
      </p>
    </div>
  );
}
