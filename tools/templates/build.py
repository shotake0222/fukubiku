# -*- coding: utf-8 -*-
"""福引きテンプレート(.glb)の生成。
#
# 1テンプレートにつき次のファイルを作る:
#   <cat>_1tou..6tou_3d.glb      6段階の賞
#   <cat>_ohatari/atari/hazure/coupon_3d.glb   4段階の賞
#   <cat>_cookie_3d.glb          クールダウン中の「またね」
#   <cat>_suspense_3d.glb        結果が出るまでの焦らし(ループ再生)
#
# 向きの約束: 正面が+Z、上が+Y。ポスターと同じ向きで作る。
#   マーカー表示ではビューア側が-90 0 0を掛けて立ち上げ、
#   画像認識ではそのまま(0 0 0)正面を向く。
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)

import glbwrite as G
import tex
from PIL import Image, ImageDraw, ImageFilter

OUT_ROOT = os.path.join(HERE, "..", "..", "public", "presets")

TIERS = [
    ("1tou", "1等"), ("2tou", "2等"), ("3tou", "3等"),
    ("4tou", "4等"), ("5tou", "5等"), ("6tou", "6等"),
    ("ohatari", "大当たり"), ("atari", "当たり"),
    ("hazure", "はずれ"), ("coupon", "クーポン"),
    ("cookie", "参加賞"),
]


def deg(d):
    return d * math.pi / 180


def ease(t):
    """行き過ぎてから戻る、少し弾む補間用の時間列を作るための平滑化。"""
    return t * t * (3 - 2 * t)


def add_badge(b, label, size=0.66):
    """結果バッジの板。labelがNoneなら作らない(焦らし用)。"""
    if not label:
        return None, None
    t = b.add_texture(tex.to_png(tex.badge_image(label), 128), "badge_%s" % label)
    m = b.add_material("badge_%s" % label, texture=t, alpha_mode="MASK", roughness=0.55)
    mesh = b.add_mesh([G.prim(G.plane(size, size), m)], "badge")
    return mesh, m


# ============================================================
# 三角くじ
# ============================================================
def tex_sankaku_cover():
    """折りくじの表。紅白の縦縞に「くじ」の白帯。"""
    img = tex.vgrad((512, 512), (216, 46, 52), (146, 16, 22))
    d = ImageDraw.Draw(img)
    for i in range(0, 512, 104):
        d.rectangle([i, 0, i + 52, 512], fill=(240, 234, 222))
    img = tex.vignette(tex.grain(img, 6, 3), 0.32)
    band = tex.grain(Image.new("RGB", (512, 150), (251, 247, 240)), 5, 9)
    img.paste(band, (0, 300))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 300, 512, 303], fill=(198, 158, 62))
    d.rectangle([0, 447, 512, 450], fill=(198, 158, 62))
    tex.draw_text(img, "く じ", (48, 312, 464, 440), fill=(178, 26, 32),
                  stroke=(255, 255, 255), stroke_w=5, path=tex.FONT_SERIF)
    return img


def tex_sankaku_inside():
    """開いたときの内側。和紙に金の枠と薄い「福」。"""
    img = tex.paper((512, 512), (251, 246, 233), seed=4)
    d = ImageDraw.Draw(img)
    for i, (col, w) in enumerate([((198, 158, 62), 7), ((238, 214, 148), 3)]):
        pd = 22 + i * 11
        d.rectangle([pd, pd, 512 - pd, 512 - pd], outline=col, width=w)
    wm = Image.new("RGB", (512, 512), (251, 246, 233))
    tex.draw_text(wm, "福", (110, 110, 402, 402), fill=(214, 200, 170),
                  path=tex.FONT_SERIF, shadow=False)
    return Image.blend(img, wm, 0.35)


def tex_washi_frame(seed=11):
    """開いたフタの裏。上下反転しても違和感が出ないよう文字は入れない。"""
    img = tex.paper((512, 512), (249, 244, 231), seed=seed)
    d = ImageDraw.Draw(img)
    d.rectangle([26, 26, 486, 486], outline=(198, 158, 62), width=6)
    d.rectangle([40, 40, 472, 472], outline=(232, 208, 146), width=2)
    return img


def build_sankaku(cat, key, label):
    """三角くじ。折られた三角のフタが下辺を軸に開き、中の結果が現れる。"""
    b = G.Builder()
    t_cover = b.add_texture(tex.to_png(tex_sankaku_cover()), "kuji_cover")
    t_inside = b.add_texture(tex.to_png(tex_sankaku_inside()), "kuji_inside")
    t_back = b.add_texture(tex.to_png(tex_washi_frame()), "kuji_back")
    m_cover = b.add_material("kuji_cover_mat", texture=t_cover, roughness=0.62)
    m_inside = b.add_material("kuji_inside_mat", texture=t_inside, roughness=0.7)
    m_back = b.add_material("kuji_back_mat", texture=t_back, roughness=0.7)

    W, H = 1.5, 1.15

    # 開いたときに見える台紙(三角形)。底辺をy=-H/2に置く
    base_geo = G.tri(W, H, base_y=-H / 2)
    base_mesh = b.add_mesh([
        G.prim(base_geo, m_inside),
        G.prim(G.back(G.offset(base_geo, dz=-0.008)), m_back),
    ], "kuji_base")
    base = b.add_node("base", mesh=base_mesh)

    # フタ。底辺(y=-H/2)を軸に手前へ倒れて開く
    flap_geo = G.tri(W, H, base_y=0.0)
    flap_mesh = b.add_mesh([
        G.prim(flap_geo, m_cover),
        G.prim(G.back(G.offset(flap_geo, dz=-0.01)), m_back),
    ], "kuji_flap")
    hinge = b.add_node("hinge", t=(0, -H / 2, 0.014))
    flap = b.add_node("flap", mesh=flap_mesh)
    b.nodes[hinge]["children"] = [flap]

    children = [base, hinge]
    tracks = []
    badge_mesh, _ = add_badge(b, label, 0.72)
    if badge_mesh is not None:
        badge = b.add_node("badge", mesh=badge_mesh, t=(0, -0.16, 0.05), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        # フタが開く(0.2〜0.95秒) → バッジが飛び出す
        tracks.append({"node": hinge, "times": [0.0, 0.2, 0.95, 1.1],
                       "rotation": [G.quat_axis((1, 0, 0), deg(-a)) for a in (0, 0, 168, 162)]})
        tracks.append({"node": badge, "times": [0.0, 0.9, 1.12, 1.32, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": root, "times": [0.0, 0.95, 1.15, 1.35, 2.0],
                       "translation": [(0, 0, 0), (0, 0, 0), (0, 0.07, 0), (0, 0, 0), (0, 0, 0)]})
    else:
        # 焦らし: 閉じたままゆらゆら(ループ)
        tracks.append({"node": root, "times": [0.0, 0.7, 1.4, 2.1, 2.8],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (-6, 6, -6, 6, -6)]})
        tracks.append({"node": root, "times": [0.0, 0.7, 1.4, 2.1, 2.8],
                       "translation": [(0, 0, 0), (0, 0.06, 0), (0, 0, 0), (0, 0.06, 0), (0, 0, 0)]})

    b.animate(tracks, "reveal")
    return b, [root]



# ============================================================
# 鏡開き — 菰樽のフタが左右に割れて中から結果
# ============================================================
def build_kagamibiraki(cat, key, label):
    b = G.Builder()
    lid = tex.paper((512, 512), (247, 241, 224), seed=21)
    d = ImageDraw.Draw(lid)
    d.ellipse([16, 16, 496, 496], outline=(186, 148, 60), width=14)
    d.ellipse([54, 54, 458, 458], outline=(214, 44, 48), width=8)
    tex.draw_text(lid, "祝", (150, 150, 362, 362), fill=(190, 30, 36),
                  stroke=(255, 255, 255), stroke_w=7, path=tex.FONT_SERIF)
    t_lid = b.add_texture(tex.to_png(lid), "taru_lid")
    m_lid = b.add_material("taru_lid_mat", texture=t_lid, roughness=0.7)
    t_body = b.add_texture(tex.to_png(tex.wood((512, 512), (128, 86, 50), seed=22)), "taru_body")
    m_body = b.add_material("taru_body_mat", texture=t_body, roughness=0.75)
    m_dark = b.add_material("taru_inner_mat", color=(0.10, 0.07, 0.05, 1), roughness=0.9)
    m_gold = b.add_material("taru_hoop_mat", color=(0.78, 0.62, 0.26, 1), roughness=0.35, metallic=0.25)

    R = 0.72
    body = b.add_node("body", mesh=b.add_mesh([G.prim(G.disc(R * 1.06, 40), m_body)], "body"), t=(0, 0, -0.05))
    inner = b.add_node("inner", mesh=b.add_mesh([G.prim(G.disc(R * 0.94, 36), m_dark)], "inner"), t=(0, 0, -0.03))
    hoop = b.add_node("hoop", mesh=b.add_mesh([G.prim(G.ring(R * 1.06, R * 0.97, 40), m_gold)], "hoop"), t=(0, 0, -0.02))

    halfR = b.add_mesh([G.prim(G.semicircle(R, 22, 1), m_lid)], "lidR")
    halfL = b.add_mesh([G.prim(G.semicircle(R, 22, -1), m_lid)], "lidL")
    hingeR = b.add_node("hingeR", t=(R, 0, 0.02))
    nR = b.add_node("lidR", mesh=halfR, t=(-R, 0, 0))
    b.nodes[hingeR]["children"] = [nR]
    hingeL = b.add_node("hingeL", t=(-R, 0, 0.02))
    nL = b.add_node("lidL", mesh=halfL, t=(R, 0, 0))
    b.nodes[hingeL]["children"] = [nL]

    children = [body, inner, hoop, hingeR, hingeL]
    tracks = []
    bm, _ = add_badge(b, label, 0.98)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0, 0.14), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        # フタが観音開きに割れて、中から結果が出る
        tracks.append({"node": hingeR, "times": [0, 0.25, 0.9],
                       "rotation": [G.quat_axis((0, 1, 0), deg(a)) for a in (0, 0, -128)]})
        tracks.append({"node": hingeL, "times": [0, 0.25, 0.9],
                       "rotation": [G.quat_axis((0, 1, 0), deg(a)) for a in (0, 0, 128)]})
        tracks.append({"node": badge, "times": [0, 0.72, 0.98, 1.18, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": root, "times": [0, 0.2, 0.28, 0.36, 2.0],
                       "translation": [(0, 0, 0), (0, 0, 0), (0, -0.05, 0), (0, 0, 0), (0, 0, 0)]})
    else:
        tracks.append({"node": root, "times": [0, 0.5, 1.0, 1.5, 2.0],
                       "scale": [(1, 1, 1), (1.04, 0.97, 1), (1, 1, 1), (1.04, 0.97, 1), (1, 1, 1)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# クリスマス — リボンがほどけてフタが開く
# ============================================================
def build_xmas(cat, key, label):
    b = G.Builder()
    wrap = tex.vgrad((512, 512), (28, 108, 66), (14, 68, 42))
    d = ImageDraw.Draw(wrap)
    for x in range(-512, 512, 148):
        for y in range(0, 512, 148):
            d.polygon([(x + 74, y + 34), (x + 104, y + 96), (x + 44, y + 96)], fill=(232, 238, 232))
    d.rectangle([0, 0, 511, 511], outline=(232, 214, 150), width=16)
    wrap = tex.vignette(tex.grain(wrap, 6, 31), 0.32)
    t_wrap = b.add_texture(tex.to_png(wrap), "xmas_wrap")
    m_wrap = b.add_material("xmas_wrap_mat", texture=t_wrap, roughness=0.6)
    m_lid = b.add_material("xmas_lid_mat", color=(0.13, 0.42, 0.26, 1), roughness=0.6)
    m_rib = b.add_material("xmas_ribbon_mat", color=(0.86, 0.18, 0.22, 1), roughness=0.45)
    m_in = b.add_material("xmas_inner_mat", color=(0.08, 0.06, 0.05, 1), roughness=0.9)

    W, H = 1.28, 1.0
    box_mesh = b.add_mesh([G.prim(G.plane(W, H), m_wrap)], "boxfront")
    boxn = b.add_node("box", mesh=box_mesh)
    inner = b.add_node("inner", mesh=b.add_mesh([G.prim(G.plane(W * 0.92, H * 0.9), m_in)], "inner"), t=(0, 0, -0.02))
    rib_mesh = b.add_mesh([
        G.prim(G.plane(0.14, H * 1.02), m_rib),
        G.prim(G.offset(G.plane(W * 1.02, 0.14), dz=0.001), m_rib),
    ], "ribbon")
    rib = b.add_node("ribbon", mesh=rib_mesh, t=(0, 0, 0.03))
    bow = b.add_node("bow", mesh=b.add_mesh([G.prim(G.ring(0.17, 0.07, 24), m_rib)], "bow"), t=(0, 0.06, 0.05))

    lid_h = 0.26
    lid_mesh = b.add_mesh([G.prim(G.plane(W * 1.06, lid_h), m_lid)], "lid")
    lid_hinge = b.add_node("lid_hinge", t=(0, H / 2 - lid_h / 2, 0.04))
    lid = b.add_node("lid", mesh=lid_mesh)
    b.nodes[lid_hinge]["children"] = [lid]

    children = [inner, boxn, rib, bow, lid_hinge]
    tracks = []
    bm, _ = add_badge(b, label, 0.74)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.02, 0.07), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": bow, "times": [0, 0.2, 0.5], "scale": [(1, 1, 1), (1.2, 1.2, 1), (0, 0, 0)]})
        tracks.append({"node": rib, "times": [0, 0.3, 0.6], "scale": [(1, 1, 1), (1, 1, 1), (0, 0, 0)]})
        tracks.append({"node": lid_hinge, "times": [0, 0.45, 1.0],
                       "rotation": [G.quat_axis((1, 0, 0), deg(a)) for a in (0, 0, 118)]})
        tracks.append({"node": badge, "times": [0, 0.85, 1.08, 1.28, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": root, "times": [0, 0.55, 1.1, 1.65, 2.2],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (-4, 4, -4, 4, -4)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 絵馬 — 吊るされた絵馬が揺れ、くるりと裏返って結果
# ============================================================
def build_ema(cat, key, label):
    b = G.Builder()
    face = tex.wood((512, 512), (198, 156, 104), seed=41)
    d = ImageDraw.Draw(face)
    d.rectangle([22, 22, 490, 490], outline=(140, 96, 52), width=10)
    tex.draw_text(face, "絵馬", (110, 150, 402, 372), fill=(96, 58, 26),
                  stroke=(246, 236, 214), stroke_w=5, path=tex.FONT_SERIF)
    t_face = b.add_texture(tex.to_png(face), "ema_face")
    m_face = b.add_material("ema_face_mat", texture=t_face, roughness=0.72)
    t_back = b.add_texture(tex.to_png(tex.wood((512, 512), (206, 166, 116), seed=42)), "ema_back")
    m_back = b.add_material("ema_back_mat", texture=t_back, roughness=0.72)
    m_cord = b.add_material("ema_cord_mat", color=(0.78, 0.16, 0.18, 1), roughness=0.6)

    W, H = 1.2, 1.0
    pts = [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H * 0.18), (0, H / 2), (-W / 2, H * 0.18)]
    geo = G.poly(pts)
    plate = b.add_mesh([G.prim(geo, m_face), G.prim(G.back(G.offset(geo, dz=-0.03)), m_back)], "ema")

    swing = b.add_node("swing", t=(0, H * 0.62, 0))
    cord = b.add_node("cord", mesh=b.add_mesh([G.prim(G.plane(0.05, 0.34), m_cord)], "cord"), t=(0, -0.17, -0.01))
    spin = b.add_node("spin", t=(0, -H * 0.62, 0))
    plate_n = b.add_node("plate", mesh=plate)
    children_spin = [plate_n]
    tracks = []
    bm, _ = add_badge(b, label, 0.7)
    if bm is not None:
        # 裏面に結果。板が180度回ると正面に来る
        badge = b.add_node("badge", mesh=bm, t=(0, 0, -0.05),
                           r=G.quat_axis((0, 1, 0), math.pi), s=(0, 0, 0))
        children_spin.append(badge)
    b.nodes[spin]["children"] = children_spin
    b.nodes[swing]["children"] = [cord, spin]
    root = b.add_node("root", children=[swing])

    if label:
        tracks.append({"node": swing, "times": [0, 0.3, 0.6, 0.85],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, -9, 9, 0)]})
        tracks.append({"node": spin, "times": [0.85, 1.45, 1.6],
                       "rotation": [G.quat_axis((0, 1, 0), deg(a)) for a in (0, 190, 180)]})
        tracks.append({"node": badge, "times": [0, 1.5, 1.7, 1.9, 2.2],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.18, 1.18, 1.18), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": swing, "times": [0, 0.7, 1.4, 2.1, 2.8],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (-8, 8, -8, 8, -8)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 自動販売機 — ボタンが光り、取り出し口から結果が落ちてくる
# ============================================================
def build_vending(cat, key, label):
    b = G.Builder()
    body = tex.panel((512, 512), (206, 34, 40), (150, 16, 22))
    d = ImageDraw.Draw(body)
    for r in range(3):
        y = 60 + r * 96
        d.rectangle([44, y, 468, y + 66], fill=(238, 240, 244))
        d.rectangle([44, y + 66, 468, y + 76], fill=(120, 126, 134))
        for c in range(4):
            x = 60 + c * 104
            d.rounded_rectangle([x, y + 8, x + 76, y + 58], 10, fill=(64, 132, 196))
    d.rectangle([44, 356, 468, 470], fill=(46, 50, 58))
    body = tex.vignette(tex.grain(body, 5, 51), 0.3)
    t_body = b.add_texture(tex.to_png(body), "vending_body")
    m_body = b.add_material("vending_body_mat", texture=t_body, roughness=0.55)
    m_btn = b.add_material("vending_btn_mat", color=(1.0, 0.83, 0.25, 1), roughness=0.35,
                           emissive=(0.35, 0.26, 0.0))
    m_slot = b.add_material("vending_slot_mat", color=(0.07, 0.07, 0.09, 1), roughness=0.9)

    W, H = 1.1, 1.5
    front = b.add_node("front", mesh=b.add_mesh([G.prim(G.plane(W, H), m_body)], "front"))
    slot = b.add_node("slot", mesh=b.add_mesh([G.prim(G.plane(W * 0.78, 0.3), m_slot)], "slot"),
                      t=(0, -H * 0.30, 0.01))
    btn = b.add_node("button", mesh=b.add_mesh([G.prim(G.disc(0.075, 20), m_btn)], "button"),
                     t=(W * 0.30, H * 0.05, 0.02))
    flap_mesh = b.add_mesh([G.prim(G.plane(W * 0.78, 0.3), m_body)], "flap")
    flap_h = b.add_node("flap_hinge", t=(0, -H * 0.30 + 0.15, 0.03))
    flap = b.add_node("flap", mesh=flap_mesh, t=(0, -0.15, 0))
    b.nodes[flap_h]["children"] = [flap]

    children = [front, slot, btn, flap_h]
    tracks = []
    bm, _ = add_badge(b, label, 0.6)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.25, 0.06), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": btn, "times": [0, 0.15, 0.3, 0.45],
                       "scale": [(1, 1, 1), (1.35, 1.35, 1), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": flap_h, "times": [0, 0.45, 0.8],
                       "rotation": [G.quat_axis((1, 0, 0), deg(a)) for a in (0, 0, -95)]})
        # 商品が落ちてきて取り出し口の前で弾む
        tracks.append({"node": badge, "times": [0, 0.55, 0.75, 0.95, 1.15, 2.0],
                       "scale": [(0, 0, 0), (0.9, 0.9, 0.9), (1, 1, 1), (1.12, 1.12, 1.12), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": badge, "times": [0, 0.55, 0.9, 1.05, 1.2, 2.0],
                       "translation": [(0, 0.25, 0.06), (0, 0.25, 0.06), (0, -0.30, 0.12),
                                       (0, -0.22, 0.12), (0, -0.28, 0.12), (0, -0.28, 0.12)]})
    else:
        tracks.append({"node": btn, "times": [0, 0.4, 0.8, 1.2, 1.6],
                       "scale": [(1, 1, 1), (1.3, 1.3, 1), (1, 1, 1), (1.3, 1.3, 1), (1, 1, 1)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# レシート — レジから紙が印字されて出てくる
# ============================================================
def build_receipt(cat, key, label):
    b = G.Builder()
    reg = tex.panel((512, 512), (238, 240, 244), (186, 192, 200))
    d = ImageDraw.Draw(reg)
    d.rounded_rectangle([48, 60, 464, 250], 18, fill=(44, 52, 64))
    for r in range(3):
        d.rectangle([80, 92 + r * 46, 432, 118 + r * 46], fill=(96, 210, 168))
    d.rectangle([40, 300, 472, 330], fill=(120, 128, 138))
    reg = tex.vignette(tex.grain(reg, 4, 61), 0.28)
    t_reg = b.add_texture(tex.to_png(reg), "register")
    m_reg = b.add_material("register_mat", texture=t_reg, roughness=0.5)

    paper = tex.paper((512, 512), (252, 250, 245), seed=62)
    d = ImageDraw.Draw(paper)
    for r in range(9):
        y = 40 + r * 48
        d.rectangle([70, y, 442 - (r % 3) * 60, y + 12], fill=(196, 196, 196))
    t_paper = b.add_texture(tex.to_png(paper), "receipt_paper")
    m_paper = b.add_material("receipt_paper_mat", texture=t_paper, roughness=0.85)

    W = 1.15
    reg_n = b.add_node("register", mesh=b.add_mesh([G.prim(G.plane(W * 1.35, 1.0), m_reg)], "register"),
                       t=(0, 0.55, 0))
    PH = 1.0
    paper_mesh = b.add_mesh([G.prim(G.plane(W * 0.62, PH), m_paper)], "paper")
    paper_grow = b.add_node("paper_grow", t=(0, 0.06, -0.01))
    paper_n = b.add_node("paper", mesh=paper_mesh, t=(0, -PH / 2, 0))
    b.nodes[paper_grow]["children"] = [paper_n]

    children = [paper_grow, reg_n]
    tracks = []
    bm, _ = add_badge(b, label, 0.58)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, -0.5, 0.05), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": paper_grow, "times": [0, 0.15, 1.0],
                       "scale": [(1, 0.02, 1), (1, 0.02, 1), (1, 1, 1)]})
        tracks.append({"node": badge, "times": [0, 0.95, 1.18, 1.38, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.18, 1.18, 1.18), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": paper_grow, "times": [0, 0.9, 1.8, 2.7],
                       "scale": [(1, 0.02, 1), (1, 0.22, 1), (1, 0.02, 1), (1, 0.22, 1)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 輪投げ — 輪が飛んできて棒に入る
# ============================================================
def build_ring(cat, key, label):
    b = G.Builder()
    m_wood = b.add_material("wanage_base_mat",
                            texture=b.add_texture(tex.to_png(tex.wood((512, 512), (172, 122, 70), seed=71)), "wanage_wood"),
                            roughness=0.72)
    m_pole = b.add_material("wanage_pole_mat", color=(0.85, 0.28, 0.24, 1), roughness=0.5)
    m_ring = b.add_material("wanage_ring_mat", color=(0.96, 0.76, 0.22, 1), roughness=0.4, metallic=0.15)

    base = b.add_node("base", mesh=b.add_mesh([G.prim(G.plane(1.5, 0.28), m_wood)], "base"), t=(0, -0.78, -0.02))
    pole = b.add_node("pole", mesh=b.add_mesh([G.prim(G.plane(0.13, 1.5), m_pole)], "pole"), t=(0, -0.02, 0))
    ring_mesh = b.add_mesh([G.prim(G.ring(0.44, 0.31, 32), m_ring)], "ring")
    ring_n = b.add_node("ring", mesh=ring_mesh, t=(-1.0, 1.05, 0.1))

    children = [base, pole, ring_n]
    tracks = []
    bm, _ = add_badge(b, label, 0.86)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.42, 0.14), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": ring_n, "times": [0, 0.15, 0.55, 0.75, 0.9],
                       "translation": [(-1.0, 1.05, 0.1), (-1.0, 1.05, 0.1), (-0.15, 0.55, 0.1),
                                       (0, -0.45, 0.1), (0, -0.60, 0.1)]})
        tracks.append({"node": ring_n, "times": [0, 0.55, 0.9],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, -220, -360)]})
        tracks.append({"node": ring_n, "times": [0, 0.55, 0.9],
                       "scale": [(1, 1, 1), (1, 0.72, 1), (1, 0.40, 1)]})
        tracks.append({"node": badge, "times": [0, 0.9, 1.12, 1.32, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": ring_n, "times": [0, 0.8, 1.6, 2.4],
                       "translation": [(-1.0, 1.0, 0.1), (-1.0, 1.12, 0.1), (-1.0, 1.0, 0.1), (-1.0, 1.12, 0.1)]})
        tracks.append({"node": ring_n, "times": [0, 1.2, 2.4],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, 180, 360)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 金庫 — ダイヤルが回り、扉が開いて結果
# ============================================================
def build_safe(cat, key, label):
    b = G.Builder()
    t_metal = b.add_texture(tex.to_png(tex.metal((512, 512), (120, 128, 138), seed=81)), "safe_metal")
    m_metal = b.add_material("safe_metal_mat", texture=t_metal, roughness=0.42, metallic=0.35)
    m_in = b.add_material("safe_inner_mat", color=(0.06, 0.06, 0.07, 1), roughness=0.95)
    dial = tex.metal((512, 512), (206, 212, 220), seed=82)
    d = ImageDraw.Draw(dial)
    d.ellipse([28, 28, 484, 484], outline=(72, 78, 86), width=14)
    for i in range(24):
        a = 2 * math.pi * i / 24
        d.line([(256 + 176 * math.cos(a), 256 + 176 * math.sin(a)),
                (256 + 208 * math.cos(a), 256 + 208 * math.sin(a))], fill=(60, 66, 74), width=7)
    d.polygon([(256, 60), (232, 128), (280, 128)], fill=(206, 42, 46))
    t_dial = b.add_texture(tex.to_png(dial), "safe_dial")
    m_dial = b.add_material("safe_dial_mat", texture=t_dial, roughness=0.35, metallic=0.3)

    W, H = 1.22, 1.22
    inner = b.add_node("inner", mesh=b.add_mesh([G.prim(G.plane(W * 0.9, H * 0.9), m_in)], "inner"), t=(0, 0, -0.03))
    frame = b.add_node("frame", mesh=b.add_mesh([G.prim(G.plane(W * 1.12, H * 1.12), m_metal)], "frame"), t=(0, 0, -0.05))
    door_mesh = b.add_mesh([G.prim(G.plane(W, H), m_metal)], "door")
    hinge = b.add_node("door_hinge", t=(-W / 2, 0, 0.02))
    door = b.add_node("door", mesh=door_mesh, t=(W / 2, 0, 0))
    dial_n = b.add_node("dial", mesh=b.add_mesh([G.prim(G.disc(0.26, 28), m_dial)], "dial"), t=(0.22, 0, 0.02))
    b.nodes[door]["children"] = [dial_n]
    b.nodes[hinge]["children"] = [door]

    children = [inner, frame, hinge]
    tracks = []
    bm, _ = add_badge(b, label, 0.92)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0, 0.06), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": dial_n, "times": [0, 0.25, 0.5, 0.7],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, -260, 140, 0)]})
        tracks.append({"node": hinge, "times": [0, 0.7, 1.15],
                       "rotation": [G.quat_axis((0, 1, 0), deg(a)) for a in (0, 0, 104)]})
        tracks.append({"node": badge, "times": [0, 1.0, 1.22, 1.42, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": dial_n, "times": [0, 0.9, 1.8, 2.7],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, -150, 60, 0)]})
    b.animate(tracks, "reveal")
    return b, [root]



# ============================================================
# 福袋 — 袋の口が開いて中から結果が飛び出す
# ============================================================
def build_fukubukuro(cat, key, label):
    b = G.Builder()
    cloth = tex.vgrad((512, 512), (214, 50, 54), (146, 18, 26))
    d = ImageDraw.Draw(cloth)
    for y in range(0, 512, 118):
        d.rectangle([0, y, 512, y + 5], fill=(236, 206, 130))
    cloth = tex.vignette(tex.grain(cloth, 7, 91), 0.34)
    tex.draw_text(cloth, "福袋", (96, 176, 416, 344), fill=(250, 240, 214),
                  stroke=(120, 14, 20), stroke_w=8, path=tex.FONT_SERIF)
    t_cloth = b.add_texture(tex.to_png(cloth), "fukubukuro_cloth")
    m_cloth = b.add_material("fukubukuro_cloth_mat", texture=t_cloth, roughness=0.78)
    m_in = b.add_material("fukubukuro_inner_mat", color=(0.11, 0.03, 0.05, 1), roughness=0.95)
    m_cord = b.add_material("fukubukuro_cord_mat", color=(0.92, 0.78, 0.32, 1), roughness=0.4)

    # 袋本体(下が広い台形。凸形なので扇状に三角形分割できる)
    body = G.poly([(-0.62, -0.72), (0.62, -0.72), (0.44, 0.42), (-0.44, 0.42)])
    body_n = b.add_node("bag", mesh=b.add_mesh([G.prim(body, m_cloth)], "bag"))
    inner = b.add_node("inner", mesh=b.add_mesh([
        G.prim(G.poly([(-0.40, -0.60), (0.40, -0.60), (0.30, 0.44), (-0.30, 0.44)]), m_in)], "inner"),
        t=(0, 0, -0.02))
    # 口の左右のヒダ。外へ開く
    mouth = G.poly([(-0.44, 0.0), (0.0, 0.0), (0.0, 0.34), (-0.44, 0.34)])
    mL = b.add_node("mouthL_h", t=(-0.44, 0.42, 0.02))
    mLn = b.add_node("mouthL", mesh=b.add_mesh([G.prim(G.offset(mouth, dx=0.44, dy=-0.42), m_cloth)], "mouthL"),
                     t=(0, 0, 0))
    b.nodes[mL]["children"] = [mLn]
    mR = b.add_node("mouthR_h", t=(0.44, 0.42, 0.02))
    mRn = b.add_node("mouthR", mesh=b.add_mesh([G.prim(G.offset(mouth, dx=0.0, dy=-0.42), m_cloth)], "mouthR"),
                     t=(0, 0, 0))
    b.nodes[mR]["children"] = [mRn]
    cord = b.add_node("cord", mesh=b.add_mesh([G.prim(G.plane(0.98, 0.09), m_cord)], "cord"), t=(0, 0.40, 0.04))

    children = [inner, body_n, mL, mR, cord]
    tracks = []
    bm, _ = add_badge(b, label, 0.86)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, -0.1, 0.1), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": cord, "times": [0, 0.2, 0.4], "scale": [(1, 1, 1), (1, 1, 1), (0, 0, 0)]})
        tracks.append({"node": mL, "times": [0, 0.35, 0.85],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, 0, 62)]})
        tracks.append({"node": mR, "times": [0, 0.35, 0.85],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (0, 0, -62)]})
        tracks.append({"node": badge, "times": [0, 0.6, 0.95, 1.15, 2.0],
                       "scale": [(0, 0, 0), (0.2, 0.2, 0.2), (1.18, 1.18, 1.18), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": badge, "times": [0, 0.6, 1.0, 2.0],
                       "translation": [(0, -0.1, 0.1), (0, -0.1, 0.1), (0, 0.5, 0.14), (0, 0.5, 0.14)]})
    else:
        tracks.append({"node": root, "times": [0, 0.55, 1.1, 1.65, 2.2],
                       "scale": [(1, 1, 1), (1.05, 0.96, 1), (1, 1, 1), (1.05, 0.96, 1), (1, 1, 1)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 桜 — 花びらが舞い散って結果が現れる
# ============================================================
def build_sakura(cat, key, label):
    b = G.Builder()
    petal = Image.new("RGB", (256, 256), (250, 214, 226))
    dd = ImageDraw.Draw(petal)
    dd.ellipse([16, 10, 240, 246], fill=(250, 196, 214))
    dd.ellipse([56, 40, 200, 210], fill=(253, 226, 236))
    petal = tex.grain(petal, 4, 101)
    t_petal = b.add_texture(tex.to_png(petal, 64), "sakura_petal")
    m_petal = b.add_material("sakura_petal_mat", texture=t_petal, roughness=0.7)
    m_branch = b.add_material("sakura_branch_mat", color=(0.36, 0.24, 0.17, 1), roughness=0.85)
    t_sky = b.add_texture(tex.to_png(tex.vgrad((512, 512), (238, 246, 252), (250, 232, 240))), "sakura_sky")
    m_sky = b.add_material("sakura_sky_mat", texture=t_sky, roughness=0.95)

    sky = b.add_node("sky", mesh=b.add_mesh([G.prim(G.disc(0.95, 32), m_sky)], "sky"), t=(0, 0.05, -0.14))
    branch = b.add_node("branch", mesh=b.add_mesh([
        G.prim(G.poly([(-1.0, 0.60), (1.0, 0.44), (1.0, 0.62), (-1.0, 0.80)]), m_branch),
        G.prim(G.offset(G.poly([(-0.55, 0.28), (-0.30, 0.62), (-0.38, 0.66), (-0.63, 0.32)]), dz=0.001), m_branch),
        G.prim(G.offset(G.poly([(0.30, 0.58), (0.58, 0.24), (0.66, 0.30), (0.38, 0.62)]), dz=0.001), m_branch),
    ], "branch"), t=(0, 0, -0.05))

    petal_mesh = b.add_mesh([G.prim(G.disc(0.19, 12), m_petal)], "petal")
    petals = []
    spots = [(-0.80, 0.60), (-0.52, 0.34), (-0.30, 0.66), (-0.05, 0.52), (0.22, 0.62),
             (0.44, 0.36), (0.62, 0.60), (0.86, 0.50), (-0.66, 0.44), (0.06, 0.30)]
    for i, (x, y) in enumerate(spots):
        petals.append(b.add_node("petal%d" % i, mesh=petal_mesh, t=(x, y, 0.02)))

    children = [sky, branch] + petals
    tracks = []
    bm, _ = add_badge(b, label, 0.92)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, -0.06, 0.1), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        # 花びらが風で舞い落ちる。左右に振れながら下へ
        for i, n in enumerate(petals):
            x, y = spots[i]
            dx = 0.34 * (1 if i % 2 else -1)
            tracks.append({"node": n, "times": [0, 0.12 + i * 0.05, 1.5],
                           "translation": [(x, y, 0.02), (x, y, 0.02), (x + dx, -1.1, 0.02)]})
            tracks.append({"node": n, "times": [0, 1.5],
                           "rotation": [G.quat_axis((0, 0, 1), 0),
                                        G.quat_axis((0, 0, 1), deg(420 * (1 if i % 2 else -1)))]})
        tracks.append({"node": badge, "times": [0, 0.75, 1.0, 1.2, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.18, 1.18, 1.18), (1, 1, 1), (1, 1, 1)]})
    else:
        for i, n in enumerate(petals):
            x, y = spots[i]
            tracks.append({"node": n, "times": [0, 0.9, 1.8, 2.7],
                           "translation": [(x, y, 0.02), (x, y + 0.05, 0.02), (x, y, 0.02), (x, y + 0.05, 0.02)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 豆まき — 豆が飛んで鬼が退散し、結果が現れる
# ============================================================
def build_mamemaki(cat, key, label):
    b = G.Builder()
    t_masu = b.add_texture(tex.to_png(tex.wood((512, 512), (206, 172, 116), seed=111)), "masu_wood")
    m_masu = b.add_material("masu_mat", texture=t_masu, roughness=0.78)
    m_bean = b.add_material("bean_mat", color=(0.88, 0.76, 0.48, 1), roughness=0.6)
    oni = tex.rgrad((512, 512), (226, 84, 62), (162, 32, 28))
    dd = ImageDraw.Draw(oni)
    dd.polygon([(126, 128), (168, 30), (196, 132)], fill=(246, 230, 190))
    dd.polygon([(386, 128), (344, 30), (316, 132)], fill=(246, 230, 190))
    dd.ellipse([150, 196, 224, 254], fill=(255, 250, 236))
    dd.ellipse([288, 196, 362, 254], fill=(255, 250, 236))
    dd.ellipse([174, 212, 204, 242], fill=(40, 30, 28))
    dd.ellipse([312, 212, 342, 242], fill=(40, 30, 28))
    dd.arc([176, 292, 336, 412], 200, 340, fill=(64, 18, 16), width=16)
    oni = tex.vignette(tex.grain(oni, 5, 112), 0.3)
    t_oni = b.add_texture(tex.to_png(oni), "oni_face")
    m_oni = b.add_material("oni_mat", texture=t_oni, roughness=0.65)

    oni_n = b.add_node("oni", mesh=b.add_mesh([G.prim(G.disc(0.52, 26), m_oni)], "oni"), t=(0.0, 0.30, -0.02))
    masu = b.add_node("masu", mesh=b.add_mesh([
        G.prim(G.poly([(-0.52, -0.78), (0.52, -0.78), (0.60, -0.24), (-0.60, -0.24)]), m_masu)], "masu"),
        t=(0, 0, 0.04))
    bean_mesh = b.add_mesh([G.prim(G.disc(0.055, 10), m_bean)], "bean")
    beans = []
    bspots = [(-0.34, -0.16), (-0.12, -0.18), (0.10, -0.16), (0.32, -0.18), (0.0, -0.10), (-0.22, -0.08)]
    for i, (x, y) in enumerate(bspots):
        beans.append(b.add_node("bean%d" % i, mesh=bean_mesh, t=(x, y, 0.06)))

    children = [oni_n, masu] + beans
    tracks = []
    bm, _ = add_badge(b, label, 0.82)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.28, 0.1), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        for i, n in enumerate(beans):
            x, y = bspots[i]
            tracks.append({"node": n, "times": [0, 0.1 + i * 0.04, 0.62 + i * 0.03],
                           "translation": [(x, y, 0.06), (x, y, 0.06), (x * 1.7, 0.42, 0.12)]})
            tracks.append({"node": n, "times": [0.62 + i * 0.03, 0.78 + i * 0.03],
                           "scale": [(1, 1, 1), (0, 0, 0)]})
        # 鬼が後ずさりして消える
        tracks.append({"node": oni_n, "times": [0, 0.55, 0.75, 1.0],
                       "translation": [(0, 0.30, -0.02), (0, 0.30, -0.02), (0.18, 0.46, -0.4), (0.34, 0.62, -0.9)]})
        tracks.append({"node": oni_n, "times": [0, 0.6, 1.0],
                       "scale": [(1, 1, 1), (1, 1, 1), (0, 0, 0)]})
        tracks.append({"node": badge, "times": [0, 0.95, 1.18, 1.38, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": oni_n, "times": [0, 0.6, 1.2, 1.8, 2.4],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (-6, 6, -6, 6, -6)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# クレーンゲーム — アームが降りて景品をつかみ上げる
# ============================================================
def build_crane(cat, key, label):
    b = G.Builder()
    glass = tex.vgrad((512, 512), (206, 226, 240), (150, 182, 206))
    dd = ImageDraw.Draw(glass)
    dd.rectangle([0, 0, 511, 511], outline=(232, 60, 92), width=26)
    dd.line([(64, 40), (150, 470)], fill=(240, 248, 255), width=18)
    glass = tex.vignette(tex.grain(glass, 4, 121), 0.3)
    t_glass = b.add_texture(tex.to_png(glass), "crane_glass")
    m_glass = b.add_material("crane_glass_mat", texture=t_glass, roughness=0.4)
    m_frame = b.add_material("crane_frame_mat", color=(0.90, 0.24, 0.36, 1), roughness=0.5)
    m_arm = b.add_material("crane_arm_mat", color=(0.72, 0.75, 0.80, 1), roughness=0.35, metallic=0.4)

    W, H = 1.25, 1.55
    cab = b.add_node("cabinet", mesh=b.add_mesh([G.prim(G.plane(W, H), m_glass)], "cabinet"), t=(0, 0, -0.06))
    top = b.add_node("top", mesh=b.add_mesh([G.prim(G.plane(W * 1.06, 0.22), m_frame)], "top"), t=(0, H / 2, 0))
    rail = b.add_node("rail", mesh=b.add_mesh([G.prim(G.plane(W * 0.94, 0.05), m_arm)], "rail"), t=(0, H * 0.34, 0))

    # アーム(3本の爪)。降りて閉じて上がる
    claw_geo = G.plane(0.05, 0.34)
    claw_mesh = b.add_mesh([G.prim(claw_geo, m_arm)], "claw")
    head = b.add_node("head", t=(0, H * 0.30, 0.03))
    wire = b.add_node("wire", mesh=b.add_mesh([G.prim(G.plane(0.03, 0.5), m_arm)], "wire"), t=(0, 0.25, -0.01))
    claws = []
    for i, x in enumerate((-0.13, 0.0, 0.13)):
        pv = b.add_node("clawp%d" % i, t=(x, 0, 0))
        cn = b.add_node("claw%d" % i, mesh=claw_mesh, t=(0, -0.17, 0))
        b.nodes[pv]["children"] = [cn]
        claws.append(pv)
    b.nodes[head]["children"] = [wire] + claws

    children = [cab, top, rail, head]
    tracks = []
    bm, _ = add_badge(b, label, 0.62)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, -H * 0.30, 0.05), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": head, "times": [0, 0.15, 0.6, 0.85, 1.35],
                       "translation": [(0, H * 0.30, 0.03), (0, H * 0.30, 0.03), (0, -H * 0.20, 0.03),
                                       (0, -H * 0.20, 0.03), (0, H * 0.16, 0.03)]})
        for i, pv in enumerate(claws):
            ang = (18, 0, -18)[i]
            tracks.append({"node": pv, "times": [0, 0.6, 0.85],
                           "rotation": [G.quat_axis((0, 0, 1), deg(ang)), G.quat_axis((0, 0, 1), deg(ang)),
                                        G.quat_axis((0, 0, 1), 0)]})
        tracks.append({"node": badge, "times": [0, 0.72, 0.9, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1, 1, 1), (1, 1, 1)]})
        tracks.append({"node": badge, "times": [0, 0.85, 1.35, 2.0],
                       "translation": [(0, -H * 0.30, 0.05), (0, -H * 0.30, 0.05),
                                       (0, H * 0.06, 0.08), (0, H * 0.06, 0.08)]})
    else:
        tracks.append({"node": head, "times": [0, 0.9, 1.8, 2.7],
                       "translation": [(-0.3, H * 0.30, 0.03), (0.3, H * 0.30, 0.03),
                                       (-0.3, H * 0.30, 0.03), (0.3, H * 0.30, 0.03)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# もぐらたたき — もぐらが出てハンマーで叩くと結果
# ============================================================
def build_mogura(cat, key, label):
    b = G.Builder()
    t_board = b.add_texture(tex.to_png(tex.panel((512, 512), (86, 168, 92), (44, 116, 58))), "mogura_board")
    m_board = b.add_material("mogura_board_mat", texture=t_board, roughness=0.7)
    m_hole = b.add_material("mogura_hole_mat", color=(0.09, 0.08, 0.07, 1), roughness=0.95)
    face = tex.rgrad((512, 512), (176, 136, 98), (118, 84, 56))
    dd = ImageDraw.Draw(face)
    dd.ellipse([146, 200, 216, 258], fill=(255, 252, 244))
    dd.ellipse([296, 200, 366, 258], fill=(255, 252, 244))
    dd.ellipse([168, 216, 196, 244], fill=(38, 30, 26))
    dd.ellipse([318, 216, 346, 244], fill=(38, 30, 26))
    dd.ellipse([222, 286, 290, 336], fill=(238, 148, 156))
    face = tex.vignette(tex.grain(face, 5, 131), 0.28)
    t_face = b.add_texture(tex.to_png(face), "mogura_face")
    m_face = b.add_material("mogura_face_mat", texture=t_face, roughness=0.7)
    m_hammer = b.add_material("mogura_hammer_mat", color=(0.92, 0.32, 0.30, 1), roughness=0.5)
    m_handle = b.add_material("mogura_handle_mat", color=(0.55, 0.38, 0.22, 1), roughness=0.8)

    board = b.add_node("board", mesh=b.add_mesh([G.prim(G.plane(1.6, 1.05), m_board)], "board"), t=(0, -0.15, -0.06))
    holes = []
    for i, x in enumerate((-0.48, 0.0, 0.48)):
        holes.append(b.add_node("hole%d" % i,
                                mesh=b.add_mesh([G.prim(G.disc(0.24, 22), m_hole)], "hole"),
                                t=(x, -0.16, -0.04)))
    mogu = b.add_node("mogura", mesh=b.add_mesh([G.prim(G.disc(0.2, 22), m_face)], "mogura"),
                      t=(0, -0.32, -0.02), s=(1, 1, 1))
    hammer_mesh = b.add_mesh([
        G.prim(G.plane(0.42, 0.26), m_hammer),
        G.prim(G.offset(G.plane(0.10, 0.5), dy=-0.35, dz=-0.01), m_handle),
    ], "hammer")
    ham_pivot = b.add_node("hammer_pivot", t=(0.62, 0.52, 0.1))
    ham = b.add_node("hammer", mesh=hammer_mesh, t=(-0.2, -0.1, 0))
    b.nodes[ham_pivot]["children"] = [ham]

    children = [board] + holes + [mogu, ham_pivot]
    tracks = []
    bm, _ = add_badge(b, label, 0.8)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.05, 0.14), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": mogu, "times": [0, 0.1, 0.45, 0.72, 0.85],
                       "translation": [(0, -0.32, -0.02), (0, -0.32, -0.02), (0, 0.02, -0.02),
                                       (0, 0.02, -0.02), (0, -0.34, -0.02)]})
        tracks.append({"node": ham_pivot, "times": [0, 0.3, 0.66, 0.8, 1.1],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (28, 44, -46, -40, 18)]})
        tracks.append({"node": badge, "times": [0, 0.72, 0.95, 1.15, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": mogu, "times": [0, 0.7, 1.4, 2.1, 2.8],
                       "translation": [(0, -0.32, -0.02), (0, -0.04, -0.02), (0, -0.32, -0.02),
                                       (0, -0.04, -0.02), (0, -0.32, -0.02)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# ボウリング — ボールが転がりピンが倒れて結果
# ============================================================
def build_bowling(cat, key, label):
    b = G.Builder()
    t_lane = b.add_texture(tex.to_png(tex.wood((512, 512), (198, 154, 96), seed=141, vertical=True)), "lane")
    m_lane = b.add_material("lane_mat", texture=t_lane, roughness=0.4)
    pin = tex.vgrad((256, 512), (255, 255, 255), (226, 228, 232))
    dd = ImageDraw.Draw(pin)
    dd.rectangle([0, 150, 256, 186], fill=(214, 42, 46))
    dd.rectangle([0, 206, 256, 236], fill=(214, 42, 46))
    t_pin = b.add_texture(tex.to_png(tex.vignette(pin, 0.25)), "pin")
    m_pin = b.add_material("pin_mat", texture=t_pin, roughness=0.35)
    m_ball = b.add_material("ball_mat", color=(0.16, 0.12, 0.32, 1), roughness=0.22, metallic=0.1)

    lane = b.add_node("lane", mesh=b.add_mesh([G.prim(G.plane(1.5, 1.6), m_lane)], "lane"), t=(0, 0, -0.08))
    pin_mesh = b.add_mesh([G.prim(G.poly([(-0.12, -0.36), (0.12, -0.36), (0.09, 0.36), (-0.09, 0.36)]), m_pin)], "pin")
    pins = []
    pspots = [(-0.50, 0.30), (-0.17, 0.38), (0.17, 0.38), (0.50, 0.30), (0.0, 0.02)]
    for i, (x, y) in enumerate(pspots):
        pv = b.add_node("pinp%d" % i, t=(x, y - 0.36, 0.0))
        pn = b.add_node("pin%d" % i, mesh=pin_mesh, t=(0, 0.36, 0))
        b.nodes[pv]["children"] = [pn]
        pins.append(pv)
    ball = b.add_node("ball", mesh=b.add_mesh([G.prim(G.disc(0.20, 24), m_ball)], "ball"), t=(0, -0.95, 0.04))

    children = [lane] + pins + [ball]
    tracks = []
    bm, _ = add_badge(b, label, 0.78)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.34, 0.16), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": ball, "times": [0, 0.1, 0.6, 0.78],
                       "translation": [(0, -0.95, 0.04), (0, -0.95, 0.04), (0, 0.06, 0.04), (0, 0.30, 0.04)]})
        tracks.append({"node": ball, "times": [0, 0.6, 0.78],
                       "scale": [(1, 1, 1), (0.78, 0.78, 1), (0.6, 0.6, 1)]})
        for i, pv in enumerate(pins):
            a = (-58, -40, 44, 60, -26)[i]
            t0 = 0.58 + i * 0.03
            tracks.append({"node": pv, "times": [0, t0, t0 + 0.22],
                           "rotation": [G.quat_axis((0, 0, 1), 0), G.quat_axis((0, 0, 1), 0),
                                        G.quat_axis((0, 0, 1), deg(a))]})
        tracks.append({"node": badge, "times": [0, 0.9, 1.12, 1.32, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": ball, "times": [0, 0.9, 1.8, 2.7],
                       "translation": [(0, -0.95, 0.04), (0, -0.80, 0.04), (0, -0.95, 0.04), (0, -0.80, 0.04)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# 巻物 — 巻物が下へ開いて結果が現れる
# ============================================================
def build_makimono(cat, key, label):
    b = G.Builder()
    washi = tex.paper((512, 512), (247, 238, 214), seed=151)
    dd = ImageDraw.Draw(washi)
    dd.rectangle([26, 0, 34, 511], fill=(206, 168, 84))
    dd.rectangle([478, 0, 486, 511], fill=(206, 168, 84))
    t_washi = b.add_texture(tex.to_png(washi), "makimono_washi")
    m_washi = b.add_material("makimono_washi_mat", texture=t_washi, roughness=0.85)
    t_rod = b.add_texture(tex.to_png(tex.wood((512, 512), (112, 72, 42), seed=152, vertical=True)), "makimono_rod")
    m_rod = b.add_material("makimono_rod_mat", texture=t_rod, roughness=0.6)
    m_cap = b.add_material("makimono_cap_mat", color=(0.80, 0.64, 0.28, 1), roughness=0.35, metallic=0.25)

    W, PH = 1.15, 1.35
    grow = b.add_node("paper_grow", t=(0, 0.60, -0.02))
    paper = b.add_node("paper", mesh=b.add_mesh([G.prim(G.plane(W, PH), m_washi)], "paper"), t=(0, -PH / 2, 0))
    b.nodes[grow]["children"] = [paper]
    rod_top = b.add_node("rod_top", mesh=b.add_mesh([
        G.prim(G.plane(W * 1.16, 0.15), m_rod),
        G.prim(G.offset(G.disc(0.10, 16), dx=-W * 0.58), m_cap),
        G.prim(G.offset(G.disc(0.10, 16), dx=W * 0.58), m_cap),
    ], "rod"), t=(0, 0.66, 0.03))
    rod_bottom = b.add_node("rod_bottom", mesh=b.add_mesh([
        G.prim(G.plane(W * 1.16, 0.15), m_rod),
        G.prim(G.offset(G.disc(0.10, 16), dx=-W * 0.58), m_cap),
        G.prim(G.offset(G.disc(0.10, 16), dx=W * 0.58), m_cap),
    ], "rod2"), t=(0, 0.58, 0.03))

    children = [grow, rod_top, rod_bottom]
    tracks = []
    bm, _ = add_badge(b, label, 0.8)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, -0.06, 0.06), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": grow, "times": [0, 0.15, 1.0],
                       "scale": [(1, 0.09, 1), (1, 0.09, 1), (1, 1, 1)]})
        tracks.append({"node": rod_bottom, "times": [0, 0.15, 1.0],
                       "translation": [(0, 0.48, 0.03), (0, 0.48, 0.03), (0, 0.60 - PH, 0.03)]})
        tracks.append({"node": badge, "times": [0, 0.95, 1.18, 1.38, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": grow, "times": [0, 0.9, 1.8, 2.7],
                       "scale": [(1, 0.09, 1), (1, 0.26, 1), (1, 0.09, 1), (1, 0.26, 1)]})
        tracks.append({"node": rod_bottom, "times": [0, 0.9, 1.8, 2.7],
                       "translation": [(0, 0.48, 0.03), (0, 0.48 - PH * 0.2, 0.03),
                                       (0, 0.48, 0.03), (0, 0.48 - PH * 0.2, 0.03)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
# お年玉 — ぽち袋からお札が出てくる
# ============================================================
def build_otoshidama(cat, key, label):
    b = G.Builder()
    env = tex.vgrad((512, 512), (250, 246, 238), (232, 224, 210))
    dd = ImageDraw.Draw(env)
    dd.rectangle([0, 0, 511, 96], fill=(206, 40, 46))
    dd.rectangle([0, 96, 511, 112], fill=(226, 196, 120))
    env = tex.vignette(tex.grain(env, 5, 161), 0.26)
    tex.draw_text(env, "お年玉", (74, 190, 438, 336), fill=(190, 30, 36),
                  stroke=(255, 255, 255), stroke_w=6, path=tex.FONT_SERIF)
    t_env = b.add_texture(tex.to_png(env), "pochi")
    m_env = b.add_material("pochi_mat", texture=t_env, roughness=0.8)
    bill = tex.vgrad((512, 256), (238, 240, 226), (214, 220, 202))
    dd = ImageDraw.Draw(bill)
    dd.rectangle([16, 16, 496, 240], outline=(140, 156, 130), width=6)
    dd.ellipse([196, 66, 316, 190], outline=(150, 164, 140), width=5)
    t_bill = b.add_texture(tex.to_png(tex.grain(bill, 4, 162)), "bill")
    m_bill = b.add_material("bill_mat", texture=t_bill, roughness=0.8)

    W, H = 0.95, 1.3
    bill_n = b.add_node("bill", mesh=b.add_mesh([G.prim(G.plane(W * 0.82, 0.62), m_bill)], "bill"),
                        t=(0, 0.1, -0.03))
    env_n = b.add_node("envelope", mesh=b.add_mesh([G.prim(G.plane(W, H), m_env)], "envelope"))
    flap_mesh = b.add_mesh([G.prim(G.plane(W, 0.3), m_env)], "flap")
    flap_h = b.add_node("flap_hinge", t=(0, H / 2, 0.02))
    flap = b.add_node("flap", mesh=flap_mesh, t=(0, -0.15, 0))
    b.nodes[flap_h]["children"] = [flap]

    children = [bill_n, env_n, flap_h]
    tracks = []
    bm, _ = add_badge(b, label, 0.72)
    if bm is not None:
        badge = b.add_node("badge", mesh=bm, t=(0, 0.72, 0.08), s=(0, 0, 0))
        children.append(badge)
    root = b.add_node("root", children=children)

    if label:
        tracks.append({"node": flap_h, "times": [0, 0.2, 0.7],
                       "rotation": [G.quat_axis((1, 0, 0), deg(a)) for a in (0, 0, 128)]})
        tracks.append({"node": bill_n, "times": [0, 0.45, 1.0],
                       "translation": [(0, 0.1, -0.03), (0, 0.1, -0.03), (0, 0.82, -0.03)]})
        tracks.append({"node": badge, "times": [0, 0.95, 1.18, 1.38, 2.0],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1), (1, 1, 1)]})
    else:
        tracks.append({"node": root, "times": [0, 0.6, 1.2, 1.8, 2.4],
                       "rotation": [G.quat_axis((0, 0, 1), deg(a)) for a in (-5, 5, -5, 5, -5)]})
    b.animate(tracks, "reveal")
    return b, [root]


# ============================================================
BUILDERS = {
    "sankaku": build_sankaku,            # 王道: 三角くじ
    "ema": build_ema,                    # 王道: 絵馬
    "kagamibiraki": build_kagamibiraki,  # 季節: 鏡開き
    "xmas": build_xmas,                  # 季節: クリスマス
    "vending": build_vending,            # 業種: 自動販売機
    "receipt": build_receipt,            # 業種: レシート
    "ring": build_ring,                  # 参加型: 輪投げ
    "safe": build_safe,                  # 参加型: 金庫
    "fukubukuro": build_fukubukuro,      # 季節: 福袋
    "sakura": build_sakura,              # 季節: 桜
    "mamemaki": build_mamemaki,          # 季節: 豆まき
    "otoshidama": build_otoshidama,      # 季節: お年玉
    "crane": build_crane,                # 業種: クレーンゲーム
    "mogura": build_mogura,              # 参加型: もぐらたたき
    "bowling": build_bowling,            # 参加型: ボウリング
    "makimono": build_makimono,          # 王道: 巻物
}


def build_all(only=None):
    for cat, fn in BUILDERS.items():
        if only and cat not in only:
            continue
        outdir = os.path.join(OUT_ROOT, cat)
        os.makedirs(outdir, exist_ok=True)
        made = 0
        for key, label in TIERS + [("suspense", None)]:
            b, roots = fn(cat, key, label)
            path = os.path.join(outdir, "%s_%s_3d.glb" % (cat, key))
            size = b.save(path, roots)
            made += 1
        print("%s: %d ファイル生成" % (cat, made))


if __name__ == "__main__":
    build_all(sys.argv[1:] or None)
