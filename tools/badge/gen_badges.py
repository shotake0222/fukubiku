# -*- coding: utf-8 -*-
"""結果バッジ(1等 / 当たり / 参加賞 など)のテクスチャを生成する。
#
# 【2026-09 改訂】
# 以前はトゲトゲの星形(16角)を描き、その上に文字を載せていた。
# 星の形そのものが古く見えるうえ、旧カテゴリのモデルでは星の裏に
# 「単色の四角い板(badge_*_rim マテリアル)」が入っていて、
# 星の谷間からその四角がのぞいて見えるという問題もあった。
#
# そこで形のある装飾はすべて捨て、
#   ・結果の文字
#   ・文字を際立たせる光(グロー)
# だけで構成する。背景は完全な透明なので、カメラ映像の上に
# 文字だけが浮かび上がる。
#
# 構成(奥→手前):
#   1. 暗い柔らかい敷き(明るい背景でも文字が沈まないようにする)
#   2. ランク色の外側グロー(金/銀/銅…で序列が一目で分かる)
#   3. 白に近い内側グロー(文字のすぐ後ろを明るくしてコントラストを稼ぐ)
#   4. 文字の落ち影
#   5. 文字本体(白 + ランク色の縁取り)
#
# 透明度がなめらかに変化するので、マテリアルは MASK ではなく BLEND で使う。
# (apply_badges.py が .glb 側の設定も合わせて書き換える)
#
# 使い方: python3 tools/badge/gen_badges.py [出力先ディレクトリ]
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# 512→1024。文字の輪郭が近距離でもなめらかになる(「ディテールが甘い」対策)。
SIZE = 1024          # 描画時の解像度(この大きさで描いてから縮める)
OUT_SIZE = 512       # .glbへ埋め込む解像度
C = SIZE // 2
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

# ランクごとの配色。
#   glow : 外側グローの色(ランクの識別色)
#   core : 文字のすぐ後ろを明るくする色
#   ts   : 文字の縁取り色(濃いめ。白文字とのコントラストを作る)
THEMES = {
    "gold":   dict(glow=(255, 186, 26),  core=(255, 246, 214), ts=(140, 62, 8)),
    "silver": dict(glow=(176, 202, 226), core=(246, 251, 255), ts=(46, 62, 78)),
    "bronze": dict(glow=(228, 146, 66),  core=(255, 236, 214), ts=(104, 50, 14)),
    "red":    dict(glow=(248, 84, 74),   core=(255, 226, 222), ts=(112, 16, 11)),
    "teal":   dict(glow=(46, 196, 176),  core=(224, 252, 247), ts=(8, 78, 68)),
    "slate":  dict(glow=(150, 172, 192), core=(240, 246, 251), ts=(40, 54, 66)),
}
RANK = {
    "大当たり": "gold", "1等": "gold", "当たり": "gold",
    "2等": "silver", "3等": "bronze", "4等": "red", "5等": "teal", "6等": "teal",
    "クーポン": "red", "はずれ": "slate", "参加賞": "slate",
    "またね": "slate",
}
LABELS = ["大当たり", "1等", "2等", "3等", "4等", "5等", "6等", "当たり",
          "クーポン", "はずれ", "参加賞", "またね"]


def radial_alpha(radius, inner=0.0, peak=255, gamma=2.0):
    """中心が最も濃く、radius で 0 になる円形のアルファマスクを作る。

    gamma を上げるほど中心付近だけが濃く残り、外へすっと消える。
    ガウシアンぼかしを何度もかけるより速く、かつ端が完全に0になるので
    テクスチャの縁に線が出ない。
    """
    m = Image.new("L", (SIZE, SIZE), 0)
    px = m.load()
    r2 = radius * radius
    for y in range(SIZE):
        dy = y - C
        dy2 = dy * dy
        if dy2 > r2:
            continue
        span = int(math.sqrt(r2 - dy2))
        for x in range(C - span, C + span + 1):
            dx = x - C
            t = math.sqrt(dx * dx + dy2) / radius
            if t <= inner:
                v = peak
            else:
                k = (t - inner) / (1.0 - inner)
                v = int(peak * ((1.0 - k) ** gamma))
            if v > 0:
                px[x, y] = v
    return m


def _fit_font(text, max_w, max_h, start=int(SIZE * 0.42)):
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    size_pt = start
    while size_pt > 40:
        font = ImageFont.truetype(FONT_PATH, size_pt)
        l, t, r, b = probe.textbbox((0, 0), text, font=font)
        if (r - l) <= max_w and (b - t) <= max_h:
            return font
        size_pt -= 4
    return ImageFont.truetype(FONT_PATH, size_pt)


def make_badge(text, theme):
    th = THEMES[theme]
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # --- 1) ランク色の外側グロー ---------------------------------------
    # 金/銀/銅… で序列が一目で分かるようにする。中心を濃く、外へすっと消す。
    outer = radial_alpha(SIZE * 0.45, inner=0.03, peak=225, gamma=2.6)
    base.paste(th["glow"] + (255,), (0, 0), outer)

    # --- 2) 内側の明るいコア -------------------------------------------
    core = radial_alpha(SIZE * 0.24, inner=0.02, peak=240, gamma=1.8)
    base.paste(th["core"] + (255,), (0, 0), core)

    # --- 3) 文字を組む --------------------------------------------------
    max_w, max_h = int(SIZE * 0.66), int(SIZE * 0.31)
    font = _fit_font(text, max_w, max_h)
    size_pt = font.size
    stroke = max(8, int(size_pt * 0.10))

    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    l, t, r, b = probe.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = C - (r - l) / 2 - l
    y = C - (b - t) / 2 - t

    # 文字のシルエットをぼかした「影」。円い板ではなく文字の形に沿うので、
    # グローの色を濁らせずにコントラストだけを稼げる。
    silhouette = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(silhouette).text((x, y), text, font=font, fill=255,
                                    stroke_width=int(stroke * 2.1), stroke_fill=255)
    halo = silhouette.filter(ImageFilter.GaussianBlur(SIZE / 90.0))
    halo = halo.point(lambda v: min(255, int(v * 1.25)))
    base.paste((8, 12, 20, 255), (0, 0), halo)

    # --- 4) 文字本体 ----------------------------------------------------
    d = ImageDraw.Draw(base)
    d.text((x, y + max(3, int(size_pt * 0.035))), text, font=font,
           fill=(0, 0, 0, 90), stroke_width=stroke, stroke_fill=(0, 0, 0, 90))
    d.text((x, y), text, font=font, fill=(255, 255, 255, 255),
           stroke_width=stroke, stroke_fill=th["ts"] + (255,))

    # --- 仕上げ: テクスチャの縁は必ず透明にする ------------------------
    # (BLENDで描くので、端に色が残っていると四角い板に見えてしまう)
    edge = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(edge).ellipse([2, 2, SIZE - 3, SIZE - 3], fill=255)
    edge = edge.filter(ImageFilter.GaussianBlur(SIZE / 128.0))
    base.putalpha(Image.composite(base.getchannel("A"),
                                  Image.new("L", (SIZE, SIZE), 0), edge))
    return base


def dither(img, amp=3):
    """減色前にごく弱いノイズを足す。

    グローはなめらかな階調なので、そのまま減色すると同心円状の縞(バンディング)
    が出る。1〜3階調ぶんのノイズを混ぜておくと縞が視覚的に散って消える。
    """
    import random
    rnd = random.Random(1234)
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            n = rnd.randint(-amp, amp)
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)),
                        max(0, min(255, b + n)),
                        max(0, min(255, a + rnd.randint(-amp, amp))))
    return img


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")
    os.makedirs(outdir, exist_ok=True)
    for label in LABELS:
        img = make_badge(label, RANK.get(label, "gold"))
        # GLBに埋め込むのでファイルサイズを抑える。
        # FASTOCTREEはアルファを保持したまま減色できる。
        # 1024で描いてから512へ縮める(スーパーサンプリング)。
        # 直接512で描くより文字の輪郭がなめらかになり、かつファイルは小さい。
        img = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
        img = dither(img, 1).quantize(colors=255, method=Image.FASTOCTREE)
        path = os.path.join(outdir, "badge_%s.png" % label)
        img.save(path, "PNG", optimize=True)
        print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
