"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm whitespace-nowrap"
    >
      印刷する
    </button>
  );
}
