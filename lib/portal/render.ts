import { PORTAL_TEMPLATES, type PortalBlock, type PortalData } from "./types";
import { TEMPLATE_CSS, TEMPLATE_SECTIONS } from "./templates";

export function esc(v: string | null | undefined): string {
  if (v == null) return "";
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 改行を <br> に。管理画面のテキストエリアで入れた改行をそのまま出す。 */
export function nl2br(v: string | null | undefined): string {
  return esc(v).replace(/\r?\n/g, "<br>");
}

/** 外部リンクは新しいタブで開く（サイトから離脱させない）。 */
function linkAttrs(url: string | null): string {
  if (!url) return "";
  const external = /^https?:\/\//i.test(url);
  return ` href="${esc(url)}"${external ? ' target="_blank" rel="noreferrer"' : ""}`;
}

/**
 * 画像の枠。
 * 公開前（下書き）は入れる場所が分かるようプレースホルダを出し、
 * 公開後は未設定の枠を消す（空の灰色ブロックが並ぶのを防ぐ）。
 */
export function img(
  url: string | null,
  cls: string,
  label: string,
  showPlaceholder: boolean
): string {
  if (url) return `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">`;
  if (!showPlaceholder) return "";
  return `<div class="${cls} ph">${esc(label)}</div>`;
}

export interface Ctx {
  d: PortalData;
  /** 下書き中だけプレースホルダを出す */
  ph: boolean;
}

// ---- セクション部品（クラス名は全テンプレート共通。見た目はCSSで分ける） ----

export function secHead(eyebrow: string, heading: string): string {
  return `<div class="sec-head"><span>${esc(eyebrow)}</span><h2>${esc(heading)}</h2></div>`;
}

export function arBand({ d }: Ctx): string {
  if (!d.arUrl) return "";
  return `
<section class="ar" id="ar">
  <div class="inner">
    <div class="txt">
      <h2>${esc(d.arHeading)}</h2>
      ${d.arText ? `<p>${nl2br(d.arText)}</p>` : ""}
    </div>
    <a class="btn" href="${esc(d.arUrl)}">${esc(d.arButtonLabel)}</a>
  </div>
</section>`;
}

export function picks(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.pick;
  if (!list.length) return "";
  const cards = list
    .map(
      (b, i) => `<article class="card">
      ${img(b.imageUrl, "card-img", "画像", ctx.ph)}
      <div class="card-body">
        <span class="card-n">0${i + 1}</span>
        <h3>${esc(b.title)}</h3>
        ${b.body ? `<p>${nl2br(b.body)}</p>` : ""}
        ${b.meta ? `<div class="card-meta">${nl2br(b.meta)}</div>` : ""}
      </div>
    </article>`
    )
    .join("");
  return `<section class="sec picks">${secHead(eyebrow, heading)}<div class="wrap"><div class="grid3">${cards}</div></div></section>`;
}

export function spots(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.spot;
  if (!list.length) return "";
  const items = list
    .map(
      (b, i) => `<article class="spot">
      <span class="spot-no">${i + 1}</span>
      ${img(b.imageUrl, "spot-img", "写真", ctx.ph)}
      <div class="spot-txt">
        ${b.badge ? `<span class="spot-badge">${esc(b.badge)}</span>` : ""}
        <h3>${esc(b.title)}</h3>
        ${b.body ? `<p>${nl2br(b.body)}</p>` : ""}
        ${b.meta ? `<div class="spot-meta">${nl2br(b.meta)}</div>` : ""}
      </div>
    </article>`
    )
    .join("");
  return `<section class="sec spots">${secHead(eyebrow, heading)}<div class="wrap"><div class="spotwrap">${items}</div></div></section>`;
}

export function banners(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.banner;
  if (!list.length) return "";
  const cards = list
    .map(
      (b) => `<a class="banner"${linkAttrs(b.linkUrl)}>
      ${img(b.imageUrl, "banner-img", "バナー", ctx.ph)}
      <div class="banner-cap">${esc(b.title)}${b.meta ? `<small>${esc(b.meta)}</small>` : ""}</div>
    </a>`
    )
    .join("");
  return `<section class="sec banners-sec">${secHead(eyebrow, heading)}<div class="wrap"><div class="banners">${cards}</div></div></section>`;
}

export function news(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.news;
  if (!list.length) return "";
  const items = list
    .map((b) => `<li><time>${esc(b.title)}</time>${nl2br(b.body)}</li>`)
    .join("");
  return `<div class="news">${secHead(eyebrow, heading)}<ul>${items}</ul></div>`;
}

export function outline(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.outline;
  if (!list.length) return "";
  const rows = list
    .map((b) => `<dt>${esc(b.title)}</dt><dd>${nl2br(b.body)}</dd>`)
    .join("");
  return `<div class="outline">${secHead(eyebrow, heading)}<dl>${rows}</dl></div>`;
}

export function faq(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.faq;
  if (!list.length) return "";
  const rows = list
    .map((b) => `<dt>${esc(b.title)}</dt><dd>${nl2br(b.body)}</dd>`)
    .join("");
  return `<section class="sec faq-sec">${secHead(eyebrow, heading)}<div class="wrap"><dl class="faq">${rows}</dl></div></section>`;
}

export function notes(ctx: Ctx, heading: string): string {
  const list = ctx.d.blocks.note;
  if (!list.length) return "";
  const items = list.map((b) => `<li>${nl2br(b.title || b.body)}</li>`).join("");
  return `<div class="notes"><h3>${esc(heading)}</h3><ul>${items}</ul></div>`;
}

export function chapters(ctx: Ctx, eyebrow: string, heading: string): string {
  const list = ctx.d.blocks.chapter;
  if (!list.length) return "";
  const cards = list
    .map(
      (b) => `<article class="chapter${b.badge ? " is-now" : ""}">
      ${b.badge ? `<span class="chapter-flag">${esc(b.badge)}</span>` : ""}
      ${img(b.imageUrl, "chapter-img", "写真", ctx.ph)}
      <div class="chapter-body">
        ${b.meta ? `<span class="chapter-season">${esc(b.meta)}</span>` : ""}
        <h3>${esc(b.title)}</h3>
        ${b.body ? `<p>${nl2br(b.body)}</p>` : ""}
      </div>
    </article>`
    )
    .join("");
  return `<section class="sec chapters-sec">${secHead(eyebrow, heading)}<div class="wrap"><div class="chapters">${cards}</div></div></section>`;
}

export function header(ctx: Ctx): string {
  const { d } = ctx;
  const logo = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" alt="${esc(d.logoText || d.siteTitle)}" class="logo-img">`
    : `<span class="logo-mark">${esc((d.logoText || d.siteTitle).slice(0, 1))}</span><span>${esc(d.logoText || d.siteTitle)}</span>`;
  return `<header class="hd">
  <div class="hd-inner">
    <a class="logo" href="#">${logo}</a>
    ${d.arUrl ? `<a class="hd-go" href="${esc(d.arUrl)}">${esc(d.arButtonLabel)}</a>` : ""}
  </div>
</header>`;
}

export function footer(ctx: Ctx): string {
  const { d } = ctx;
  const links = [
    d.privacyUrl ? `<a${linkAttrs(d.privacyUrl)}>プライバシーポリシー</a>` : "",
    d.termsUrl ? `<a${linkAttrs(d.termsUrl)}>利用規約</a>` : "",
    d.contactUrl ? `<a${linkAttrs(d.contactUrl)}>お問い合わせ</a>` : "",
  ]
    .filter(Boolean)
    .join("");
  return `<footer class="ft">
  <div class="wrap">
    ${d.ownerName ? `<strong>${esc(d.ownerName)}</strong>` : ""}
    ${d.ownerAddress ? `<br>${nl2br(d.ownerAddress)}` : ""}
    ${links ? `<div class="ft-links">${links}</div>` : ""}
    <small>${esc(d.copyrightText || `© ${new Date().getFullYear()} ${d.ownerName ?? d.siteTitle}`)} / Powered by あてんど.</small>
  </div>
</footer>`;
}

export function sticky(ctx: Ctx): string {
  if (!ctx.d.arUrl) return "";
  return `<div class="sticky"><a href="${esc(ctx.d.arUrl)}">${esc(ctx.d.arButtonLabel)}</a></div>`;
}

// ---- ページ全体 ----

const BASE_CSS = `
*{box-sizing:border-box}
body{margin:0;line-height:1.8;-webkit-text-size-adjust:100%}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
.ph{display:flex;align-items:center;justify-content:center;font-size:12px;letter-spacing:.08em}
.sec{padding:60px 0}
.sec-head{margin-bottom:32px;text-align:center}
.sec-head span{display:block;font-size:11px;letter-spacing:.3em;font-weight:800;margin-bottom:6px}
.sec-head h2{margin:0;font-size:26px;font-weight:800}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.banners{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.banner{display:block;text-decoration:none;overflow:hidden}
.banner-img{width:100%;height:110px;object-fit:cover}
.banner-cap{padding:14px 16px;font-size:14px;font-weight:700}
.banner-cap small{display:block;font-weight:400;font-size:12px;margin-top:3px;opacity:.7}
.card{overflow:hidden}
.card-img{width:100%;height:160px;object-fit:cover}
.card-body{padding:20px}
.card-n{font-size:11px;font-weight:800;letter-spacing:.2em;opacity:.65}
.card h3{margin:4px 0 8px;font-size:17px}
.card p{margin:0;font-size:13.5px;line-height:1.8}
.card-meta{margin-top:10px;font-size:12.5px;opacity:.75}
.spot{display:flex;gap:18px;align-items:center;padding:20px 0}
.spot-no{width:30px;height:30px;border-radius:50%;font-size:13px;font-weight:800;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.spot-img{width:120px;height:86px;object-fit:cover;border-radius:10px;flex-shrink:0}
.spot-txt{flex:1;min-width:0}
.spot-txt h3{margin:0 0 4px;font-size:16.5px}
.spot-txt p{margin:0;font-size:13.5px;line-height:1.8}
.spot-badge{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:5px;margin-bottom:6px}
.spot-meta{margin-top:8px;font-size:12.5px;opacity:.75}
.news ul{margin:0;padding:0;list-style:none}
.news li{padding:12px 0;font-size:14px}
.news time{display:block;font-size:12px;font-weight:700}
.outline dl{margin:0;font-size:14px}
.outline dt{font-weight:800;margin-top:14px;font-size:13px}
.outline dd{margin:2px 0 0}
.faq{margin:0}
.faq dt{font-weight:800;font-size:14.5px;margin-top:20px}
.faq dd{margin:6px 0 0;font-size:13.5px;opacity:.85}
.notes{border-radius:12px;padding:22px}
.notes h3{margin:0 0 10px;font-size:15px}
.notes ul{margin:0;padding-left:1.2em;font-size:13.5px}
.notes li{margin-bottom:6px}
.chapters{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.chapter{position:relative;overflow:hidden}
.chapter-img{width:100%;height:110px;object-fit:cover}
.chapter-body{padding:16px}
.chapter-season{font-size:11px;font-weight:800;letter-spacing:.1em}
.chapter h3{margin:4px 0 6px;font-size:15.5px}
.chapter p{margin:0;font-size:12.5px;opacity:.8}
.chapter-flag{position:absolute;top:10px;right:10px;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px}
.hd{position:sticky;top:0;z-index:30}
.hd-inner{max-width:1000px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:14px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:15px}
.logo-img{height:34px;width:auto}
.logo-mark{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px}
.hd-go{margin-left:auto;text-decoration:none;font-weight:800;font-size:13px;padding:10px 20px;border-radius:999px;white-space:nowrap}
.ar .inner{max-width:1000px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:28px}
.ar .txt{flex:1;min-width:0}
.ar h2{margin:0 0 8px;font-size:24px;font-weight:800}
.ar p{margin:0;font-size:14px;line-height:1.75}
.ar .btn{flex-shrink:0;text-decoration:none;font-weight:800;padding:18px 34px;border-radius:999px;font-size:16px;white-space:nowrap}
.ft{padding:42px 0 90px;font-size:13px}
.ft a{text-decoration:none}
.ft-links{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}
.ft small{display:block;margin-top:22px;opacity:.6}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:40;display:none;
  padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
.sticky a{display:block;text-align:center;text-decoration:none;font-weight:800;padding:15px;border-radius:12px;font-size:15px}
@media(max-width:860px){.grid3{grid-template-columns:1fr}.banners{grid-template-columns:1fr}
  .chapters{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.sticky{display:block}.ft{padding-bottom:110px}
  .ar .inner{flex-direction:column;text-align:center;gap:20px}.ar .btn{width:100%;text-align:center}}
@media(max-width:600px){.spot-img{width:84px;height:64px}.sec{padding:44px 0}}
`;

/** 提供終了・準備中の画面。URLは生かしたまま、状態だけを伝える。 */
function statusPage(d: PortalData, kind: "draft" | "ended"): string {
  const title = kind === "ended" ? "公開を終了しました" : "準備中です";
  const msg =
    kind === "ended"
      ? d.endedMessage ||
        "このスタンプラリーは終了しました。ご参加ありがとうございました。"
      : "このページはただいま準備中です。公開までしばらくお待ちください。";
  const link =
    kind === "ended" && d.endedLinkUrl
      ? `<a class="btn" href="${esc(d.endedLinkUrl)}" target="_blank" rel="noreferrer">${esc(d.endedLinkLabel || "公式サイトへ")}</a>`
      : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(d.siteTitle)}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#f6f7f8;color:#2b3138;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;padding:24px}
.box{max-width:460px;text-align:center;background:#fff;border:1px solid #e4e7ea;border-radius:18px;padding:48px 32px}
h1{font-size:21px;margin:0 0 14px}
p{font-size:14px;line-height:1.9;color:#6b7280;margin:0 0 26px;white-space:pre-wrap}
.btn{display:inline-block;background:${esc(d.brand)};color:#fff;text-decoration:none;font-weight:800;
  padding:15px 34px;border-radius:999px;font-size:15px}
.site{margin-top:26px;font-size:12px;color:#9aa2ad}
</style></head><body>
<div class="box"><h1>${title}</h1><p>${esc(msg)}</p>${link}
<div class="site">${esc(d.siteTitle)}</div></div></body></html>`;
}

export function renderPortal(d: PortalData, opts: { preview?: boolean } = {}): string {
  // プレビューでは公開状態とみなし、未設定の画像枠も見えるようにする
  // (どこに何が入るのか分からないまま編集させないため)。
  if (!opts.preview && d.status !== "published") {
    return statusPage(d, d.status === "ended" ? "ended" : "draft");
  }

  const ctx: Ctx = { d, ph: !!opts.preview };
  const tpl = PORTAL_TEMPLATES.find((t) => t.value === d.template) ?? PORTAL_TEMPLATES[0];
  const body = TEMPLATE_SECTIONS[d.template](ctx);
  const vars = `:root{--brand:${esc(d.brand)};--brand-dark:${esc(d.brandDark)};--accent:${esc(d.accent)}}`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.siteTitle)}</title>
${d.siteDescription ? `<meta name="description" content="${esc(d.siteDescription)}">` : ""}
<meta property="og:title" content="${esc(d.siteTitle)}">
${d.siteDescription ? `<meta property="og:description" content="${esc(d.siteDescription)}">` : ""}
${d.ogImageUrl ? `<meta property="og:image" content="${esc(d.ogImageUrl)}">` : ""}
<meta property="og:type" content="website">
<style>${vars}${BASE_CSS}${TEMPLATE_CSS[d.template]}</style>
</head>
<body class="tpl-${esc(tpl.value)}">
${body}
</body>
</html>`;
}

/** 管理画面のプレビュー用（下書きでも中身を描き、空の枠も見せる） */
export function renderPortalPreview(d: PortalData): string {
  return renderPortal(d, { preview: true });
}

export type { PortalBlock };
