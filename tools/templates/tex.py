# -*- coding: utf-8 -*-
"""テンプレート用のテクスチャ生成。
#
# 既存テンプレートのテクスチャは単色のベタ塗りで安っぽく見えていたため、
# 新しく作るものは最初からグラデーション・陰影・紙の粒状感を入れる。
"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"


def quantize(img, colors=128):
    """GLBに埋め込むためのファイルサイズ削減。アルファを保持したまま減色する。"""
    return img.quantize(colors=colors, method=Image.FASTOCTREE)


def to_png(img, colors=128):
    import io
    buf = io.BytesIO()
    quantize(img, colors).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))
    return img


def rgrad(size, inner, outer, cx=0.5, cy=0.4, r=0.8):
    """放射グラデーション。光源が少し上にある見え方にする。"""
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    ccx, ccy, rmax = w * cx, h * cy, max(w, h) * r
    for y in range(h):
        for x in range(w):
            t = min(1.0, math.hypot(x - ccx, y - ccy) / rmax)
            t = t * t * (3 - 2 * t)
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(3))
    return img


def grain(img, amount=7, seed=0):
    """紙・布の粒状感。ベタ塗りに見えないようにするための微細なノイズ。"""
    rnd = random.Random(seed)
    w, h = img.size
    n = Image.new("L", (w // 4 or 1, h // 4 or 1))
    n.putdata([128 + rnd.randint(-amount * 4, amount * 4) for _ in range((w // 4 or 1) * (h // 4 or 1))])
    n = n.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.6))
    return Image.blend(img.convert("RGB"), Image.merge("RGB", (n, n, n)), 0.10)


def vignette(img, strength=0.35):
    """周辺を少し落として立体感を出す。"""
    w, h = img.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).ellipse([-w * 0.15, -h * 0.15, w * 1.15, h * 1.15], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(w * 0.12))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, strength), m)


def fit_font(draw, text, max_w, max_h, start=200, path=FONT):
    size = start
    while size > 8:
        f = ImageFont.truetype(path, size)
        l, t, r, b = draw.textbbox((0, 0), text, font=f)
        if (r - l) <= max_w and (b - t) <= max_h:
            return f
        size -= 4
    return ImageFont.truetype(path, 8)


def draw_text(img, text, box, fill=(255, 255, 255), stroke=None, stroke_w=None,
              path=FONT, shadow=True):
    """boxの中央に、収まるよう自動縮小して描く。"""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    f = fit_font(d, text, x1 - x0, y1 - y0, path=path)
    sw = stroke_w if stroke_w is not None else (max(3, f.size // 12) if stroke else 0)
    l, t, r, b = d.textbbox((0, 0), text, font=f, stroke_width=sw)
    x = (x0 + x1) / 2 - (r - l) / 2 - l
    y = (y0 + y1) / 2 - (b - t) / 2 - t
    if shadow:
        d.text((x, y + max(2, f.size * 0.05)), text, font=f, fill=(0, 0, 0, 60),
               stroke_width=sw, stroke_fill=(0, 0, 0, 60))
    d.text((x, y), text, font=f, fill=fill, stroke_width=sw,
           stroke_fill=stroke if stroke else None)
    return img


def paper(size=(512, 512), base=(246, 240, 224), seed=1):
    """和紙風の下地。"""
    img = rgrad(size, tuple(min(255, c + 8) for c in base), tuple(max(0, c - 22) for c in base))
    return vignette(grain(img, 8, seed), 0.22)


def badge_image(label):
    """結果バッジ。tools/badge/gen_badges.py の実装をそのまま使う。"""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "badge"))
    import gen_badges
    return gen_badges.make_badge(label, gen_badges.RANK.get(label, "gold"))


def wood(size=(512, 512), base=(150, 104, 62), seed=2, vertical=False):
    """木目。年輪状の細い縞をランダムに重ねる。"""
    img = vgrad(size, tuple(min(255, c + 26) for c in base), tuple(max(0, c - 30) for c in base))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    w, h = size
    n = 26
    for i in range(n):
        p = (i + rnd.random() * 0.6) / n
        col = tuple(max(0, c - rnd.randint(16, 46)) for c in base)
        wd = rnd.randint(2, 6)
        if vertical:
            d.line([(p * w, 0), (p * w + rnd.randint(-14, 14), h)], fill=col, width=wd)
        else:
            d.line([(0, p * h), (w, p * h + rnd.randint(-14, 14))], fill=col, width=wd)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    return vignette(grain(img, 6, seed), 0.28)


def metal(size=(512, 512), base=(176, 182, 190), seed=5):
    """金属。上から下へのグラデーションに細い縦のハイライト。"""
    img = vgrad(size, tuple(min(255, c + 44) for c in base), tuple(max(0, c - 52) for c in base))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for i in range(60):
        x = rnd.randint(0, size[0])
        d.line([(x, 0), (x, size[1])], fill=tuple(min(255, c + rnd.randint(0, 26)) for c in base), width=1)
    return vignette(grain(img.filter(ImageFilter.GaussianBlur(0.8)), 4, seed), 0.3)


def stripes(size=(512, 512), a=(214, 46, 52), bcol=(240, 234, 222), pitch=104, ratio=0.5, seed=3):
    img = Image.new("RGB", size, bcol)
    d = ImageDraw.Draw(img)
    for x in range(0, size[0], pitch):
        d.rectangle([x, 0, x + int(pitch * ratio), size[1]], fill=a)
    return vignette(grain(img, 6, seed), 0.3)


def panel(size=(512, 512), top=(58, 66, 78), bottom=(28, 34, 42), text=None,
          fg=(255, 255, 255), box=None, seed=7, font=None):
    """看板・パネル。上下グラデーション＋任意の文字。"""
    img = vgrad(size, top, bottom)
    img = vignette(grain(img, 5, seed), 0.3)
    if text:
        draw_text(img, text, box or (int(size[0] * 0.1), int(size[1] * 0.3),
                                     int(size[0] * 0.9), int(size[1] * 0.7)),
                  fill=fg, path=font or FONT)
    return img
