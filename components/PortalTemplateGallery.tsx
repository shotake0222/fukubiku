"use client";

import { useMemo, useState } from "react";
import { renderPortalPreview } from "@/lib/portal/render";
import { samplePortalData } from "@/lib/portal/sample";
import { PORTAL_TEMPLATES } from "@/lib/portal/types";
import type { PortalTemplate } from "@/lib/portal/types";

// 受け皿サイトのテンプレート見本。
//
// 「どんな見た目か」を見るために案件を作って受け皿サイトを作る、という順番だと、
// 提案の前に確認できない。描画処理はブラウザでも動くので、DBを一切引かずに
// 公開ページと同じものをその場で描いて並べる。

const VIEWS = [
  { key: "phone", label: "スマホ", w: 390, h: 720 },
  { key: "pc", label: "PC", w: 1200, h: 760 },
] as const;

export default function PortalTemplateGallery({
  selected,
  onSelect,
  compact,
}: {
  /** 選択中のテンプレート（選ばせる用途で使うとき） */
  selected?: PortalTemplate;
  /** 指定すると各カードが選択ボタンになる */
  onSelect?: (t: PortalTemplate) => void;
  /** 一覧ページ用に少し小さく並べる */
  compact?: boolean;
}) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("phone");
  const [zoom, setZoom] = useState<PortalTemplate | null>(null);

  const v = VIEWS.find((x) => x.key === view)!;
  const cardW = compact ? 240 : 300;
  const scale = cardW / v.w;

  const html = useMemo(() => {
    const out: Partial<Record<PortalTemplate, string>> = {};
    for (const t of PORTAL_TEMPLATES) {
      try {
        out[t.value] = renderPortalPreview(samplePortalData(t.value));
      } catch {
        out[t.value] = "<body>プレビューを描画できませんでした</body>";
      }
    }
    return out;
  }, []);

  return (
    <section className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[16rem]">
          <h2 className="font-semibold">テンプレートの見た目</h2>
          <p className="text-xs text-slate-500 mt-1">
            用途別の5パターンです。中身は見本で、実際の案件では文言・写真・色をすべて差し替えられます。
            作成後は書体・角の丸み・余白・配色・セクションの並びまで調整できます。
          </p>
        </div>
        <div className="inline-flex rounded-full border overflow-hidden">
          {VIEWS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setView(x.key)}
              className={`text-xs px-3 py-1 ${
                view === x.key ? "bg-slate-900 text-white" : "hover:bg-slate-50"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        {PORTAL_TEMPLATES.map((t) => (
          <div key={t.value} style={{ width: cardW }} className="space-y-2">
            <div
              className={`relative border rounded-xl overflow-hidden bg-slate-100 ${
                selected === t.value ? "ring-2 ring-slate-900 border-slate-900" : ""
              }`}
              style={{ height: v.h * scale }}
            >
              <iframe
                title={`${t.label}のプレビュー`}
                srcDoc={html[t.value]}
                // 見た目の確認だけが目的なので、遷移もスクリプトも止める
                sandbox=""
                scrolling="no"
                style={{
                  width: v.w,
                  height: v.h,
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  background: "#fff",
                  pointerEvents: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setZoom(t.value)}
                className="absolute inset-0 w-full h-full bg-transparent hover:bg-slate-900/5"
                aria-label={`${t.label}を大きく見る`}
              />
            </div>

            <div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{t.hint}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(t.value)}
                className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50"
              >
                大きく見る
              </button>
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect(t.value)}
                  className={`text-xs px-3 py-1 rounded-lg ${
                    selected === t.value
                      ? "bg-slate-900 text-white"
                      : "border hover:bg-slate-50"
                  }`}
                >
                  {selected === t.value ? "選択中" : "これにする"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 flex items-start justify-center p-4 overflow-auto"
          onClick={() => setZoom(null)}
        >
          <div
            className="bg-white rounded-xl overflow-hidden max-w-full my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-2 border-b">
              <span className="text-sm font-semibold">
                {PORTAL_TEMPLATES.find((t) => t.value === zoom)?.label}
              </span>
              <span className="text-[11px] text-slate-400">{v.label}表示・スクロールできます</span>
              {onSelect && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect(zoom);
                    setZoom(null);
                  }}
                  className="ml-auto text-xs px-3 py-1 rounded-lg bg-slate-900 text-white"
                >
                  これにする
                </button>
              )}
              <button
                type="button"
                onClick={() => setZoom(null)}
                className={`text-xs px-3 py-1 rounded-lg border ${onSelect ? "" : "ml-auto"}`}
              >
                閉じる
              </button>
            </div>
            <iframe
              title="プレビュー"
              srcDoc={html[zoom]}
              sandbox=""
              style={{ width: Math.min(v.w, 1100), height: "78vh", border: 0, background: "#fff" }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
