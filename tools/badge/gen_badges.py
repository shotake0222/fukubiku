# -*- coding: utf-8 -*-
"""結果バッジ(1等 / 当たり / 参加賞 など)のテクスチャを生成する。
#
# 既存のバッジは単色のベタ塗りで、カメラ映像の上に出すと安っぽく見えていた。
# ここでは同じ星形のシルエットを保ちつつ、
#   ・中心から外へのグラデーション(金属的な面)
#   ・濃色の外縁(カメラ映像の上でもシルエットが立つ)
#   ・上半分のツヤ
#   ・落ち影
#   ・縁取り付きの文字
# を加えて情報量を増やす。ランクごとに金/銀/銅などへ色を変え、序列が一目で分かるようにする。
#
# 使い方: python3 tools/badge/gen_badges.py [出力先ディレクトリ]
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 512
C = SIZE // 2
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

# ランクごとの配色。f1→f3 が面のグラデーション、rim が外縁。
THEMES = {
    "gold":   dict(f1=(255, 251, 230), f2=(255, 212, 59),  f3=(232, 147, 12),
                   rim=(179, 38, 30),  rim2=(124, 20, 15),  ring=(255, 233, 168), ts=(124, 45, 18)),
    "silver": dict(f1=(255, 255, 255), f2=(220, 230, 239), f3=(147, 168, 188),
                   rim=(63, 81, 99),   rim2=(38, 51, 63),   ring=(242, 247, 251), ts=(38, 51, 63)),
    "bronze": dict(f1=(255, 240, 222), f2=(233, 168, 99),  f3=(185, 108, 36),
                   rim=(107, 52, 16),  rim2=(72, 34, 10),   ring=(255, 217, 174), ts=(90, 43, 12)),
    "red":    dict(f1=(255, 233, 230), f2=(248, 113, 113), f3=(192, 39, 28),
                   rim=(110, 18, 12),  rim2=(74, 11, 7),    ring=(255, 210, 206), ts=(92, 15, 10)),
    "teal":   dict(f1=(234, 251, 247), f2=(94, 201, 185),  f3=(23, 128, 111),
                   rim=(11, 74, 64),   rim2=(6, 50, 43),    ring=(189, 237, 228), ts=(11, 74, 64)),
    "slate":  dict(f1=(247, 250, 252), f2=(185, 198, 211), f3=(122, 139, 155),
                   rim=(58, 72, 85),   rim2=(35, 46, 56),   ring=(230, 237, 243), ts=(42, 53, 64)),
}
RANK = {
    "大当たり": "gold", "1等": "gold", "当たり": "gold",
    "2等": "silver", "3等": "bronze", "4等": "red", "5等": "teal", "6等": "teal",
    "クーポン": "red", "はずれ": "slate", "参加賞": "slate",
}
LABELS = ["大当たり", "1等", "2等", "3等", "4等", "5等", "6等", "当たり", "クーポン", "はずれ", "参加賞"]

POINTS = 16


def star(cx, cy, r_out, r_in, n=POINTS):
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n - math.pi / 2
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def radial_fill(size, c1, c2, c3, cx_ratio=0.40, cy_ratio=0.32, radius_ratio=0.76):
    """中心をずらした放射グラデーション。上寄りに光源があるように見せる。"""
    img = Image.new("RGB", (size, size))
    px = img.load()
    cx, cy = size * cx_ratio, size * cy_ratio
    rmax = size * radius_ratio
    for y in range(size):
        dy = y - cy
        for x in range(size):
            t = math.hypot(x - cx, dy) / rmax
            if t > 1.0:
                t = 1.0
            if t < 0.30:
                k = t / 0.30
                col = tuple(int(c1[i] + (c2[i] - c1[i]) * k) for i in range(3))
            else:
                k = (t - 0.30) / 0.70
                k = k * k * (3 - 2 * k)  # なめらかに外側へ落とす
                col = tuple(int(c2[i] + (c3[i] - c2[i]) * k) for i in range(3))
            px[x, y] = col
    return img


def vertical_fill(size, top, bottom):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        k = y / max(size - 1, 1)
        d.line([(0, y), (size, y)],
               fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))
    return img


def make_badge(text, theme):
    th = THEMES[theme]
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # --- 落ち影(外縁のシルエットをぼかして下にずらす) ---
    shadow_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(shadow_mask).polygon(star(C, C + 8, 246, 176), fill=115)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(9))
    base.paste((0, 0, 0, 255), (0, 0), shadow_mask)

    # --- 外縁 ---
    rim_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(rim_mask).polygon(star(C, C, 246, 176), fill=255)
    base.paste(vertical_fill(SIZE, th["rim"], th["rim2"]), (0, 0), rim_mask)

    # --- 面 ---
    face_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(face_mask).polygon(star(C, C, 214, 152), fill=255)
    base.paste(radial_fill(SIZE, th["f1"], th["f2"], th["f3"]), (0, 0), face_mask)

    # --- 内側の細いリング ---
    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(ring).polygon(star(C, C, 188, 134), outline=th["ring"] + (180,), width=3)
    base.alpha_composite(ring)

    # --- 上半分のツヤ(面の内側だけに乗せる) ---
    gloss = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(gloss).ellipse([C - 250, 40 - 150, C + 250, 40 + 150], fill=255)
    grad = Image.new("L", (SIZE, SIZE))
    gd = ImageDraw.Draw(grad)
    for y in range(SIZE):
        gd.line([(0, y), (SIZE, y)], fill=max(0, int(78 * (1 - y / 250.0))))
    gloss = Image.composite(grad, Image.new("L", (SIZE, SIZE), 0), gloss)
    gloss = Image.composite(gloss, Image.new("L", (SIZE, SIZE), 0), face_mask)
    gloss = gloss.filter(ImageFilter.GaussianBlur(22))
    base.paste((255, 255, 255, 255), (0, 0), gloss)

    # --- 文字(星の内側に必ず収まるよう実測して縮める) ---
    max_w, max_h = 268, 168
    size_pt = 190
    while size_pt > 40:
        font = ImageFont.truetype(FONT_PATH, size_pt)
        l, t, r, b = ImageDraw.Draw(base).textbbox((0, 0), text, font=font)
        if (r - l) <= max_w and (b - t) <= max_h:
            break
        size_pt -= 4
    font = ImageFont.truetype(FONT_PATH, size_pt)
    stroke = max(6, int(size_pt * 0.085))
    d = ImageDraw.Draw(base)
    l, t, r, b = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = C - (r - l) / 2 - l
    y = C - (b - t) / 2 - t
    # 文字の落ち影
    d.text((x, y + max(2, int(size_pt * 0.045))), text, font=font, fill=(0, 0, 0, 70),
           stroke_width=stroke, stroke_fill=(0, 0, 0, 70))
    d.text((x, y), text, font=font, fill=(255, 255, 255, 255),
           stroke_width=stroke, stroke_fill=th["ts"] + (255,))
    return base


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")
    os.makedirs(outdir, exist_ok=True)
    for label in LABELS:
        img = make_badge(label, RANK.get(label, "gold"))
        # GLBに埋め込むためファイルサイズを抑える。
        # FASTOCTREEはアルファを保持したまま減色できる。
        img = img.quantize(colors=128, method=Image.FASTOCTREE)
        path = os.path.join(outdir, "badge_%s.png" % label)
        img.save(path, "PNG", optimize=True)
        print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
