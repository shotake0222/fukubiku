# -*- coding: utf-8 -*-
"""あてんど(観光・聖地巡礼)向けのデモ表示オブジェクトを生成する。
#
# 福引きと違い賞の段数は無く、1モチーフにつき.glbは1つ。
# GPSやNFCで「その場所に行くと現れる」使い方を想定しているため、
# アニメーションはすべてループ(ゆっくり漂う・揺れる)にしてある。
#
# 向きの約束は福引きと同じ: 正面が+Z、上が+Y。
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)

import glbwrite as G
import tex
from PIL import Image, ImageDraw

OUT = os.path.join(HERE, "..", "..", "public", "presets", "attend")


def deg(d):
    return d * math.pi / 180


def bob(node, amp=0.06, period=2.4, phase=0.0):
    """ゆっくり上下に漂うループ。"""
    ts = [0, period / 2, period]
    return {"node": node, "times": ts,
            "translation": [(0, phase, 0), (0, phase + amp, 0), (0, phase, 0)]}


def sway(node, ang=5.0, period=2.8):
    ts = [0, period / 4, period / 2, period * 3 / 4, period]
    vals = [ang, -ang, ang, -ang, ang]
    return {"node": node, "times": ts,
            "rotation": [G.quat_axis((0, 0, 1), deg(v)) for v in vals]}


# ============================================================
def build_torii():
    """鳥居。神社・聖地巡礼の定番ランドマーク。"""
    b = G.Builder()
    t_wood = b.add_texture(tex.to_png(tex.wood((512, 512), (196, 62, 48), seed=301, vertical=True)), "torii_wood")
    m = b.add_material("torii_mat", texture=t_wood, roughness=0.6)
    m_dark = b.add_material("torii_dark_mat", color=(0.16, 0.13, 0.12, 1), roughness=0.7)
    m_rope = b.add_material("torii_rope_mat", color=(0.90, 0.86, 0.74, 1), roughness=0.85)

    parts = [
        # 柱(下に向かって少し太い)
        G.prim(G.poly([(-0.66, -0.95), (-0.44, -0.95), (-0.48, 0.62), (-0.62, 0.62)]), m),
        G.prim(G.poly([(0.44, -0.95), (0.66, -0.95), (0.62, 0.62), (0.48, 0.62)]), m),
        # 貫(下の横木)
        G.prim(G.offset(G.plane(1.5, 0.14), dy=0.28, dz=0.01), m),
        # 島木
        G.prim(G.offset(G.plane(1.72, 0.15), dy=0.66, dz=0.02), m_dark),
        # 笠木(反りを出すため台形)
        G.prim(G.offset(G.poly([(-0.95, 0.74), (0.95, 0.74), (0.86, 0.92), (-0.86, 0.92)]), dz=0.03), m),
        # 額束
        G.prim(G.offset(G.plane(0.20, 0.26), dy=0.46, dz=0.03), m_dark),
    ]
    body = b.add_node("torii", mesh=b.add_mesh(parts, "torii"))
    rope = b.add_node("rope", mesh=b.add_mesh([
        G.prim(G.plane(1.28, 0.10), m_rope),
        G.prim(G.offset(G.poly([(-0.34, 0.05), (-0.22, 0.05), (-0.28, -0.26)]), dz=0.001), m_rope),
        G.prim(G.offset(G.poly([(0.22, 0.05), (0.34, 0.05), (0.28, -0.26)]), dz=0.001), m_rope),
    ], "rope"), t=(0, 0.16, 0.05))
    root = b.add_node("root", children=[body, rope])
    b.animate([bob(root, 0.05, 3.0), sway(rope, 4.0, 2.6)], "idle")
    return b, [root]


def build_pagoda():
    """五重塔。"""
    b = G.Builder()
    t_wall = b.add_texture(tex.to_png(tex.paper((512, 512), (238, 228, 208), seed=311)), "pagoda_wall")
    m_wall = b.add_material("pagoda_wall_mat", texture=t_wall, roughness=0.8)
    t_roof = b.add_texture(tex.to_png(tex.wood((512, 512), (74, 84, 92), seed=312)), "pagoda_roof")
    m_roof = b.add_material("pagoda_roof_mat", texture=t_roof, roughness=0.6)
    m_gold = b.add_material("pagoda_gold_mat", color=(0.86, 0.72, 0.30, 1), roughness=0.3, metallic=0.4)

    parts = []
    y = -1.05
    w = 1.75
    for i in range(5):
        parts.append(G.prim(G.offset(G.plane(w * 0.60, 0.30), dy=y + 0.15), m_wall))
        parts.append(G.prim(G.offset(
            G.poly([(-w / 2, y + 0.30), (w / 2, y + 0.30), (w * 0.34, y + 0.52), (-w * 0.34, y + 0.52)]),
            dz=0.01), m_roof))
        y += 0.54
        w *= 0.86
    # 相輪
    parts.append(G.prim(G.offset(G.plane(0.08, 0.5), dy=y + 0.24, dz=0.02), m_gold))
    for k in range(4):
        parts.append(G.prim(G.offset(G.plane(0.26 - k * 0.04, 0.04), dy=y + 0.08 + k * 0.11, dz=0.03), m_gold))
    body = b.add_node("pagoda", mesh=b.add_mesh(parts, "pagoda"))
    root = b.add_node("root", children=[body])
    b.animate([bob(root, 0.05, 3.4)], "idle")
    return b, [root]


def build_castle():
    """天守閣。"""
    b = G.Builder()
    t_stone = b.add_texture(tex.to_png(tex.metal((512, 512), (140, 140, 132), seed=321)), "castle_stone")
    m_stone = b.add_material("castle_stone_mat", texture=t_stone, roughness=0.9)
    t_wall = b.add_texture(tex.to_png(tex.paper((512, 512), (246, 242, 234), seed=322)), "castle_wall")
    m_wall = b.add_material("castle_wall_mat", texture=t_wall, roughness=0.8)
    t_roof = b.add_texture(tex.to_png(tex.wood((512, 512), (58, 74, 86), seed=323)), "castle_roof")
    m_roof = b.add_material("castle_roof_mat", texture=t_roof, roughness=0.6)
    m_gold = b.add_material("castle_gold_mat", color=(0.92, 0.78, 0.30, 1), roughness=0.28, metallic=0.5)

    parts = [G.prim(G.poly([(-1.0, -1.1), (1.0, -1.1), (0.72, -0.5), (-0.72, -0.5)]), m_stone)]
    y = -0.5
    w = 1.3
    for i in range(3):
        parts.append(G.prim(G.offset(G.plane(w, 0.34), dy=y + 0.17), m_wall))
        for c in range(3):
            parts.append(G.prim(G.offset(G.plane(0.10, 0.14), dx=-w * 0.3 + c * w * 0.3, dy=y + 0.17, dz=0.01), m_roof))
        parts.append(G.prim(G.offset(
            G.poly([(-w * 0.62, y + 0.34), (w * 0.62, y + 0.34), (w * 0.34, y + 0.54), (-w * 0.34, y + 0.54)]),
            dz=0.02), m_roof))
        y += 0.56
        w *= 0.74
    # 金の鯱
    parts.append(G.prim(G.offset(G.poly([(-0.16, y), (-0.04, y), (-0.10, y + 0.16)]), dz=0.03), m_gold))
    parts.append(G.prim(G.offset(G.poly([(0.04, y), (0.16, y), (0.10, y + 0.16)]), dz=0.03), m_gold))
    body = b.add_node("castle", mesh=b.add_mesh(parts, "castle"))
    root = b.add_node("root", children=[body])
    b.animate([bob(root, 0.045, 3.6)], "idle")
    return b, [root]


def build_signboard():
    """案内看板。観光スポットの入口に置く想定。"""
    b = G.Builder()
    board = tex.wood((512, 512), (188, 146, 96), seed=331)
    d = ImageDraw.Draw(board)
    d.rectangle([18, 18, 494, 494], outline=(128, 88, 46), width=12)
    tex.draw_text(board, "ようこそ", (54, 150, 458, 366), fill=(252, 246, 232),
                  stroke=(96, 58, 26), stroke_w=8, path=tex.FONT_SERIF)
    t_board = b.add_texture(tex.to_png(board), "sign_board")
    m_board = b.add_material("sign_board_mat", texture=t_board, roughness=0.75)
    t_post = b.add_texture(tex.to_png(tex.wood((512, 512), (126, 88, 52), seed=332, vertical=True)), "sign_post")
    m_post = b.add_material("sign_post_mat", texture=t_post, roughness=0.8)

    posts = b.add_node("posts", mesh=b.add_mesh([
        G.prim(G.offset(G.plane(0.12, 1.5), dx=-0.42, dy=-0.55), m_post),
        G.prim(G.offset(G.plane(0.12, 1.5), dx=0.42, dy=-0.55), m_post),
    ], "posts"))
    swing = b.add_node("swing", t=(0, 0.62, 0.02))
    plate = b.add_node("plate", mesh=b.add_mesh([G.prim(G.plane(1.45, 0.9), m_board)], "plate"), t=(0, -0.1, 0))
    b.nodes[swing]["children"] = [plate]
    root = b.add_node("root", children=[posts, swing])
    b.animate([sway(swing, 3.0, 3.0), bob(root, 0.04, 3.2)], "idle")
    return b, [root]


def build_stamp():
    """記念スタンプ。訪問の証としてポンと押される。"""
    b = G.Builder()
    card = tex.paper((512, 512), (250, 246, 236), seed=341)
    d = ImageDraw.Draw(card)
    d.rectangle([22, 22, 490, 490], outline=(186, 176, 152), width=6)
    for i in range(3):
        d.line([(60, 150 + i * 90), (452, 150 + i * 90)], fill=(206, 198, 178), width=4)
    t_card = b.add_texture(tex.to_png(card), "stamp_card")
    m_card = b.add_material("stamp_card_mat", texture=t_card, roughness=0.9)
    mark = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(mark)
    d.ellipse([26, 26, 486, 486], outline=(206, 40, 44), width=26)
    tex.draw_text(mark, "訪問", (110, 130, 402, 382), fill=(206, 40, 44), path=tex.FONT_SERIF, shadow=False)
    t_mark = b.add_texture(tex.to_png(mark), "stamp_mark")
    m_mark = b.add_material("stamp_mark_mat", texture=t_mark, alpha_mode="MASK", roughness=0.8)
    m_body = b.add_material("stamp_body_mat", color=(0.20, 0.20, 0.24, 1), roughness=0.5)
    m_grip = b.add_material("stamp_grip_mat", color=(0.62, 0.42, 0.24, 1), roughness=0.7)

    card_n = b.add_node("card", mesh=b.add_mesh([G.prim(G.plane(1.5, 1.5), m_card)], "card"), t=(0, 0, -0.04))
    mark_n = b.add_node("mark", mesh=b.add_mesh([G.prim(G.disc(0.42, 26), m_mark)], "mark"),
                        t=(0, -0.02, -0.02), s=(0, 0, 0))
    stamp = b.add_node("stamp", mesh=b.add_mesh([
        G.prim(G.plane(0.62, 0.24), m_body),
        G.prim(G.offset(G.plane(0.30, 0.34), dy=0.28), m_grip),
    ], "stamp"), t=(0, 0.95, 0.1))
    root = b.add_node("root", children=[card_n, mark_n, stamp])
    b.animate([
        {"node": stamp, "times": [0, 0.7, 0.95, 1.15, 2.2, 3.2],
         "translation": [(0, 0.95, 0.1), (0, 0.16, 0.1), (0, 0.16, 0.1), (0, 0.95, 0.1),
                         (0, 0.95, 0.1), (0, 0.95, 0.1)]},
        {"node": mark_n, "times": [0, 0.92, 1.05, 1.2, 3.2],
         "scale": [(0, 0, 0), (0, 0, 0), (1.12, 1.12, 1), (1, 1, 1), (1, 1, 1)]},
    ], "idle")
    return b, [root]


def build_balloon():
    """吹き出し。「ここです！」と場所を示す。"""
    b = G.Builder()
    plain = tex.rgrad((512, 512), (255, 255, 255), (222, 233, 245))
    t_plain = b.add_texture(tex.to_png(plain), "balloon_plain")
    m_plain = b.add_material("balloon_plain_mat", texture=t_plain, roughness=0.6)
    bub = tex.rgrad((512, 256), (255, 255, 255), (228, 238, 248))
    tex.draw_text(bub, "ここです！", (18, 30, 494, 226), fill=(38, 92, 158),
                  stroke=(255, 255, 255), stroke_w=7)
    t_bub = b.add_texture(tex.to_png(bub), "balloon_text")
    m_bub = b.add_material("balloon_text_mat", texture=t_bub, roughness=0.6)

    body = b.add_node("balloon", mesh=b.add_mesh([
        # 両端と尻尾は無地(同じテクスチャを貼ると文字が繰り返し出てしまう)
        G.prim(G.offset(G.disc(0.38, 26), dx=-0.66), m_plain),
        G.prim(G.offset(G.disc(0.38, 26), dx=0.66), m_plain),
        G.prim(G.offset(G.poly([(-0.20, -0.28), (0.12, -0.28), (-0.04, -0.76)]), dz=-0.001), m_plain),
        # 文字は中央の板だけに乗せる
        G.prim(G.offset(G.plane(1.34, 0.76), dz=0.002), m_bub),
    ], "balloon"))
    root = b.add_node("root", children=[body])
    b.animate([
        bob(root, 0.09, 2.2),
        {"node": body, "times": [0, 1.1, 2.2],
         "scale": [(1, 1, 1), (1.04, 1.04, 1), (1, 1, 1)]},
    ], "idle")
    return b, [root]


def build_arrow():
    """道案内の矢印。次のスポットへ誘導する。"""
    b = G.Builder()
    arrow = tex.vgrad((512, 512), (96, 200, 148), (28, 138, 104))
    t_a = b.add_texture(tex.to_png(tex.vignette(arrow, 0.3)), "arrow")
    m = b.add_material("arrow_mat", texture=t_a, roughness=0.45)
    txt = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
    tex.draw_text(txt, "この先", (30, 40, 482, 216), fill=(255, 255, 255),
                  stroke=(14, 84, 62), stroke_w=7, shadow=False)
    t_txt = b.add_texture(tex.to_png(txt), "arrow_text")
    m_txt = b.add_material("arrow_text_mat", texture=t_txt, alpha_mode="MASK", roughness=0.7)

    body = b.add_node("arrow", mesh=b.add_mesh([
        G.prim(G.poly([(-0.34, -0.62), (0.34, -0.62), (0.34, 0.18), (-0.34, 0.18)]), m),
        G.prim(G.offset(G.poly([(-0.70, 0.18), (0.70, 0.18), (0.0, 0.92)]), dz=-0.001), m),
    ], "arrow"))
    label = b.add_node("label", mesh=b.add_mesh([G.prim(G.plane(0.66, 0.33), m_txt)], "label"),
                       t=(0, -0.26, 0.02))
    root = b.add_node("root", children=[body, label])
    b.animate([bob(root, 0.14, 1.6)], "idle")
    return b, [root]


def build_chochin():
    """提灯。祭り・門前町の雰囲気づくりに。"""
    b = G.Builder()
    paper = tex.vgrad((512, 512), (255, 236, 186), (240, 198, 120))
    d = ImageDraw.Draw(paper)
    for x in range(0, 512, 64):
        d.line([(x, 0), (x, 512)], fill=(226, 182, 108), width=3)
    tex.draw_text(paper, "祭", (150, 140, 362, 372), fill=(184, 34, 34),
                  stroke=(255, 244, 220), stroke_w=6, path=tex.FONT_SERIF)
    t_paper = b.add_texture(tex.to_png(paper), "chochin_paper")
    m_paper = b.add_material("chochin_paper_mat", texture=t_paper, roughness=0.75,
                             emissive=(0.28, 0.20, 0.06))
    m_cap = b.add_material("chochin_cap_mat", color=(0.14, 0.12, 0.11, 1), roughness=0.6)

    swing = b.add_node("swing", t=(0, 0.95, 0))
    body = b.add_node("chochin", mesh=b.add_mesh([
        G.prim(G.offset(G.plane(0.86, 1.15), dy=-0.66), m_paper),
        G.prim(G.offset(G.plane(0.44, 0.10), dy=-0.05), m_cap),
        G.prim(G.offset(G.plane(0.44, 0.10), dy=-1.28), m_cap),
        G.prim(G.offset(G.plane(0.05, 0.22), dy=0.08), m_cap),
    ], "chochin"))
    b.nodes[swing]["children"] = [body]
    root = b.add_node("root", children=[swing])
    b.animate([sway(swing, 7.0, 2.6)], "idle")
    return b, [root]


BUILDERS = {
    "torii": build_torii,
    "pagoda": build_pagoda,
    "castle": build_castle,
    "signboard": build_signboard,
    "stamp": build_stamp,
    "balloon": build_balloon,
    "arrow": build_arrow,
    "chochin": build_chochin,
}


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    for name, fn in BUILDERS.items():
        if only and name not in only:
            continue
        b, roots = fn()
        path = os.path.join(OUT, "%s_3d.glb" % name)
        size = b.save(path, roots)
        print("%-11s %6d bytes" % (name, size))


if __name__ == "__main__":
    main(sys.argv[1:] or None)
