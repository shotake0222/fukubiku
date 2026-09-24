# -*- coding: utf-8 -*-
"""2026-09 追加の第2弾(10カテゴリ)。

  風船割り / ゴルフ / ホームラン / トランプ / 神社の鈴 /
  焼き芋 / たこ焼き / ハンバーガー / 郵便ポスト / 紅葉

出力の約束は build.py / legacy.py / extra.py と同じ。
作ったあとは build_v2.py の説明どおり apply_badges → dedupe → fit → thumbs を流す。
"""
import math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)

import glbwrite as G
import tex
import kit as K
from kit import deg, qx, qy, qz, qmul
from legacy import gold, glow_mat, streak_mat, shockwave, SERIF, SANS
from extra import confetti_burst, confetti_tracks, steam, steam_tracks, WIN
from PIL import Image, ImageDraw, ImageFilter, ImageFont


# ============================================================
# 風船割り — ダーツで風船が割れて結果が出る
# ============================================================
BALLOON_COLS = [(240, 60, 80), (60, 150, 240), (250, 200, 50), (80, 200, 120), (190, 100, 230)]


def build_balloon(cat, key, label):
    b = G.Builder()
    mats = [K.col(b, "balloon_%d" % i, c, rough=0.18, metal=0.05) for i, c in enumerate(BALLOON_COLS)]
    m_string = K.col(b, "balloon_string", (240, 240, 240), rough=0.8)
    m_board = K.texmat(b, "balloon_board", tex.wood((256, 256), (150, 100, 56), seed=301), rough=0.7)
    m_dart = K.col(b, "balloon_dart", (220, 40, 50), rough=0.4)
    m_steel = K.col(b, "balloon_steel", (210, 214, 222), rough=0.2, metal=0.9)
    m_ring = shockwave(b, "balloon_ring", (255, 240, 200))
    prof = K.smooth_profile([(0, -0.24), (0.1, -0.2), (0.19, -0.05), (0.2, 0.08), (0.14, 0.22), (0, 0.27)], 4)
    shape = K.merge(K.lathe(prof, 18), K.transform(G.cylinder(0.025, 0.04, 10, r_top=0.005), t=(0, -0.26, 0)))
    board = K.transform(K.rounded_box(1.6, 1.25, 0.08, r=0.03, n=2), t=(0, 0, -0.3))
    board_mesh = b.add_mesh([G.prim(board, m_board)], "board")
    boardN = b.add_node("board", mesh=board_mesh)
    nodes = []
    pos = [(-0.52, 0.28), (0.0, 0.34), (0.52, 0.28), (-0.27, -0.2), (0.27, -0.2)]
    target = 1  # 真ん中上が割れる
    for i, (x, y) in enumerate(pos):
        string = K.tube([(0, -0.28, 0), (0.02, -0.36, 0), (0, -0.45, -0.25)], 0.006, 5)
        mesh = b.add_mesh([G.prim(shape, mats[i % len(mats)]), G.prim(string, m_string)], "balloon_%d" % i)
        nodes.append(b.add_node("balloon_%d" % i, mesh=mesh, t=(x, y, 0)))
    dart = K.merge(K.transform(G.cylinder(0.018, 0.3, 10), r=qx(90), t=(0, 0, 0.2)))
    tip = K.transform(G.cylinder(0.003, 0.12, 8, r_top=0.018), r=qx(90), t=(0, 0, -0.01))
    fl = K.extrude([(0, 0), (0.08, -0.02), (0.08, -0.1), (0, -0.12)], 0.006)
    flights = K.merge(*[K.transform(fl, r=qmul(qz(a), qy(-90)), t=(0, 0, 0.36)) for a in (0, 120, 240)])
    dart_mesh = b.add_mesh([G.prim(dart, m_steel), G.prim(tip, m_steel), G.prim(flights, m_dart)], "dart")
    tx, ty = pos[target]
    dart_n = b.add_node("dart", mesh=dart_mesh, t=(tx, ty, 0.1), r=qmul(qy(25), qx(-15)), s=(1.4,) * 3)
    ring_mesh = b.add_mesh([G.prim(G.plane(1.0, 1.0), m_ring)], "ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(tx, ty, 0.05), s=(0, 0, 0))
    bits = confetti_burst(b, (tx, ty, 0.05), 18, (0.8, 0.6), 31)
    group = b.add_node("group", children=[boardN] + nodes + [dart_n, ring] + [x[0] for x in bits], t=(0, -0.05, 0))

    def bob(n, x, y, i, period=1.6):
        return {"node": n, "times": [0, period / 2, period],
                "translation": [(x, y, 0), (x, y + 0.04 * (1 if i % 2 else -1), 0), (x, y, 0)]}

    def action(root):
        tr = [{"node": dart_n, "times": [0, 0.35, 0.65, 0.7],
               "translation": [(tx + 0.9, ty - 0.8, 2.0), (tx + 0.9, ty - 0.8, 2.0), (tx, ty, 0.1), (tx, ty, 0.12)]},
              {"node": nodes[target], "times": [0, 0.6, 0.66, 0.7], "scale": [(1, 1, 1), (1, 1, 1), (1.25, 1.25, 1.25), (0, 0, 0)]},
              {"node": ring, "times": [0, 0.64, 1.05, 1.07], "scale": [(0, 0, 0), (0.2,) * 3, (1.6,) * 3, (0, 0, 0)]}]
        tr += [bob(n, x, y, i) for i, (n, (x, y)) in enumerate(zip(nodes, pos)) if i != target]
        tr += confetti_tracks(bits, (tx, ty, 0.05), 0.66, 1.6)
        return tr

    def idle(root):
        return [bob(n, x, y, i) for i, (n, (x, y)) in enumerate(zip(nodes, pos))] + \
               [{"node": dart_n, "times": [0, 0.8, 1.6], "translation": [(0.8, -0.5, 0.9), (0.75, -0.42, 0.95), (0.8, -0.5, 0.9)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.8, badge_pos=(0, 0.3, 0.45), badge_size=0.8)


# ============================================================
# ゴルフ — パットがカップに吸い込まれる
# ============================================================
def tex_green():
    img = tex.stripes((512, 512), (70, 160, 70), (86, 176, 86), pitch=64)
    return tex.grain(img, 5, 302)


def tex_golfball(W=256, H=128):
    img = Image.new("RGB", (W, H), (250, 250, 250))
    d = ImageDraw.Draw(img)
    for y in range(4, H, 12):
        for x in range((y // 12) % 2 * 6, W, 12):
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(226, 226, 230))
    return img


def build_golf(cat, key, label):
    b = G.Builder()
    m_green = K.texmat(b, "golf_green", tex_green(), rough=0.9)
    m_hole = K.col(b, "golf_hole", (16, 20, 16), rough=1.0)
    m_ball = K.texmat(b, "golf_ball", tex_golfball(), rough=0.35)
    m_pole = K.col(b, "golf_pole", (250, 250, 250), rough=0.4)
    m_flag = K.col(b, "golf_flag", (230, 40, 50), rough=0.6)
    m_putter = K.col(b, "golf_putter", (190, 196, 206), rough=0.2, metal=0.9)
    m_grip = K.col(b, "golf_grip", (30, 30, 36), rough=0.7)
    green = K.transform(K.lumpy(G.cylinder(1.0, 0.1, 48), 0.03, 4, 3.0), s=(1, 1, 0.7))
    hole = K.transform(G.disc(0.1, 32), r=qx(-90), t=(0.35, 0.052, -0.2))
    green_mesh = b.add_mesh([G.prim(green, m_green), G.prim(hole, m_hole)], "green")
    greenN = b.add_node("green", mesh=green_mesh)
    pole = K.transform(G.cylinder(0.012, 1.0, 8), t=(0.35, 0.55, -0.2))
    flag = K.transform(K.extrude([(0, 0), (0.34, -0.1), (0, -0.2)], 0.01), t=(0.36, 1.04, -0.2))
    flag_mesh = b.add_mesh([G.prim(pole, m_pole), G.prim(flag, m_flag)], "flag")
    flagN = b.add_node("flag", mesh=flag_mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.06, 20, 12), m_ball)], "ball")
    start = (-0.55, 0.11, 0.35)
    ball = b.add_node("ball", mesh=ball_mesh, t=start)
    shaft = K.transform(G.cylinder(0.012, 0.9, 8), t=(0, 0.45, 0))
    head = K.transform(K.rounded_box(0.22, 0.05, 0.06, r=0.02, n=1), t=(0.05, 0.0, 0))
    grip = K.transform(G.cylinder(0.02, 0.2, 10), t=(0, 0.82, 0))
    putter_mesh = b.add_mesh([G.prim(K.merge(shaft, head), m_putter), G.prim(grip, m_grip)], "putter")
    putter = b.add_node("putter", mesh=putter_mesh, t=(-0.78, 0.1, 0.38), r=qz(10))
    group = b.add_node("group", children=[greenN, flagN, ball, putter], t=(0, -0.35, 0), r=qx(35))
    cup = (0.35, 0.11, -0.2)
    miss = (0.52, 0.11, -0.28)

    def action(root):
        tr = [{"node": putter, "times": [0, 0.25, 0.45, 0.6], "rotation": [qz(10), qz(35), qz(-5), qz(0)]}]
        if WIN(key):
            tr.append({"node": ball, "times": [0, 0.44, 1.15, 1.25, 1.35],
                       "translation": [start, start, (cup[0] - 0.03, cup[1], cup[2] + 0.02), cup, (cup[0], cup[1] - 0.12, cup[2])]})
        else:
            tr.append({"node": ball, "times": [0, 0.44, 1.15, 1.4],
                       "translation": [start, start, (cup[0] + 0.06, cup[1], cup[2] + 0.04), miss]})
        tr.append({"node": flagN, "times": [0, 0.7, 1.4], "rotation": [qy(0), qy(8), qy(0)]})
        return tr

    def idle(root):
        return [{"node": putter, "times": [0, 0.6, 1.2], "rotation": [qz(10), qz(20), qz(10)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.35, badge_pos=(0, 0.35, 0.5), badge_size=0.8)


# ============================================================
# ホームラン — バットが快音、ボールが飛んでいく
# ============================================================
def tex_baseball(W=256, H=128):
    img = Image.new("RGB", (W, H), (250, 248, 242))
    d = ImageDraw.Draw(img)
    for off in (0, W // 2):
        pts = [(off + x, H / 2 + math.sin(x / (W / 2) * K.TAU) * H * 0.28) for x in range(0, W // 2 + 1, 4)]
        d.line(pts, fill=(210, 40, 40), width=4)
        for x, y in pts[::3]:
            d.line([(x - 4, y - 5), (x + 4, y + 5)], fill=(210, 40, 40), width=2)
    return img


def build_baseball(cat, key, label):
    b = G.Builder()
    m_ball = K.texmat(b, "baseball", tex_baseball(), rough=0.5)
    m_bat = K.texmat(b, "bat", tex.wood((64, 256), (210, 170, 110), seed=303, vertical=True), rough=0.4)
    m_grip = K.col(b, "bat_grip", (30, 30, 36), rough=0.7)
    m_trail = streak_mat(b, "ball_trail", (255, 240, 200))
    m_flash = glow_mat(b, "hit_flash", (255, 240, 180), 128, 1.8)
    m_ground = K.texmat(b, "infield", tex.grain(tex.vgrad((256, 256), (200, 150, 100), (170, 120, 80)), 10, 304), rough=0.9)
    m_base = K.col(b, "home_base", (250, 250, 250), rough=0.6)
    prof = K.smooth_profile([(0.0, -0.55), (0.035, -0.55), (0.03, -0.3), (0.04, 0.0), (0.07, 0.3), (0.075, 0.5), (0.0, 0.55)], 4)
    bat = K.lathe(prof, 20)
    grip = K.transform(G.cylinder(0.034, 0.25, 12), t=(0, -0.42, 0))
    knob = K.transform(G.cylinder(0.05, 0.03, 12), t=(0, -0.56, 0))
    bat_mesh = b.add_mesh([G.prim(bat, m_bat), G.prim(K.merge(grip, knob), m_grip)], "bat")
    batN = b.add_node("bat", mesh=bat_mesh, t=(0, 0.55, 0))
    pivot = b.add_node("pivot", children=[batN], t=(-0.45, -0.3, 0.1), r=qmul(qz(70), qx(-30)))
    ground = K.transform(G.cylinder(0.85, 0.06, 40), t=(0, -0.72, 0), s=(1, 1, 0.65))
    base = K.transform(K.extrude([(-0.12, 0.06), (0.12, 0.06), (0.12, -0.04), (0, -0.14), (-0.12, -0.04)], 0.02), r=qx(-90), t=(0.05, -0.68, 0.2))
    ground_mesh = b.add_mesh([G.prim(ground, m_ground), G.prim(base, m_base)], "ground")
    groundN = b.add_node("ground", mesh=ground_mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.07, 20, 12), m_ball)], "ball")
    trail_mesh = b.add_mesh([G.prim(K.transform(G.plane(0.8, 0.12), t=(-0.42, 0, 0)), m_trail)], "trail")
    trail = b.add_node("trail", mesh=trail_mesh, s=(0, 0, 0))
    ball = b.add_node("ball", mesh=ball_mesh, children=[trail], t=(1.2, 0.0, 0.8))
    flash_mesh = b.add_mesh([G.prim(G.plane(0.9, 0.9), m_flash)], "flash")
    hit = (0.05, -0.05, 0.25)
    flash = b.add_node("flash", mesh=flash_mesh, t=hit, s=(0, 0, 0))
    far = (-0.25, 0.95, -0.8) if WIN(key) else (0.75, -0.62, 0.4)
    # 当たり: ボールが消えた空に星がきらり
    twinkle = b.add_node("twinkle", mesh=flash_mesh, t=far, s=(0, 0, 0)) if WIN(key) else None
    kids = [groundN, pivot, ball, flash] + ([twinkle] if WIN(key) else [])
    group = b.add_node("group", children=kids, t=(0, 0.1, 0))

    def action(root):
        return [{"node": pivot, "times": [0, 0.35, 0.5, 0.62, 0.8],
                 "rotation": [qmul(qz(70), qx(-30)), qmul(qz(80), qx(-30)), qmul(qz(-20), qx(-10)), qmul(qz(-80), qx(10)), qmul(qz(-95), qx(15))]},
                # 当たりはボールが空の彼方へ消える(最後の位置に残すと全体の大きさが膨らむ)
                {"node": ball, "times": [0, 0.1, 0.5, 1.1, 1.2],
                 "translation": [(1.2, 0.0, 0.8), (1.2, 0.0, 0.8), hit, far, far],
                 "scale": [(1, 1, 1), (1, 1, 1), (1, 1, 1)] + ([(0.4, 0.4, 0.4), (0, 0, 0)] if WIN(key) else [(1, 1, 1), (1, 1, 1)])},
                {"node": trail, "times": [0, 0.5, 0.55, 1.1], "scale": [(0, 0, 0), (0, 0, 0), (1, 1, 1), (1, 1, 1)],
                 "rotation": [qz(0), qz(0), qz(-120 if WIN(key) else 20), qz(-120 if WIN(key) else 20)]},
                {"node": flash, "times": [0, 0.48, 0.56, 0.8], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (0, 0, 0)]}] + (
                [{"node": twinkle, "times": [0, 1.05, 1.2, 1.4], "scale": [(0, 0, 0), (0, 0, 0), (0.9,) * 3, (0.5,) * 3]}] if WIN(key) else [])

    def idle(root):
        tr = [{"node": pivot, "times": [0, 0.5, 1.0],
               "rotation": [qmul(qz(70), qx(-30)), qmul(qz(76), qx(-30)), qmul(qz(70), qx(-30))]}]
        if WIN(key):
            tr.append({"node": twinkle, "times": [0, 0.5, 1.0], "scale": [(0.5,) * 3, (0.65,) * 3, (0.5,) * 3]})
        return tr

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.55, 0.5), badge_size=0.8)


# ============================================================
# トランプ — 5枚のうち1枚がめくれる
# ============================================================
def tex_card_back():
    img = Image.new("RGB", (256, 360), (180, 30, 40))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, 246, 350], 16, outline=(250, 240, 220), width=6)
    for y in range(30, 340, 20):
        for x in range(30, 236, 20):
            d.polygon([(x, y - 7), (x + 7, y), (x, y + 7), (x - 7, y)], fill=(210, 60, 70))
    return img


def tex_card_face(win):
    img = Image.new("RGB", (256, 360), (252, 250, 246))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, 250, 354], 16, outline=(200, 200, 200), width=3)
    col = (210, 30, 40) if win else (30, 30, 40)
    rank = "A" if win else "2"
    f = ImageFont.truetype(SANS, 48)
    d.text((18, 12), rank, font=f, fill=col)
    d.text((202, 290), rank, font=f, fill=col)
    c = (128, 180)
    if win:
        pts = [(c[0] + x * 70, c[1] - y * 70) for x, y in K.heart_points(1.0, 40)]
        d.polygon(pts, fill=col)
    else:
        d.ellipse([98, 150, 158, 210], fill=col)
    return img


def build_cards(cat, key, label):
    b = G.Builder()
    m_back = K.texmat(b, "card_back", tex_card_back(), rough=0.4)
    m_face = K.texmat(b, "card_face", tex_card_face(WIN(key)), rough=0.4)
    m_felt = K.texmat(b, "felt", tex.grain(tex.rgrad((256, 256), (40, 130, 80), (20, 80, 50), cy=0.5), 8, 305), rough=0.95)
    W, H = 0.42, 0.6
    card = K.merge(K.transform(G.plane(W, H), t=(0, 0, 0.003)))
    card_mesh = b.add_mesh([G.prim(card, m_back), G.prim(K.transform(G.back(G.plane(W, H)), t=(0, 0, -0.003)), m_face)], "card")
    table = K.transform(K.rounded_box(2.0, 1.3, 0.06, r=0.03, n=2), t=(0, 0, -0.05))
    table_mesh = b.add_mesh([G.prim(table, m_felt)], "table")
    tableN = b.add_node("table", mesh=table_mesh)
    cards = []
    for i in range(5):
        x = (i - 2) * 0.36
        cards.append((b.add_node("card_%d" % i, mesh=card_mesh, t=(x, -0.05, 0.01), r=qz((i - 2) * 3)), x))
    pick = 2
    group = b.add_node("group", children=[tableN] + [c[0] for c in cards], t=(0, -0.1, 0), r=qx(20))

    def action(root):
        tr = []
        # シャッフル風に一度寄せて広げる
        for i, (n, x) in enumerate(cards):
            if i == pick:
                continue
            tr.append({"node": n, "times": [0, 0.3, 0.6], "translation": [(x, -0.05, 0.01), (0, -0.05, 0.01 + i * 0.002), (x, -0.05, 0.01)]})
        n, x = cards[pick]
        tr.append({"node": n, "times": [0, 0.3, 0.6, 0.85, 1.05, 1.15],
                   "translation": [(x, -0.05, 0.01), (0, -0.05, 0.02), (x, -0.05, 0.01), (x, 0.15, 0.35), (x, 0.2, 0.4), (x, 0.2, 0.4)],
                   "rotation": [qz(0), qz(0), qz(0), qy(90), qy(180), qy(180)],
                   "scale": [(1, 1, 1), (1, 1, 1), (1, 1, 1), (1.3, 1.3, 1.3), (1.4, 1.4, 1.4), (1.4, 1.4, 1.4)]})
        return tr

    def idle(root):
        return [{"node": n, "times": [0, 0.4, 0.8], "translation": [(x, -0.05, 0.01), (x, -0.02 + 0.02 * (i % 2), 0.02), (x, -0.05, 0.01)]}
                for i, (n, x) in enumerate(cards)]

    return K.finish(b, [group], label, action, idle, badge_at=1.15, badge_pos=(0, 0.55, 0.6), badge_size=0.8)


# ============================================================
# 神社の鈴 — 鈴緒を振ると鈴が鳴り、光が広がる
# ============================================================
def build_saisen(cat, key, label):
    b = G.Builder()
    m_wood = K.texmat(b, "shrine_wood", tex.wood((256, 256), (160, 80, 40), seed=306), rough=0.7)
    m_gold = gold(b)
    m_rope = K.texmat(b, "suzu_rope", tex.stripes((64, 256), (220, 40, 50), (250, 250, 250), pitch=24), rough=0.8)
    m_box = K.texmat(b, "saisen_box", tex.wood((256, 256), (120, 70, 36), seed=307), rough=0.7)
    m_label = K.texmat(b, "saisen_label", tex.panel((256, 96), (60, 30, 20), (40, 20, 12), text="賽銭", fg=(250, 220, 140)), rough=0.6)
    m_ring = shockwave(b, "suzu_ring", (255, 236, 170))
    m_coin = K.col(b, "coin5", (230, 180, 70), rough=0.25, metal=0.9)
    beam = K.transform(K.rounded_box(1.8, 0.14, 0.2, r=0.03, n=2), t=(0, 0.95, 0))
    bell = K.merge(K.transform(G.sphere(0.2, 28, 16), t=(0, 0, 0)), K.transform(G.torus(0.2, 0.02, 28, 6), r=qx(90)))
    slit = K.transform(K.rounded_box(0.3, 0.03, 0.02, r=0.01, n=1), t=(0, -0.1, 0.19))
    bell_mesh = b.add_mesh([G.prim(bell, m_gold), G.prim(slit, K.col(b, "slit", (40, 30, 10), rough=0.9))], "suzu")
    bellN = b.add_node("suzu", mesh=bell_mesh, t=(0, -0.22, 0))
    rope = K.tube([(0, -0.4, 0), (0, -0.8, 0.02), (0, -1.25, 0.05)], 0.05, 12)
    rope_mesh = b.add_mesh([G.prim(rope, m_rope)], "rope")
    ropeN = b.add_node("rope", mesh=rope_mesh)
    swing = b.add_node("swing", children=[bellN, ropeN], t=(0, 0.88, 0))
    box = K.transform(K.rounded_box(1.2, 0.36, 0.5, r=0.03, n=2), t=(0, -0.62, 0.1))
    grille = K.merge(*[K.transform(G.cylinder(0.015, 1.1, 6), r=qz(90), t=(0, -0.44, 0.1 + dz)) for dz in (-0.15, -0.05, 0.05, 0.15)])
    label_pl = K.transform(G.plane(0.5, 0.18), t=(0, -0.64, 0.352))
    shrine_mesh = b.add_mesh([G.prim(beam, m_wood), G.prim(box, m_box), G.prim(grille, m_gold), G.prim(label_pl, m_label)], "shrine")
    shrine = b.add_node("shrine", mesh=shrine_mesh)
    coin_mesh = b.add_mesh([G.prim(K.merge(K.transform(G.torus(0.05, 0.02, 20, 6), r=qx(90))), m_coin)], "coin")
    coin = b.add_node("coin", mesh=coin_mesh, t=(0.2, 0.2, 0.6), s=(0, 0, 0))
    ring_mesh = b.add_mesh([G.prim(G.plane(1.3, 1.3), m_ring)], "ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(0, 0.66, 0.1), s=(0, 0, 0))
    group = b.add_node("group", children=[shrine, swing, coin, ring], t=(0, -0.05, 0))

    def action(root):
        return [{"node": coin, "times": [0, 0.1, 0.45, 0.5], "translation": [(0.2, 0.2, 0.6), (0.2, 0.2, 0.6), (0.05, -0.44, 0.1), (0.05, -0.5, 0.1)],
                 "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (0, 0, 0)], "rotation": [qx(0), qx(0), qx(360 * 0.9), qx(360)]},
                {"node": swing, "times": [0, 0.55, 0.7, 0.85, 1.0, 1.15, 1.3], "rotation": [qz(a) for a in (0, 0, 14, -12, 9, -5, 0)]},
                {"node": ring, "times": [0, 0.7, 1.1, 1.12, 1.0 + 0.2, 1.6, 1.62],
                 "scale": [(0, 0, 0), (0.2,) * 3, (1.6,) * 3, (0, 0, 0), (0.2,) * 3, (1.6,) * 3, (0, 0, 0)]}]

    def idle(root):
        return [{"node": swing, "times": [0, 0.8, 1.6], "rotation": [qz(-3), qz(3), qz(-3)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.25, badge_pos=(0, 0.05, 0.55), badge_size=0.8)



# ============================================================
# 焼き芋 — 石の中から焼き芋、割るとほくほく
# ============================================================
def tex_imo_skin():
    img = tex.vgrad((256, 128), (160, 50, 90), (110, 30, 60))
    d = ImageDraw.Draw(img)
    rnd = random.Random(308)
    for i in range(40):
        x, y = rnd.randint(0, 256), rnd.randint(0, 128)
        d.line([(x, y), (x + rnd.randint(4, 14), y + rnd.randint(-2, 2))], fill=(90, 24, 40), width=2)
    return img


def build_yakiimo(cat, key, label):
    b = G.Builder()
    m_skin = K.texmat(b, "imo_skin", tex_imo_skin(), rough=0.8)
    m_flesh = K.col(b, "imo_flesh", (250, 200, 60), rough=0.7, emissive=(0.12, 0.08, 0.0))
    m_stone = K.col(b, "stone", (70, 66, 64), rough=0.95)
    m_cart = K.texmat(b, "imo_cart", tex.wood((256, 256), (120, 76, 40), seed=309), rough=0.8)
    m_ember = glow_mat(b, "ember", (255, 120, 40), 64, 1.3)
    m_noren = K.texmat(b, "imo_noren", tex.panel((256, 128), (240, 236, 226), (220, 214, 200), text="石焼いも", fg=(150, 40, 30)), rough=0.8)
    rnd = random.Random(310)
    stones = K.merge(*[K.transform(K.lumpy(G.sphere(0.07, 10, 6), 0.25, i, 9.0), t=(rnd.uniform(-0.55, 0.55), rnd.uniform(-0.05, 0.08), rnd.uniform(-0.25, 0.25)))
                       for i in range(26)])
    tray = K.transform(K.rounded_box(1.3, 0.2, 0.7, r=0.04, n=2), t=(0, -0.15, 0))
    sign = K.transform(G.plane(0.7, 0.3), t=(0, -0.15, 0.352))
    base_mesh = b.add_mesh([G.prim(tray, m_cart), G.prim(stones, m_stone), G.prim(sign, m_noren)], "oven")
    base = b.add_node("oven", mesh=base_mesh)
    embers = b.add_mesh([G.prim(K.transform(G.plane(1.2, 0.6), r=qx(-90), t=(0, 0.02, 0)), m_ember)], "embers")
    emberN = b.add_node("embers", mesh=embers)
    prof = K.smooth_profile([(0.0, -0.32), (0.08, -0.26), (0.13, -0.05), (0.12, 0.12), (0.07, 0.26), (0.0, 0.32)], 4)
    # 半分ずつ(切り口つき)
    half_prof = [(r, y) for r, y in prof if y <= 0.0] + [(0.0, 0.0)]
    half = K.lathe([(r, y) for r, y in prof if y <= 0.001], 20)
    cut = K.transform(G.disc(0.13, 20), r=qx(-90), t=(0, 0.0, 0))
    h1_mesh = b.add_mesh([G.prim(half, m_skin), G.prim(cut, m_flesh)], "imo_half")
    h_a = b.add_node("imo_a", mesh=h1_mesh, r=qz(90))
    h_b = b.add_node("imo_b", mesh=h1_mesh, r=qz(-90))
    imo = b.add_node("imo", children=[h_a, h_b], t=(0, 0.02, 0.05))
    puffs = steam(b, "imo_steam", 5, (0, 0.2, 0.05), 0.15, 11)
    group = b.add_node("group", children=[base, emberN, imo] + [p_[0] for p_ in puffs], t=(0, -0.2, 0), r=qx(30))

    def action(root):
        return [{"node": imo, "times": [0, 0.3, 0.6, 0.75], "translation": [(0, 0.02, 0.05), (0, 0.02, 0.05), (0, 0.45, 0.25), (0, 0.42, 0.25)],
                 "rotation": [qx(0), qx(0), qx(-40), qx(-35)]},
                {"node": h_a, "times": [0, 0.8, 1.05], "rotation": [qz(90), qz(90), qmul(qz(60), qx(-25))],
                 "translation": [(0, 0, 0), (0, 0, 0), (-0.16, 0.02, 0)]},
                {"node": h_b, "times": [0, 0.8, 1.05], "rotation": [qz(-90), qz(-90), qmul(qz(-60), qx(-25))],
                 "translation": [(0, 0, 0), (0, 0, 0), (0.16, 0.02, 0)]}] + steam_tracks(puffs, 0.2, 0.7, 1.6)

    def idle(root):
        return steam_tracks(puffs, 0.2, 0.6, 1.6)

    return K.finish(b, [group], label, action, idle, badge_at=1.1, badge_pos=(0, 0.55, 0.45), badge_size=0.8)


# ============================================================
# たこ焼き — くるっと返って、1つだけ金色
# ============================================================
def build_takoyaki(cat, key, label):
    b = G.Builder()
    m_iron = K.col(b, "tako_iron", (50, 50, 56), rough=0.4, metal=0.6)
    m_ball = K.col(b, "tako_ball", (210, 140, 60), rough=0.6)
    m_gold = K.col(b, "tako_gold", (250, 200, 60), rough=0.2, metal=0.8, emissive=(0.3, 0.2, 0.0))
    m_sauce = K.col(b, "tako_sauce", (80, 40, 20), rough=0.3)
    m_mayo = K.col(b, "tako_mayo", (250, 246, 220), rough=0.4)
    m_nori = K.col(b, "tako_aonori", (60, 140, 60), rough=0.7)
    m_pick = K.col(b, "tako_pick", (220, 200, 150), rough=0.6)
    plate = K.transform(K.rounded_box(1.3, 0.12, 1.0, r=0.04, n=2), t=(0, -0.08, 0))
    holes = []
    grid = [(-0.4 + i * 0.27, -0.27 + j * 0.27) for j in range(3) for i in range(4)]
    for x, z in grid:
        holes.append(K.transform(K.flip(K.hemisphere(0.11, 16, 5)), r=qx(180), t=(x, -0.02, z)))
    plate_mesh = b.add_mesh([G.prim(K.merge(plate, *holes), m_iron)], "plate")
    plateN = b.add_node("plate", mesh=plate_mesh)
    ball_geo = K.transform(K.lumpy(G.sphere(0.1, 16, 10), 0.04, 3, 10.0), t=(0, 0.02, 0))
    topping = K.merge(K.transform(G.sphere(0.1, 16, 8), s=(1, 0.3, 1), t=(0, 0.08, 0)))
    mayo = K.merge(*[K.transform(G.cylinder(0.009, 0.17 - abs(dz) * 1.2, 5), r=qz(90), t=(0, 0.115 - abs(dz) * 0.3, dz)) for dz in (-0.045, 0, 0.045)])
    nori = K.merge(*[K.transform(G.box(0.02, 0.005, 0.02), t=(math.cos(a) * 0.05, 0.12, math.sin(a) * 0.05)) for a in (0, 1.3, 2.6, 3.9, 5.2)])
    ball_mesh = b.add_mesh([G.prim(ball_geo, m_ball), G.prim(topping, m_sauce), G.prim(mayo, m_mayo), G.prim(nori, m_nori)], "takoyaki")
    gold_mesh = b.add_mesh([G.prim(ball_geo, m_gold), G.prim(topping, m_sauce)], "takoyaki_gold")
    special = 5
    balls = []
    for i, (x, z) in enumerate(grid):
        mesh = gold_mesh if (i == special and WIN(key)) else ball_mesh
        balls.append((b.add_node("ball_%d" % i, mesh=mesh, t=(x, 0.0, z), r=qx(180)), x, z, i))
    pick = K.merge(K.transform(G.cylinder(0.008, 0.5, 6, r_top=0.002), t=(0, 0.25, 0)))
    pick_mesh = b.add_mesh([G.prim(pick, m_pick)], "pick")
    sx, sz = grid[special]
    pickN = b.add_node("pick", mesh=pick_mesh, t=(sx + 0.3, 0.3, sz + 0.2), r=qz(40))
    group = b.add_node("group", children=[plateN, pickN] + [x[0] for x in balls], t=(0, -0.15, 0), r=qx(40))

    def action(root):
        tr = []
        for n, x, z, i in balls:
            t0 = 0.1 + i * 0.05
            tr.append({"node": n, "times": [0, t0, t0 + 0.12, t0 + 0.24], "rotation": [qx(180), qx(180), qx(90), qx(0)]})
        tr.append({"node": balls[special][0], "times": [0, 0.8, 1.05, 1.2],
                   "translation": [(sx, 0, sz), (sx, 0, sz), (sx, 0.4, sz + 0.1), (sx, 0.36, sz + 0.1)],
                   "rotation": [qx(180), qx(0), qx(0), qx(0)]})
        tr.append({"node": pickN, "times": [0, 0.7, 0.85, 1.05], "translation": [(sx + 0.3, 0.3, sz + 0.2), (sx + 0.3, 0.3, sz + 0.2), (sx + 0.05, 0.05, sz + 0.05), (sx + 0.05, 0.45, sz + 0.12)],
                   "rotation": [qz(40), qz(40), qz(15), qz(15)]})
        return tr

    def idle(root):
        return [{"node": n, "times": [0, 0.6, 1.2], "translation": [(x, 0, z), (x, 0.02 * (i % 2), z), (x, 0, z)]} for n, x, z, i in balls]

    return K.finish(b, [group], label, action, idle, badge_at=1.2, badge_pos=(0, 0.5, 0.5), badge_size=0.8)


# ============================================================
# ハンバーガー — 具材が上から積み上がる
# ============================================================
def build_burger(cat, key, label):
    b = G.Builder()
    m_bun = K.col(b, "bun", (220, 150, 70), rough=0.5)
    m_bun_in = K.col(b, "bun_in", (246, 220, 170), rough=0.8)
    m_patty = K.col(b, "patty", (100, 56, 36), rough=0.8)
    m_cheese = K.col(b, "cheese", (250, 200, 50), rough=0.5)
    m_lettuce = K.col(b, "lettuce", (110, 190, 70), rough=0.6)
    m_tomato = K.col(b, "tomato", (220, 50, 40), rough=0.4)
    m_seed = K.col(b, "sesame", (250, 244, 220), rough=0.6)
    m_plate = K.col(b, "burger_plate", (240, 244, 248), rough=0.3)
    top_prof = K.smooth_profile([(0.5, 0.0), (0.49, 0.08), (0.4, 0.2), (0.22, 0.28), (0.0, 0.3)], 4)
    top = K.merge(K.lathe(top_prof, 32), K.transform(G.disc(0.5, 32), r=qx(90)))
    rnd = random.Random(311)
    seeds = K.merge(*[K.transform(G.sphere(0.015, 6, 4), s=(1.6, 0.6, 1), t=(math.cos(a) * r, 0.02 + 0.3 * (1 - (r / 0.5) ** 2) ** 0.7, math.sin(a) * r))
                      for a, r in [(rnd.uniform(0, K.TAU), rnd.uniform(0.05, 0.4)) for _ in range(30)]])
    layers = [
        ("bottom", [G.prim(K.merge(K.transform(G.cylinder(0.5, 0.14, 32), t=(0, 0, 0))), m_bun)], 0.0),
        ("patty", [G.prim(K.transform(K.lumpy(G.cylinder(0.52, 0.12, 32), 0.02, 2, 8.0), t=(0, 0, 0)), m_patty)], 0.13),
        ("cheese", [G.prim(K.transform(G.box(0.95, 0.025, 0.95), r=qy(45)), m_cheese)], 0.21),
        ("tomato", [G.prim(K.merge(*[K.transform(G.cylinder(0.2, 0.04, 20), t=(x, 0, z)) for x, z in ((-0.2, 0.05), (0.2, -0.05))]), m_tomato)], 0.25),
        ("lettuce", [G.prim(K.transform(K.lumpy(G.cylinder(0.56, 0.04, 32), 0.08, 5, 12.0), t=(0, 0, 0)), m_lettuce)], 0.3),
        ("top", [G.prim(top, m_bun), G.prim(seeds, m_seed)], 0.33),
    ]
    plate = K.transform(G.cylinder(0.8, 0.04, 40), t=(0, -0.1, 0))
    plate_mesh = b.add_mesh([G.prim(plate, m_plate)], "plate")
    nodes = [b.add_node("plate", mesh=plate_mesh)]
    stack = []
    for i, (name, prims, y) in enumerate(layers):
        mesh = b.add_mesh(prims, name)
        stack.append((b.add_node(name, mesh=mesh, t=(0, y, 0)), y, i))
    group = b.add_node("group", children=nodes + [s_[0] for s_ in stack], t=(0, -0.35, 0), r=qx(18))

    def action(root):
        tr = []
        for n, y, i in stack:
            t0 = 0.1 + i * 0.16
            tr.append({"node": n, "times": [0, t0, t0 + 0.2, t0 + 0.28],
                       "translation": [(0, y + 1.6, 0), (0, y + 1.6, 0), (0, y - 0.02, 0), (0, y, 0)],
                       "scale": [(0, 0, 0), (1, 1, 1), (1.05, 0.9, 1.05), (1, 1, 1)]})
        return tr

    def idle(root):
        return [{"node": n, "times": [0, 0.5, 1.0], "translation": [(0, y, 0), (0, y + 0.03 * i, 0), (0, y, 0)]} for n, y, i in stack]

    return K.finish(b, [group], label, action, idle, badge_at=1.2, badge_pos=(0, 0.45, 0.5), badge_size=0.8)


# ============================================================
# 郵便ポスト — 当選はがきが飛び出す
# ============================================================
def tex_post_front():
    img = tex.vgrad((256, 512), (230, 40, 40), (180, 20, 24))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 90, 216, 120], 8, fill=(30, 20, 20))
    tex.draw_text(img, "〒", (80, 150, 176, 250), fill=(255, 255, 255), shadow=False)
    tex.draw_text(img, "郵便", (60, 280, 196, 350), fill=(255, 255, 255), shadow=False)
    return img


def tex_postcard(win):
    img = tex.paper((384, 256), (252, 250, 244), seed=312)
    d = ImageDraw.Draw(img)
    d.rectangle([300, 14, 370, 94], outline=(200, 40, 40), width=4)
    for i in range(7):
        d.rectangle([20 + i * 34, 20, 46 + i * 34, 50], outline=(200, 40, 40), width=2)
    tex.draw_text(img, "当選通知" if win else "お知らせ", (40, 110, 344, 200), fill=(40, 40, 60), path=SERIF, shadow=False)
    return img


def build_postbox(cat, key, label):
    b = G.Builder()
    m_red = K.col(b, "post_red", (220, 36, 36), rough=0.35)
    m_front = K.texmat(b, "post_front", tex_post_front(), rough=0.35)
    m_dark = K.col(b, "post_dark", (40, 30, 30), rough=0.6)
    m_card = K.texmat(b, "postcard", tex_postcard(WIN(key)), rough=0.7)
    m_glow = glow_mat(b, "post_glow", (255, 236, 170), 128, 1.8)
    body = K.transform(G.cylinder(0.32, 1.1, 32), t=(0, 0, 0))
    dome = K.transform(K.hemisphere(0.34, 32, 8), t=(0, 0.55, 0), s=(1, 0.55, 1))
    base = K.transform(G.cylinder(0.36, 0.08, 32), t=(0, -0.56, 0))
    front = K.transform(G.plane(0.4, 0.8), t=(0, 0.05, 0.321))
    body_mesh = b.add_mesh([G.prim(K.merge(body, dome), m_red), G.prim(base, m_dark), G.prim(front, m_front)], "postbox")
    boxN = b.add_node("postbox", mesh=body_mesh)
    card_mesh = b.add_mesh([G.prim(G.plane(0.6, 0.4), m_card), G.prim(K.transform(G.back(G.plane(0.6, 0.4)), t=(0, 0, -0.004)), m_card)], "postcard")
    card = b.add_node("postcard", mesh=card_mesh, t=(0, 0.35, 0.3), s=(0.4, 0.05, 0.4))
    glow_mesh = b.add_mesh([G.prim(G.plane(1.3, 1.0), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, 0.85, 0.1), s=(0, 0, 0))
    group = b.add_node("group", children=[glow, boxN, card], t=(0, -0.3, 0))

    def action(root):
        return [{"node": boxN, "times": [0, 0.15, 0.3, 0.45, 0.6], "scale": [(1, 1, 1), (1.04, 0.95, 1.04), (0.98, 1.04, 0.98), (1.02, 0.98, 1.02), (1, 1, 1)]},
                {"node": card, "times": [0, 0.55, 0.9, 1.1, 1.2],
                 "translation": [(0, 0.35, 0.3), (0, 0.35, 0.3), (0.1, 1.2, 0.5), (0, 1.0, 0.45), (0, 1.02, 0.45)],
                 "scale": [(0.4, 0.05, 0.4), (0.4, 0.05, 0.4), (1.2, 1.2, 1.2), (1.3, 1.3, 1.3), (1.3, 1.3, 1.3)],
                 "rotation": [qz(0), qz(0), qz(200), qz(360), qz(360)]},
                {"node": glow, "times": [0, 0.9, 1.1, 1.4], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (1,) * 3]}]

    def idle(root):
        return [{"node": boxN, "times": [0, 0.3, 0.6, 1.4], "rotation": [qz(0), qz(3), qz(-3), qz(0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.2, badge_pos=(0, 0.02, 0.62), badge_size=0.8)


# ============================================================
# 紅葉 — 葉が舞い散り、真ん中に結果
# ============================================================
def maple_points(size=0.12):
    pts = []
    for i in range(10):
        a = deg(90 + i * 36)
        r = size if i % 2 == 0 else size * 0.42
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


def build_momiji(cat, key, label):
    b = G.Builder()
    leaf_cols = [(220, 60, 30), (240, 140, 30), (200, 30, 40), (250, 190, 50)]
    leaf_ms = [K.col(b, "leaf_%d" % i, c, rough=0.6) for i, c in enumerate(leaf_cols)]
    m_trunk = K.texmat(b, "trunk", tex.wood((128, 256), (90, 60, 40), seed=313, vertical=True), rough=0.9)
    m_ground = K.col(b, "momiji_ground", (140, 100, 60), rough=0.95)
    m_crown = K.col(b, "crown", (210, 70, 40), rough=0.7)
    m_crown2 = K.col(b, "crown2", (240, 150, 40), rough=0.7)
    leaf = K.extrude(maple_points(0.1), 0.01)
    leaf_meshes = [b.add_mesh([G.prim(leaf, m)], "leaf_%d" % i) for i, m in enumerate(leaf_ms)]
    trunk = K.tube([(0, -0.75, 0), (0.02, -0.4, 0), (-0.02, -0.1, 0)], 0.07, 10)
    branches = K.merge(K.tube([(-0.02, -0.2, 0), (-0.3, 0.05, 0)], 0.03, 8), K.tube([(0, -0.25, 0), (0.28, 0.02, 0)], 0.03, 8))
    crown = K.merge(*[K.transform(K.lumpy(G.sphere(r, 14, 8), 0.12, i, 6.0), t=(x, y, 0)) for i, (x, y, r) in
                      enumerate(((-0.3, 0.15, 0.28), (0.3, 0.15, 0.28), (0, 0.32, 0.34)))])
    crown2 = K.merge(*[K.transform(K.lumpy(G.sphere(r, 12, 8), 0.12, i + 9, 6.0), t=(x, y, 0.1)) for i, (x, y, r) in
                       enumerate(((-0.12, 0.05, 0.2), (0.16, 0.36, 0.2)))])
    ground = K.transform(G.cylinder(0.9, 0.06, 36), t=(0, -0.78, 0), s=(1, 1, 0.5))
    tree_mesh = b.add_mesh([G.prim(K.merge(trunk, branches), m_trunk), G.prim(crown, m_crown), G.prim(crown2, m_crown2), G.prim(ground, m_ground)], "tree")
    tree = b.add_node("tree", mesh=tree_mesh)
    rnd = random.Random(314)
    leaves = []
    for i in range(18):
        x0, y0 = rnd.uniform(-0.5, 0.5), rnd.uniform(0.0, 0.4)
        x1, y1 = rnd.uniform(-0.9, 0.9), rnd.uniform(-0.75, -0.7)
        leaves.append((b.add_node("fall_%d" % i, mesh=leaf_meshes[i % 4], t=(x0, y0, 0.3), s=(0, 0, 0)), (x0, y0), (x1, y1),
                       rnd.uniform(-300, 300), rnd.uniform(0, 0.5)))
    group = b.add_node("group", children=[tree] + [l[0] for l in leaves], t=(0, 0.05, 0))

    def action(root):
        tr = [{"node": tree, "times": [0, 0.15, 0.3, 0.45, 0.6], "rotation": [qz(a) for a in (0, 3, -3, 2, 0)]}]
        for n, (x0, y0), (x1, y1), spin, ph in leaves:
            t0 = 0.2 + ph
            tr.append({"node": n, "times": [0, t0, t0 + 0.5, t0 + 1.1],
                       "translation": [(x0, y0, 0.3), (x0, y0, 0.3), ((x0 + x1) / 2 + 0.15, (y0 + y1) / 2, 0.35), (x1, y1, 0.3)],
                       "rotation": [qz(0), qz(0), qmul(qz(spin / 2), qx(50)), qmul(qz(spin), qx(80))],
                       "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        tr = []
        for n, (x0, y0), (x1, y1), spin, ph in leaves[:8]:
            tr.append({"node": n, "times": [0, 0.8 + ph, 2.4], "translation": [(x0, y0, 0.3), ((x0 + x1) / 2, (y0 + y1) / 2, 0.3), (x1, y1, 0.3)],
                       "rotation": [qz(0), qz(spin / 2), qz(spin)], "scale": [(1, 1, 1), (1, 1, 1), (0, 0, 0)]})
        return tr

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.95, 0.45), badge_size=0.82)

BUILDERS = {
    "balloon": build_balloon,
    "golf": build_golf,
    "baseball": build_baseball,
    "cards": build_cards,
    "saisen": build_saisen,
    "yakiimo": build_yakiimo,
    "takoyaki": build_takoyaki,
    "burger": build_burger,
    "postbox": build_postbox,
    "momiji": build_momiji,
}
