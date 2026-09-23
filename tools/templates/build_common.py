# -*- coding: utf-8 -*-
"""全カテゴリ共通の「またね」オブジェクトを作る。
#
# クールダウン中(=すでに抽選済み)に出す表示は、以前はカテゴリごとに
# <カテゴリ>_cookie_3d.glb が用意されていて、カテゴリを変えると
# 見た目も変わっていた。抽選結果ではなく「今日はもう引けません」という
# お知らせなので、全モデルで同じ見た目にする。
#
# 出力: public/presets/common/common_cookie_3d.glb
#
# 使い方: python3 tools/templates/build_common.py
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)
import glbwrite as G          # noqa: E402
import tex                    # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "presets", "common")


def build():
    b = G.Builder()

    # 「またね」の文字＋光。バッジと同じ作り方なので見た目が揃う。
    t = b.add_texture(tex.badge_png("またね"), "badge_またね")
    m = b.add_material("badge_またね", texture=t, alpha_mode="BLEND", roughness=0.9,
                       emissive=(0.55, 0.55, 0.55), emissive_texture=True)
    mesh = b.add_mesh([G.prim(G.plane(1.0, 1.0), m)], "badge")

    # 装飾のオブジェクトは置かない。文字と、その周りの光だけ。
    badge_node = b.add_node("badge", mesh=mesh, t=(0, 0, 0), s=(0, 0, 0))
    root = b.add_node("root", children=[badge_node])

    # 0.45秒で少し跳ねながら現れ、そのあとはゆっくり呼吸する。
    b.animate([
        {"node": badge_node, "times": [0.0, 0.28, 0.45, 1.6, 3.0],
         "scale": [(0, 0, 0), (1.14, 1.14, 1.14), (1, 1, 1), (1.04, 1.04, 1.04), (1, 1, 1)]},
    ], name="reveal")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "common_cookie_3d.glb")
    b.save(path, [root])
    print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    build()
