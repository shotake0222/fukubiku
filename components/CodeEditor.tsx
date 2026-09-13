"use client";

import { useRef } from "react";

/**
 * HTML/CSSを書くための入力欄。
 *
 * CodeMirrorやMonacoのような本格的なエディタは、外部CDNからの読み込みか
 * 大きな依存追加のどちらかが必要になる。このアプリはARのライブラリで
 * 「外部CDNが読めない端末で無言で壊れる」事故を起こしたばかりなので、
 * ここでは依存を足さず、素のtextareaに「書くときに困ること」だけを足している。
 *   - Tabでインデント（フォーカスが飛んでいかない）
 *   - Shift+Tabで戻す
 *   - 行番号
 *   - 等幅・折り返しなし・横スクロール
 */
/**
 * Tab / Shift+Tab の処理。カーソル位置の計算を間違えやすいので、
 * 画面から切り離してテストできる純粋な関数にしてある。
 */
export function applyTab(
  value: string,
  selStart: number,
  selEnd: number,
  shift: boolean
): { value: string; start: number; end: number } {
  const INDENT = "  ";
  const selection = value.slice(selStart, selEnd);
  const multiline = selection.includes("\n");

  if (multiline) {
    // 選択範囲の行頭をまとめて動かす。行の途中から選んでいても行単位で扱う。
    const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
    const block = value.slice(lineStart, selEnd);
    const changed = shift
      ? block.replace(/^ {1,2}/gm, "")
      : block.replace(/^(?!$)/gm, INDENT);
    return {
      value: value.slice(0, lineStart) + changed + value.slice(selEnd),
      start: lineStart,
      end: lineStart + changed.length,
    };
  }

  if (shift) {
    const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
    const head = value.slice(lineStart, selStart);
    const cut = head.match(/^ {1,2}/)?.[0].length ?? 0;
    if (!cut) return { value, start: selStart, end: selEnd };
    return {
      value: value.slice(0, lineStart) + value.slice(lineStart + cut),
      start: selStart - cut,
      end: selEnd - cut,
    };
  }

  return {
    value: value.slice(0, selStart) + INDENT + value.slice(selEnd),
    start: selStart + INDENT.length,
    end: selStart + INDENT.length,
  };
}

export default function CodeEditor({
  value,
  onChange,
  placeholder,
  rows = 18,
  language = "HTML",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  language?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const lines = value ? value.split("\n").length : 1;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const next = applyTab(value, el.selectionStart, el.selectionEnd, e.shiftKey);
    if (next.value === value) return;
    onChange(next.value);
    requestAnimationFrame(() => el.setSelectionRange(next.start, next.end));
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-slate-900">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800 text-slate-300">
        <span className="text-[11px] font-mono font-bold">{language}</span>
        <span className="text-[11px] text-slate-500">
          {lines}行 / {value.length}文字
        </span>
        <span className="ml-auto text-[11px] text-slate-500">Tabで字下げ</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        wrap="off"
        className="w-full bg-slate-900 text-slate-100 font-mono text-[12px] leading-6 p-3
          outline-none resize-y placeholder:text-slate-600"
        style={{ tabSize: 2 }}
      />
    </div>
  );
}
