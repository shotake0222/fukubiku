import {
  arBand,
  banners,
  chapters,
  esc,
  faq,
  footer,
  header,
  img,
  news,
  nl2br,
  notes,
  outline,
  picks,
  secHead,
  spots,
  sticky,
  type Ctx,
} from "./render";
import type { PortalTemplate } from "./types";

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';

/** テンプレート共通のヒーロー（背景画像＋文字） */
function heroCover(ctx: Ctx): string {
  const { d } = ctx;
  const bg = d.heroImageUrl
    ? `background-image:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.6)),url('${esc(d.heroImageUrl)}')`
    : "";
  return `<section class="hero" style="${bg}">
  <div class="hero-inner">
    ${d.heroEyebrow ? `<p class="hero-eyebrow">${esc(d.heroEyebrow)}</p>` : ""}
    ${d.heroTitle ? `<h1>${nl2br(d.heroTitle)}</h1>` : ""}
    ${d.heroText ? `<p class="hero-text">${nl2br(d.heroText)}</p>` : ""}
  </div>
</section>`;
}

/** 左右2分割のヒーロー（施設向け） */
function heroSplit(ctx: Ctx): string {
  const { d } = ctx;
  return `<section class="hero-split">
  <div class="hero-txt">
    ${d.heroEyebrow ? `<p class="hero-eyebrow">${esc(d.heroEyebrow)}</p>` : ""}
    ${d.heroTitle ? `<h1>${nl2br(d.heroTitle)}</h1>` : ""}
    ${d.heroText ? `<p class="hero-text">${nl2br(d.heroText)}</p>` : ""}
  </div>
  ${img(d.heroImageUrl, "hero-img", "館内写真", ctx.ph)}
</section>`;
}

/** ヒーローと参加導線を一体にした帯（常設向け） */
function heroNow(ctx: Ctx): string {
  const { d } = ctx;
  return `<section class="now">
  <div class="now-inner">
    <div>
      ${d.heroEyebrow ? `<span class="now-live">${esc(d.heroEyebrow)}</span>` : ""}
      ${d.heroTitle ? `<h1>${nl2br(d.heroTitle)}</h1>` : ""}
      ${d.heroText ? `<p>${nl2br(d.heroText)}</p>` : ""}
      ${d.arUrl ? `<a class="now-btn" href="${esc(d.arUrl)}">${esc(d.arButtonLabel)}</a>` : ""}
    </div>
    ${img(d.heroImageUrl, "now-img", "季節のビジュアル", ctx.ph)}
  </div>
</section>`;
}

/** 開催状況の1行（施設向け） */
function statusLine(ctx: Ctx): string {
  if (!ctx.d.statusLine) return "";
  return `<div class="statusline"><div class="wrap">${nl2br(ctx.d.statusLine)}</div></div>`;
}

/** 商店街テンプレートの上部キャンペーン帯（お知らせの先頭1件） */
function campaignBar(ctx: Ctx): string {
  const first = ctx.d.blocks.news[0];
  if (!first) return "";
  return `<div class="campaign"><div class="wrap">
    <span class="campaign-lbl">${esc(first.title || "CAMPAIGN")}</span>
    <p>${nl2br(first.body)}</p>
  </div></div>`;
}

/** お知らせと開催概要を2段組で（観光向け） */
function newsAndOutline(ctx: Ctx): string {
  const n = news(ctx, "NEWS", "お知らせ");
  const o = outline(ctx, "ACCESS", "開催概要");
  if (!n && !o) return "";
  return `<section class="sec info-sec"><div class="wrap info">${n}${o}</div></section>`;
}

function outlineOnly(ctx: Ctx, eyebrow: string, heading: string): string {
  const o = outline(ctx, eyebrow, heading);
  if (!o) return "";
  return `<section class="sec info-sec"><div class="wrap">${o}</div></section>`;
}

function notesSection(ctx: Ctx, heading: string): string {
  const n = notes(ctx, heading);
  if (!n) return "";
  return `<section class="sec notes-sec"><div class="wrap">${n}</div></section>`;
}

// ============================================================
// テンプレートごとの並び順
// ============================================================
export const TEMPLATE_SECTIONS: Record<PortalTemplate, (ctx: Ctx) => string> = {
  kanko: (c) =>
    [
      header(c),
      heroCover(c),
      arBand(c),
      picks(c, "HIGHLIGHTS", "この街の見どころ"),
      spots(c, "SPOTS", "スタンプスポット"),
      banners(c, "PICK UP", "おすすめ・お得な情報"),
      newsAndOutline(c),
      footer(c),
      sticky(c),
    ].join("\n"),

  shotengai: (c) =>
    [
      header(c),
      heroCover(c),
      arBand(c),
      campaignBar(c),
      spots(c, "SHOPS", "参加店舗"),
      banners(c, "INFORMATION", "おすすめ・関連情報"),
      outlineOnly(c, "OUTLINE", "開催概要"),
      footer(c),
      sticky(c),
    ].join("\n"),

  shisetsu: (c) =>
    [
      header(c),
      statusLine(c),
      heroSplit(c),
      arBand(c),
      picks(c, "HOW TO PLAY", "遊び方"),
      spots(c, "SPOTS", "館内スポット"),
      outlineOnly(c, "SCHEDULE", "開催概要"),
      banners(c, "INFORMATION", "館内のご案内"),
      notesSection(c, "ご参加にあたって"),
      footer(c),
      sticky(c),
    ].join("\n"),

  seichi: (c) =>
    [
      header(c),
      heroCover(c),
      picks(c, "CHARACTERS", "登場キャラクター"),
      arBand(c),
      spots(c, "LOCATIONS", "巡礼スポット"),
      banners(c, "INFORMATION", "関連情報"),
      notesSection(c, "巡礼にあたってのお願い"),
      footer(c),
      sticky(c),
    ].join("\n"),

  jousetsu: (c) =>
    [
      header(c),
      heroNow(c),
      outlineOnly(c, "STATUS", "開催状況"),
      spots(c, "NEW SPOT", "今月の追加スポット"),
      chapters(c, "CHAPTERS", "これまでの章"),
      banners(c, "INFORMATION", "園内のご案内"),
      faq(c, "FAQ", "よくあるご質問"),
      footer(c),
      sticky(c),
    ].join("\n"),
};

// ============================================================
// テンプレートごとの見た目
// 共通クラスに対して、色・書体・角の丸み・影を上書きする
// ============================================================
const KANKO = `
body{background:#fff;color:#33291f;font-family:${SANS}}
.ph{background:linear-gradient(135deg,#e8eeec,#d8e3e0);color:#9aa8a4}
.hd{background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e3e8e6}
.logo-mark{background:var(--brand);color:#fff}
.hd-go{background:var(--brand);color:#fff}
.hero{min-height:460px;display:flex;align-items:flex-end;background-size:cover;background-position:center;
  background-color:#9fbdb4}
.hero-inner{max-width:1000px;margin:0 auto;padding:0 20px 48px;color:#fff;width:100%}
.hero-eyebrow{font-size:12px;letter-spacing:.35em;margin:0 0 14px;opacity:.92}
.hero h1{font-family:${SERIF};font-size:44px;line-height:1.3;margin:0 0 14px;font-weight:800;text-shadow:0 2px 16px rgba(0,0,0,.3)}
.hero-text{margin:0;font-size:15px;max-width:34em;opacity:.95}
.ar{background:var(--brand);color:#fff;padding:44px 0}
.ar .btn{background:#fff;color:var(--brand-dark);box-shadow:0 8px 22px rgba(0,0,0,.18)}
.sec-head span{color:var(--brand)}
.sec-head h2{font-family:${SERIF}}
.card{background:#f6f8f7;border:1px solid #e3e8e6;border-radius:16px}
.spots{background:#f6f8f7;border-top:1px solid #e3e8e6;border-bottom:1px solid #e3e8e6}
.spot{border-bottom:1px dashed #e3e8e6}
.spot:last-child{border-bottom:none}
.spot-no{background:var(--brand);color:#fff}
.spot-badge{background:var(--brand);color:#fff}
.banner{border:1px solid #e3e8e6;border-radius:16px}
.info{display:grid;grid-template-columns:1.3fr 1fr;gap:34px}
.info-sec{background:#f6f8f7;border-top:1px solid #e3e8e6}
.info .sec-head{text-align:left}
.news li{border-bottom:1px dashed #e3e8e6}
.news time{color:var(--brand)}
.outline dt{color:var(--brand)}
.ft{background:#101c1a;color:#cfdad7}
.ft a{color:#cfdad7}
.sticky{background:rgba(255,255,255,.96);border-top:1px solid #e3e8e6}
.sticky a{background:var(--brand);color:#fff}
@media(max-width:860px){.info{grid-template-columns:1fr}}
@media(max-width:700px){.hero{min-height:380px}.hero h1{font-size:30px}}
`;

const SHOTENGAI = `
body{background:#fffdf7;color:#2e2a20;font-family:${SANS}}
.ph{background:repeating-linear-gradient(45deg,#f0e6d2 0 10px,#e8dcc4 10px 20px);color:#b3a68c}
.hd{background:var(--brand);color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.logo{color:#fff}
.logo-mark{background:rgba(255,255,255,.22);color:#fff}
.hd-go{background:#fff;color:var(--brand-dark)}
.hero{background:var(--brand);color:#fff;padding:46px 0 56px;position:relative;text-align:center}
.hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:16px;
  background:repeating-linear-gradient(90deg,#fff 0 26px,var(--accent) 26px 52px)}
.hero-inner{max-width:1000px;margin:0 auto;padding:0 20px}
.hero-eyebrow{display:inline-block;background:var(--accent);color:#3a2f00;font-weight:900;font-size:12px;
  padding:6px 16px;border-radius:999px;letter-spacing:.1em;margin:0 0 18px}
.hero h1{font-size:42px;font-weight:900;margin:0 0 12px;line-height:1.25;text-shadow:0 3px 0 rgba(0,0,0,.12)}
.hero-text{margin:0 auto;font-size:15px;max-width:32em;opacity:.95}
.ar{background:#fff8e8;border-bottom:3px solid var(--brand);padding:40px 0}
.ar .inner{flex-direction:column;text-align:center;gap:18px}
.ar h2{color:var(--brand-dark);font-weight:900}
.ar p{opacity:.75}
.ar .btn{background:var(--brand);color:#fff;font-weight:900;box-shadow:0 5px 0 var(--brand-dark)}
.campaign{background:var(--accent);padding:16px 0}
.campaign .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.campaign-lbl{background:#3a2f00;color:var(--accent);font-weight:900;font-size:12px;padding:5px 12px;border-radius:5px}
.campaign p{margin:0;font-weight:800;font-size:15px;color:#3a2f00}
.sec-head{text-align:left;display:flex;align-items:center;gap:14px}
.sec-head span{color:var(--brand);order:2}
.sec-head h2{font-weight:900}
.sec-head::after{content:"";flex:1;height:3px;order:3;
  background:repeating-linear-gradient(90deg,var(--brand) 0 8px,transparent 8px 16px)}
.spotwrap{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.spot{display:block;background:#fff;border:2px solid #2e2a20;border-radius:10px;overflow:hidden;
  padding:0;position:relative;box-shadow:4px 4px 0 rgba(46,42,32,.12)}
.spot-no{position:absolute;top:10px;left:10px;background:var(--brand);color:#fff;width:auto;height:auto;
  border-radius:999px;padding:4px 11px;font-size:11px;font-weight:900}
.spot-img{width:100%;height:150px;border-radius:0}
.spot-txt{padding:16px}
.spot-badge{background:#2e2a20;color:#fff}
.spot-meta{border-top:1px dashed #efe3c9;padding-top:10px}
.banner{background:#fff;border:2px solid #2e2a20;border-radius:10px;box-shadow:4px 4px 0 rgba(46,42,32,.12)}
.banners-sec{background:#fff8e8;border-top:1px solid #efe3c9;border-bottom:1px solid #efe3c9}
.outline{background:#fff;border:2px solid #2e2a20;border-radius:10px;padding:26px}
.outline dt{color:var(--brand-dark)}
.ft{background:#2e2a20;color:#e8dcc4}
.ft a{color:#e8dcc4}
.sticky{background:rgba(255,253,247,.96);border-top:2px solid var(--brand)}
.sticky a{background:var(--brand);color:#fff;border-radius:999px;font-weight:900}
@media(max-width:900px){.spotwrap{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.spotwrap{grid-template-columns:1fr}.hero h1{font-size:29px}}
`;

const SHISETSU = `
body{background:#fff;color:#14243f;font-family:${SANS}}
.ph{background:linear-gradient(135deg,#e4ecf4,#cfdcea);color:#94a7bd}
.hd{background:#fff;border-bottom:1px solid #dbe4ee}
.logo-mark{background:var(--brand);color:#fff;border-radius:8px}
.hd-go{background:var(--brand);color:#fff;border-radius:8px}
.statusline{background:#f2f6fa;border-bottom:1px solid #dbe4ee;font-size:13px}
.statusline .wrap{padding:12px 20px}
.hero-split{display:grid;grid-template-columns:1.1fr .9fr;align-items:stretch}
.hero-txt{padding:60px 20px 60px 0;max-width:520px;margin-left:auto}
.hero-eyebrow{font-size:11px;letter-spacing:.3em;color:var(--accent);font-weight:800;margin:0 0 14px}
.hero-split h1{font-size:37px;line-height:1.3;margin:0 0 16px;font-weight:800}
.hero-text{margin:0;font-size:15px;color:#6b7c96}
.hero-img{width:100%;height:100%;min-height:300px;object-fit:cover}
.ar{background:var(--brand);color:#fff;padding:40px 0}
.ar .btn{background:#fff;color:var(--brand-dark);border-radius:10px}
.sec-head{text-align:left}
.sec-head span{color:var(--accent)}
.picks .grid3{counter-reset:s}
.card{background:#f2f6fa;border-radius:12px;position:relative}
.card-n{color:var(--accent)}
.spotwrap{border:1px solid #dbe4ee;border-radius:12px;overflow:hidden}
.spot{padding:14px 20px;border-bottom:1px solid #dbe4ee}
.spot:last-child{border-bottom:none}
.spot-no{background:#f2f6fa;color:var(--brand);border-radius:6px;width:26px;height:26px;font-size:12px}
.spot-img{width:96px;height:66px}
.spot-badge{background:var(--brand);color:#fff}
.banner{border:1px solid #dbe4ee;border-radius:12px}
.banners{grid-template-columns:repeat(4,1fr)}
.banner-img{height:88px}
.info-sec{background:#f2f6fa}
.outline dt{color:var(--brand)}
.notes{background:#fff8e6;border:1px solid #f2dfa8;color:#6b5518}
.notes h3{color:#8a6d1f}
.ft{background:#0f1c2e;color:#c6d2e2}
.ft a{color:#c6d2e2}
.sticky{background:rgba(255,255,255,.96);border-top:1px solid #dbe4ee}
.sticky a{background:var(--brand);color:#fff;border-radius:10px}
@media(max-width:900px){.banners{grid-template-columns:repeat(2,1fr)}}
@media(max-width:860px){.hero-split{grid-template-columns:1fr}
  .hero-txt{padding:44px 20px;max-width:none;margin:0}.hero-img{min-height:220px}.hero-split h1{font-size:28px}}
@media(max-width:480px){.banners{grid-template-columns:1fr}}
`;

const SEICHI = `
body{background:#0b0f1a;color:#f2f5ff;font-family:${SANS}}
.ph{background:linear-gradient(135deg,#1b2338,#2a3550);color:#5b6b8c}
.hd{background:rgba(11,15,26,.88);backdrop-filter:blur(10px);border-bottom:1px solid #243049}
.logo-mark{background:var(--brand);color:#fff}
.hd-go{background:var(--brand);color:#fff;box-shadow:0 0 18px rgba(0,0,0,.4)}
.hero{min-height:500px;display:flex;align-items:center;justify-content:center;text-align:center;
  background-size:cover;background-position:center;background-color:#131a2b}
.hero-inner{max-width:1000px;margin:0 auto;padding:60px 20px;width:100%;color:#fff}
.hero-eyebrow{font-size:11px;letter-spacing:.28em;color:var(--accent);font-weight:800;margin:0 0 18px}
.hero h1{font-size:46px;line-height:1.25;margin:0 0 18px;font-weight:900;text-shadow:0 0 30px rgba(0,0,0,.6)}
.hero-text{margin:0 auto;font-size:15px;max-width:34em;opacity:.9}
.ar{background:#131a2b;border-top:1px solid #243049;border-bottom:1px solid #243049;padding:44px 0}
.ar p{color:#9aa6c4}
.ar .btn{background:var(--brand);color:#fff;font-weight:900;box-shadow:0 0 28px rgba(0,0,0,.5)}
.sec-head span{color:var(--accent)}
.sec-head h2{font-weight:900}
.grid3{grid-template-columns:repeat(4,1fr);gap:18px}
.card{background:#131a2b;border:1px solid #243049;border-radius:14px;text-align:center}
.card-img{height:180px}
.card-body{padding:16px 12px}
.card-n{display:none}
.card h3{font-size:15px}
.card p{font-size:12px;color:#9aa6c4}
.spotwrap{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.spot{display:block;background:#131a2b;border:1px solid #243049;border-radius:14px;overflow:hidden;padding:0;position:relative}
.spot-no{position:absolute;top:12px;left:12px;background:var(--brand);color:#fff;width:auto;height:auto;
  border-radius:999px;padding:5px 13px;font-size:12px;font-weight:900}
.spot-img{width:100%;height:190px;border-radius:0}
.spot-txt{padding:20px}
.spot-badge{background:rgba(255,255,255,.1);color:var(--accent)}
.spot-txt p{color:#9aa6c4}
.spot-meta{border-top:1px solid #243049;padding-top:12px}
.banner{background:#131a2b;border:1px solid #243049;border-radius:14px}
.banner-cap small{color:#9aa6c4;opacity:1}
.notes{background:rgba(255,255,255,.04);border:1px solid #33405e}
.notes h3{color:var(--brand)}
.notes ul{color:#9aa6c4}
.ft{background:#070a12;color:#9aa6c4;border-top:1px solid #243049}
.ft a{color:#9aa6c4}
.sticky{background:rgba(11,15,26,.96);border-top:1px solid #243049}
.sticky a{background:var(--brand);color:#fff;border-radius:999px;font-weight:900}
@media(max-width:860px){.grid3{grid-template-columns:repeat(2,1fr)}.spotwrap{grid-template-columns:1fr}}
@media(max-width:700px){.hero{min-height:420px}.hero h1{font-size:30px}}
`;

const JOUSETSU = `
body{background:#fff;color:#1e2c1c;font-family:${SANS}}
.ph{background:linear-gradient(135deg,#e5eee1,#d2e0cc);color:#9db195}
.hd{background:#fff;border-bottom:1px solid #dbe6d6}
.logo-mark{background:var(--brand);color:#fff;border-radius:50%}
.hd-go{background:var(--brand);color:#fff}
.now{background:linear-gradient(160deg,var(--brand),var(--brand-dark));color:#fff;padding:52px 0}
.now-inner{max-width:1000px;margin:0 auto;padding:0 20px;display:grid;grid-template-columns:1fr 320px;gap:36px;align-items:center}
.now-live{display:inline-block;background:var(--accent);color:#3a2a00;font-size:12px;font-weight:900;
  padding:6px 14px;border-radius:999px;margin-bottom:16px}
.now h1{font-size:37px;line-height:1.28;margin:0 0 12px;font-weight:900}
.now p{margin:0 0 24px;font-size:15px;opacity:.92;max-width:32em}
.now-btn{display:inline-block;background:#fff;color:var(--brand-dark);text-decoration:none;font-weight:900;
  padding:17px 40px;border-radius:999px;font-size:16px;box-shadow:0 10px 26px rgba(0,0,0,.2)}
.now-img{width:100%;height:220px;object-fit:cover;border-radius:14px}
.sec-head span{color:var(--accent)}
.sec-head h2{font-weight:900}
.info-sec{background:#f3f7f0;border-bottom:1px solid #dbe6d6;padding:26px 0}
.info-sec .sec-head{display:none}
.outline dl{display:flex;gap:28px;flex-wrap:wrap;margin:0}
.outline dt{margin:0;font-size:13px;color:var(--brand);order:2}
.outline dd{margin:0 4px 0 0;font-size:20px;font-weight:900;color:var(--brand);order:1}
.spotwrap{border:2px solid var(--accent);border-radius:14px;overflow:hidden}
.spot{padding:0;display:grid;grid-template-columns:220px 1fr;gap:0;align-items:stretch}
.spot-no{display:none}
.spot-img{width:100%;height:100%;min-height:170px;border-radius:0}
.spot-txt{padding:24px}
.spot-badge{background:var(--accent);color:#3a2a00}
.spot-meta{border-top:1px dashed #dbe6d6;padding-top:12px}
.chapters-sec{background:#f3f7f0;border-top:1px solid #dbe6d6;border-bottom:1px solid #dbe6d6}
.chapter{background:#fff;border:1px solid #dbe6d6;border-radius:14px}
.chapter.is-now{border:2px solid var(--brand);box-shadow:0 10px 24px rgba(0,0,0,.08)}
.chapter-flag{background:var(--brand);color:#fff}
.chapter-season{color:var(--accent)}
.chapter p{opacity:.7}
.banner{background:#fff;border:1px solid #dbe6d6;border-radius:14px}
.faq-sec{background:#f3f7f0}
.faq dt{color:var(--brand-dark)}
.ft{background:#152317;color:#c8d6c4}
.ft a{color:#c8d6c4}
.sticky{background:rgba(255,255,255,.96);border-top:1px solid #dbe6d6}
.sticky a{background:var(--brand);color:#fff;border-radius:999px;font-weight:900}
@media(max-width:860px){.now-inner{grid-template-columns:1fr}.now h1{font-size:28px}
  .now-btn{display:block;text-align:center}.spot{grid-template-columns:1fr}}
`;

export const TEMPLATE_CSS: Record<PortalTemplate, string> = {
  kanko: KANKO,
  shotengai: SHOTENGAI,
  shisetsu: SHISETSU,
  seichi: SEICHI,
  jousetsu: JOUSETSU,
};
