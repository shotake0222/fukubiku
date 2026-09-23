# -*- coding: utf-8 -*-
"""作ったテンプレートを一覧画像で確認する(制作中の目視確認用)。

  python3 tools/templates/preview.py legacy dice treasure ...
  → tools/badge/out/_prev.png に「焦らし / 1等 / はずれ」を横に並べた画像を出す。
"""
import importlib, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, os.path.join(HERE, "..", "thumbs"))
sys.path.insert(0, HERE)
from PIL import Image, ImageDraw, ImageFont
import render

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"


def main():
    mod = importlib.import_module(sys.argv[1])
    cats = sys.argv[2:]
    tiers = [("suspense", None), ("1tou", "1等"), ("hazure", "はずれ")]
    cell = 260
    out = Image.new("RGB", (cell * len(tiers), (cell + 24) * len(cats)), (96, 106, 118))
    d = ImageDraw.Draw(out)
    f = ImageFont.truetype(FONT, 16)
    tmp = tempfile.mkdtemp()
    for r, cat in enumerate(cats):
        fn = mod.BUILDERS[cat]
        for c, (key, label) in enumerate(tiers):
            b, roots = fn(cat, key, label)
            path = os.path.join(tmp, "%s_%s.glb" % (cat, key))
            size = b.save(path, roots)
            im = render.render(path, cell)
            out.paste(im, (c * cell, r * (cell + 24) + 24), im)
            d.text((c * cell + 6, r * (cell + 24) + 3), "%s %s %dKB" % (cat, key, size // 1024),
                   fill=(255, 255, 255), font=f)
    dst = os.path.join(HERE, "..", "badge", "out", "_prev.png")
    out.save(dst)
    print(dst)


if __name__ == "__main__":
    main()
