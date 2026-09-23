# -*- coding: utf-8 -*-
"""旧29カテゴリ(Blender製)の作り直し。
#
# 旧モデルは三角形が22〜900枚ほどしかなく(サイコロは箱1つ、宝箱・手裏剣は46枚)、
# 多くは本体の手前に黄色い放射状の板(chest_glow / explosion_burst)を立てて
# 本体が隠れていた。カテゴリ名とファイル名はそのままに、形と動きを作り直す。
#
# 出力は build.py と同じ約束:
#   <cat>_<tier>_3d.glb(10等級 + cookie) と <cat>_suspense_3d.glb
#   正面が+Z、上が+Y。結果はバッジが飛び出して終わる(ループしない)。
#   焦らしはループする。
"""
import math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)

import glbwrite as G
import tex
import kit as K
from kit import deg, qx, qy, qz, qmul
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = tex.FONT_SERIF
SANS = tex.FONT

GOLD = (214, 170, 72)
RED = (200, 32, 38)
WHITE = (246, 244, 238)


def gold(b, name="gold"):
    return K.col(b, name, GOLD, rough=0.32, metal=0.75)


def canvas(size=(512, 512), rgb=(255, 255, 255)):
    return Image.new("RGB", size, rgb)


# ============================================================
# サイコロ — 転がってきて止まる
# ============================================================
PIPS = {
    1: [(0, 0)],
    2: [(-1, 1), (1, -1)],
    3: [(-1, 1), (0, 0), (1, -1)],
    4: [(-1, 1), (1, 1), (-1, -1), (1, -1)],
    5: [(-1, 1), (1, 1), (0, 0), (-1, -1), (1, -1)],
    6: [(-1, 1), (1, 1), (-1, 0), (1, 0), (-1, -1), (1, -1)],
}


def build_dice(cat, key, label):
    b = G.Builder()
    S = 0.86
    m_body = K.col(b, "dice_body", (250, 249, 244), rough=0.35)
    m_pip = K.col(b, "dice_pip", (28, 30, 38), rough=0.5)
    m_red = K.col(b, "dice_pip_red", (214, 28, 40), rough=0.45)
    body = K.rounded_box(S, S, S, r=0.13, n=5, face_uv=False)
    # 面: +Z=1, -Z=6, +X=3, -X=4, +Y=2, -Y=5(向かい合う面の和が7)
    faces = [((0, 0, 1), (1, 0, 0), (0, 1, 0), 1), ((0, 0, -1), (-1, 0, 0), (0, 1, 0), 6),
             ((1, 0, 0), (0, 0, -1), (0, 1, 0), 3), ((-1, 0, 0), (0, 0, 1), (0, 1, 0), 4),
             ((0, 1, 0), (1, 0, 0), (0, 0, -1), 2), ((0, -1, 0), (1, 0, 0), (0, 0, 1), 5)]
    black, red = [], []
    step = S * 0.25
    for N, U, V, n in faces:
        rr = 0.105 if n == 1 else 0.068
        for (a, c) in PIPS[n]:
            p = [N[k] * (S / 2 + 0.003) + U[k] * a * step + V[k] * c * step for k in range(3)]
            # 目は面に貼った円。球にすると頂点が増えてファイルが重くなる(1個230頂点)
            pip = G.disc(rr, 28)
            # 面の法線方向へ向ける
            if N == (0, 0, 1):
                q = None
            elif N == (0, 0, -1):
                q = qy(180)
            elif N == (1, 0, 0):
                q = qy(90)
            elif N == (-1, 0, 0):
                q = qy(-90)
            elif N == (0, 1, 0):
                q = qx(-90)
            else:
                q = qx(90)
            g = K.transform(pip, r=q, t=tuple(p))
            (red if n == 1 else black).append(g)
    mesh = b.add_mesh([G.prim(body, m_body), G.prim(K.merge(*black), m_pip),
                       G.prim(K.merge(*red), m_red)], "die")
    die = b.add_node("die", mesh=mesh)
    holder = b.add_node("holder", children=[die], t=(0, -0.25, 0))

    def action(root):
        # 上から落ちてきて2回弾み、1の目を正面に向けて止まる
        ts = [0.0, 0.25, 0.5, 0.7, 0.88, 1.0, 1.1]
        ys = [1.6, 0.4, -0.25, 0.05, -0.25, -0.18, -0.25]
        rots = [qmul(qx(-540), qz(200)), qmul(qx(-360), qz(140)), qmul(qx(-200), qz(60)),
                qmul(qx(-80), qz(20)), qmul(qx(-10), qz(4)), qx(0), qx(0)]
        return [{"node": holder, "times": ts, "translation": [(0, y, 0) for y in ys]},
                {"node": die, "times": ts, "rotation": rots}]

    def idle(root):
        ks = K.spin_keys((0.4, 1, 0.25), 1)
        n = len(ks) - 1
        return [{"node": die, "times": [1.8 * i / n for i in range(n + 1)], "rotation": ks}] + \
            K.idle_bob(holder, 0.08, 1.8, base=(0, -0.25, 0))

    return K.finish(b, [holder], label, action, idle, badge_at=1.15, badge_pos=(0, 0.38, 0.62))


# ============================================================
# 宝箱 — フタが開いて金貨がのぞく
# ============================================================
def tex_chest_wood():
    img = tex.wood((512, 512), (132, 78, 38), seed=31)
    d = ImageDraw.Draw(img)
    for y in (0, 170, 340):
        d.line([(0, y), (512, y)], fill=(70, 38, 16), width=5)
    return tex.vignette(img, 0.35)


def build_treasure(cat, key, label):
    b = G.Builder()
    m_wood = K.texmat(b, "chest_wood", tex_chest_wood(), rough=0.72)
    m_gold = gold(b)
    m_dark = K.col(b, "chest_inside", (38, 20, 10), rough=0.95)
    m_coin = K.col(b, "coin", (245, 196, 70), rough=0.28, metal=0.8, emissive=(0.18, 0.12, 0.0))
    m_gem_r = K.col(b, "gem_red", (220, 20, 60), rough=0.12, metal=0.1, emissive=(0.25, 0.0, 0.05))
    m_gem_b = K.col(b, "gem_blue", (40, 120, 235), rough=0.12, metal=0.1, emissive=(0.0, 0.05, 0.25))

    W, H, D = 1.24, 0.6, 0.76
    body = K.rounded_box(W, H, D, r=0.05, n=3)
    # 胴の内側(フタが開いた時に見える暗い底)
    inner = K.transform(G.box(W - 0.1, 0.02, D - 0.1), t=(0, H / 2 - 0.02, 0))
    bands = [K.transform(G.box(0.09, H + 0.02, D + 0.03), t=(x, 0, 0))
             for x in (-W / 2 + 0.16, W / 2 - 0.16)]
    rim = K.transform(G.box(W + 0.03, 0.06, D + 0.03), t=(0, H / 2 - 0.03, 0))
    lockplate = K.transform(K.rounded_box(0.2, 0.24, 0.05, r=0.03, n=2), t=(0, H / 2 - 0.12, D / 2 + 0.02))
    keyhole = K.transform(G.cylinder(0.03, 0.02, 16), r=qx(90), t=(0, H / 2 - 0.11, D / 2 + 0.05))
    body_mesh = b.add_mesh([G.prim(body, m_wood), G.prim(inner, m_dark),
                            G.prim(K.merge(*bands, rim, lockplate), m_gold)], "chest_body")

    # 中身: 金貨の山と宝石(フタが開くと見える)
    rnd = random.Random(7)
    coins = []
    # はずれ・参加賞で金貨の山は変なので、数枚だけにする
    n_coins = 5 if key in ("hazure", "cookie") else 22
    for i in range(n_coins):
        x = rnd.uniform(-W / 2 + 0.14, W / 2 - 0.14)
        z = rnd.uniform(-D / 2 + 0.14, D / 2 - 0.14)
        mound = (0.12 if n_coins > 5 else 0.0) * (1 - (x / (W / 2)) ** 2) * (1 - (z / (D / 2)) ** 2)
        c = K.transform(G.cylinder(0.075, 0.018, 12), t=(x, H / 2 - 0.03 + mound + rnd.uniform(0, 0.04), z),
                        r=qmul(qx(rnd.uniform(-25, 25)), qz(rnd.uniform(-25, 25))))
        coins.append(c)
    gems_r = K.transform(G.sphere(0.07, 16, 10), t=(-0.18, H / 2 + 0.14, 0.05), s=(1, 0.8, 1))
    gems_b = K.transform(G.sphere(0.06, 16, 10), t=(0.22, H / 2 + 0.12, -0.05), s=(1, 0.8, 1))
    loot_parts = [G.prim(K.merge(*coins), m_coin)]
    if n_coins > 5:
        loot_parts += [G.prim(gems_r, m_gem_r), G.prim(gems_b, m_gem_b)]
    loot_mesh = b.add_mesh(loot_parts, "loot")

    # フタ: 半円柱(X方向に伸びる)
    half = [(math.cos(math.pi * i / 24) * D / 2, math.sin(math.pi * i / 24) * 0.3) for i in range(25)]
    lid_geo = K.transform(K.extrude(half, W), r=qy(90))
    lid_band = [K.transform(K.extrude(
        [(math.cos(math.pi * i / 24) * (D / 2 + 0.018), math.sin(math.pi * i / 24) * 0.318) for i in range(25)],
        0.09), r=qy(90), t=(x, 0, 0)) for x in (-W / 2 + 0.16, W / 2 - 0.16)]
    lid_mesh = b.add_mesh([G.prim(lid_geo, m_wood), G.prim(K.merge(*lid_band), m_gold)], "chest_lid")
    lid = b.add_node("lid", mesh=lid_mesh, t=(0, 0, D / 2))
    hinge = b.add_node("hinge", t=(0, H / 2, -D / 2), children=[lid])

    chest = b.add_node("chest", mesh=body_mesh)
    loot = b.add_node("loot", mesh=loot_mesh)
    group = b.add_node("group", children=[chest, loot, hinge], t=(0, -0.3, 0), r=qx(12))

    def action(root):
        return [
            {"node": group, "times": [0, 0.15, 0.3, 0.45, 0.6],
             "rotation": [qx(12), qmul(qx(12), qz(-4)), qmul(qx(12), qz(4)), qmul(qx(12), qz(-2)), qx(12)]},
            {"node": hinge, "times": [0, 0.55, 0.85, 1.0, 1.1],
             "rotation": [qx(0), qx(0), qx(-118), qx(-100), qx(-106)]},
            K.bump(group, 0.85, 0.06, base=(0, -0.3, 0)),
        ]

    def idle(root):
        return [{"node": hinge, "times": [0, 0.3, 0.45, 0.6, 1.4],
                 "rotation": [qx(0), qx(-14), qx(-4), qx(0), qx(0)]},
                {"node": group, "times": [0, 0.3, 0.6, 1.4],
                 "translation": [(0, -0.3, 0), (0, -0.25, 0), (0, -0.3, 0), (0, -0.3, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.42, 0.55))


# ============================================================
# ボックス抽選 — 抽選箱から三角くじが飛び出して開く
# ============================================================
def tex_lottery_box():
    img = tex.vgrad((512, 512), (228, 44, 50), (160, 18, 26))
    img = tex.grain(img, 5, 41)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 512, 26], fill=(250, 244, 230))
    d.rectangle([0, 486, 512, 512], fill=(250, 244, 230))
    d.rounded_rectangle([60, 150, 452, 360], 24, fill=(252, 248, 238), outline=(212, 170, 70), width=8)
    tex.draw_text(img, "抽選箱", (90, 170, 422, 340), fill=(196, 26, 32), path=SERIF, shadow=False)
    return tex.vignette(img, 0.25)


def tex_lottery_side():
    img = tex.vgrad((512, 512), (220, 40, 46), (158, 18, 24))
    img = tex.grain(img, 5, 42)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 512, 26], fill=(250, 244, 230))
    d.rectangle([0, 486, 512, 512], fill=(250, 244, 230))
    for i in range(5):
        d.ellipse([90 + i * 70, 236, 120 + i * 70, 266], fill=(248, 204, 90))
    return tex.vignette(img, 0.3)


def build_box(cat, key, label):
    b = G.Builder()
    m_front = K.texmat(b, "lotbox_front", tex_lottery_box(), rough=0.55)
    m_side = K.texmat(b, "lotbox_side", tex_lottery_side(), rough=0.55)
    m_top = K.col(b, "lotbox_top", (246, 240, 226), rough=0.6)
    m_hole = K.col(b, "lotbox_hole", (18, 10, 8), rough=1.0)
    m_ticket = K.texmat(b, "ticket", tex.paper((256, 256), (255, 250, 236), seed=5), rough=0.8)
    m_ticket2 = K.col(b, "ticket_back", (238, 90, 90), rough=0.7)
    W = 1.06
    # 面ごとに絵を変えるため、板を組んで箱にする(角は金の縁で隠す)
    front = K.transform(G.plane(W, W), t=(0, 0, W / 2))
    back_ = K.transform(G.plane(W, W), t=(0, 0, -W / 2), r=qy(180))
    right = K.transform(G.plane(W, W), t=(W / 2, 0, 0), r=qy(90))
    left = K.transform(G.plane(W, W), t=(-W / 2, 0, 0), r=qy(-90))
    top = K.transform(G.ring(W * 0.7, 0.2, 64), r=qx(-90), t=(0, W / 2, 0), s=(1, 1, 1))
    top_sq = K.transform(G.plane(W, W), t=(0, W / 2 - 0.001, 0), r=qx(-90))
    hole = K.transform(G.disc(0.2, 48), r=qx(-90), t=(0, W / 2 + 0.002, 0))
    edges = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            edges.append(K.transform(G.cylinder(0.026, W + 0.04, 12), t=(sx * W / 2, 0, sz * W / 2)))
        for y in (-1, 1):
            edges.append(K.transform(G.cylinder(0.026, W + 0.04, 12), r=qx(90), t=(sx * W / 2, y * W / 2, 0)))
    for y in (-1, 1):
        for sz in (-1, 1):
            edges.append(K.transform(G.cylinder(0.026, W + 0.04, 12), r=qz(90), t=(0, y * W / 2, sz * W / 2)))
    m_gold = gold(b)
    box_mesh = b.add_mesh([G.prim(front, m_front), G.prim(K.merge(back_, right, left), m_side),
                           G.prim(top_sq, m_top), G.prim(hole, m_hole), G.prim(K.merge(*edges), m_gold)],
                          "lotbox")
    box = b.add_node("box", mesh=box_mesh, r=qx(14))
    # 三角くじ(二つ折り)
    tw, th = 1.0, 0.62
    tk_mesh = b.add_mesh([G.prim(K.transform(G.plane(tw, th), t=(0, 0, 0.007)), m_ticket),
                          G.prim(K.transform(G.plane(tw, th), t=(0, 0, -0.007), r=qy(180)), m_ticket2)],
                         "ticket")
    ticket = b.add_node("ticket", mesh=tk_mesh, t=(0, 0.2, 0), s=(0.2, 0.2, 0.2))
    group = b.add_node("group", children=[box, ticket], t=(0, -0.35, 0))

    def action(root):
        return [
            {"node": box, "times": [0, 0.12, 0.24, 0.36, 0.48, 0.6],
             "rotation": [qx(14), qmul(qx(14), qz(-5)), qmul(qx(14), qz(5)), qmul(qx(14), qz(-4)),
                          qmul(qx(14), qz(3)), qx(14)]},
            {"node": ticket, "times": [0, 0.6, 0.85, 1.05],
             "translation": [(0, 0.2, 0), (0, 0.2, 0), (0, 1.02, 0.3), (0, 0.98, 0.34)],
             "scale": [(0.2,) * 3, (0.2,) * 3, (1, 1, 1), (1, 1, 1)],
             "rotation": [qx(-90), qx(-90), qx(10), qx(0)]},
        ]

    def idle(root):
        return [{"node": box, "times": [0, 0.1, 0.2, 0.3, 0.4, 1.3],
                 "rotation": [qx(14), qmul(qx(14), qz(-5)), qmul(qx(14), qz(5)), qmul(qx(14), qz(-3)),
                              qx(14), qx(14)]}]

    # 結果は飛び出したくじの紙面に出す
    return K.finish(b, [group], label, action, idle, badge_at=1.05, badge_pos=(0, 0.63, 0.37),
                    badge_size=0.74)



# ============================================================
# ガチャガチャ — ハンドルを回すとカプセルが出てきて開く
# ============================================================
def tex_gacha_front():
    img = tex.vgrad((512, 512), (236, 62, 70), (176, 26, 40))
    img = tex.grain(img, 5, 51)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, 472, 150], 30, fill=(255, 246, 222))
    tex.draw_text(img, "ガチャ", (70, 50, 442, 140), fill=(210, 36, 50), shadow=False)
    # 取り出し口の枠
    d.rounded_rectangle([150, 360, 362, 480], 26, fill=(60, 16, 22))
    d.rounded_rectangle([150, 360, 362, 480], 26, outline=(255, 214, 110), width=8)
    return tex.vignette(img, 0.25)


CAPSULE_COLORS = [(236, 64, 90), (60, 150, 240), (250, 196, 40), (80, 200, 120), (170, 90, 220), (255, 140, 50)]


def build_gacha(cat, key, label):
    b = G.Builder()
    m_front = K.texmat(b, "gacha_front", tex_gacha_front(), rough=0.45)
    m_red = K.col(b, "gacha_red", (206, 36, 50), rough=0.4)
    m_glass = K.col(b, "gacha_glass", (220, 236, 255), rough=0.05, alpha=0.26)
    m_silver = K.col(b, "gacha_silver", (206, 212, 220), rough=0.25, metal=0.85)
    m_white = K.col(b, "capsule_white", (248, 248, 246), rough=0.3)
    caps_m = [K.col(b, "capsule_%d" % i, c, rough=0.3) for i, c in enumerate(CAPSULE_COLORS)]

    W, H, D = 1.0, 0.78, 0.74
    body = K.rounded_box(W, H, D, r=0.08, n=3)
    front = K.transform(G.plane(W - 0.08, H - 0.08), t=(0, 0, D / 2 + 0.002))
    dome_ring = K.transform(G.torus(0.47, 0.035, 40, 8), t=(0, H / 2 + 0.01, 0))
    dome = K.transform(G.sphere(0.5, 28, 14), t=(0, H / 2 + 0.42, 0))
    knob = K.transform(G.cylinder(0.15, 0.07, 32), r=qx(90), t=(0, 0, 0.035))
    bar = K.transform(K.rounded_box(0.34, 0.07, 0.07, r=0.03, n=2), t=(0, 0, 0.09))
    body_mesh = b.add_mesh([G.prim(body, m_red), G.prim(front, m_front), G.prim(dome_ring, m_silver)], "gacha_body")
    dome_mesh = b.add_mesh([G.prim(dome, m_glass)], "gacha_dome")
    knob_mesh = b.add_mesh([G.prim(K.merge(knob, bar), m_silver)], "gacha_knob")

    # ドームの中のカプセル
    rnd = random.Random(3)
    parts = {i: [] for i in range(len(CAPSULE_COLORS))}
    whites = []
    for i in range(9):
        a = rnd.uniform(0, K.TAU)
        rr = rnd.uniform(0.05, 0.28)
        x, z = math.cos(a) * rr, math.sin(a) * rr
        y = H / 2 + 0.14 + rnd.uniform(0, 0.2) + (0.12 if rr < 0.18 else 0)
        q = qmul(qx(rnd.uniform(-60, 60)), qz(rnd.uniform(-60, 60)))
        parts[i % len(CAPSULE_COLORS)].append(K.transform(K.hemisphere(0.11, 12, 4), r=q, t=(x, y, z)))
        whites.append(K.transform(K.hemisphere(0.11, 12, 4, top=False), r=q, t=(x, y, z)))
    inner_prims = [G.prim(K.merge(*v), caps_m[k]) for k, v in parts.items() if v]
    inner_prims.append(G.prim(K.merge(*whites), m_white))
    inner_mesh = b.add_mesh(inner_prims, "capsules")

    # 当たりのカプセル(出てきて開く)
    prize_col = caps_m[0] if key in ("1tou", "ohatari", "atari") else caps_m[1]
    top_mesh = b.add_mesh([G.prim(K.transform(K.hemisphere(0.2, 28, 8), t=(0, 0, 0.2)), prize_col)], "prize_top")
    bot_mesh = b.add_mesh([G.prim(K.hemisphere(0.2, 28, 8, top=False), m_white)], "prize_bottom")
    cap_top = b.add_node("prize_top", mesh=top_mesh, t=(0, 0, -0.2))  # 後ろ側を蝶番にする
    cap_bot = b.add_node("prize_bottom", mesh=bot_mesh)
    capsule = b.add_node("prize", children=[cap_bot, cap_top], t=(0, -0.2, 0.25), s=(0, 0, 0))

    machine = b.add_node("machine", mesh=body_mesh)
    inner = b.add_node("inner", mesh=inner_mesh)
    domeN = b.add_node("dome", mesh=dome_mesh)
    knobN = b.add_node("knob", mesh=knob_mesh, t=(0, 0.06, D / 2 + 0.01))
    group = b.add_node("group", children=[machine, inner, domeN, knobN, capsule], t=(0, -0.45, 0))

    def action(root):
        ks = K.spin_keys((0, 0, 1), -1)
        n = len(ks) - 1
        return [
            {"node": knobN, "times": [0.1 + 0.7 * i / n for i in range(n + 1)], "rotation": ks},
            {"node": inner, "times": [0, 0.3, 0.5, 0.7, 0.9],
             "translation": [(0, 0, 0), (0.02, 0.03, 0), (-0.02, 0, 0), (0.01, 0.02, 0), (0, 0, 0)]},
            {"node": capsule, "times": [0, 0.85, 1.0, 1.2, 1.35],
             "translation": [(0, -0.2, 0.25), (0, -0.2, 0.25), (0, -0.05, 0.62), (0, 0.18, 0.72), (0, 0.16, 0.72)],
             "scale": [(0, 0, 0), (0.3,) * 3, (1, 1, 1), (1.1, 1.1, 1.1), (1, 1, 1)]},
            {"node": cap_top, "times": [0, 1.3, 1.5, 1.6],
             "rotation": [qx(0), qx(0), qx(-128), qx(-115)]},
        ]

    def idle(root):
        return [{"node": knobN, "times": [0, 0.4, 0.8], "rotation": [qz(0), qz(-60), qz(0)]},
                {"node": inner, "times": [0, 0.2, 0.4, 0.6, 0.8],
                 "translation": [(0, 0, 0), (0.015, 0.02, 0), (0, 0, 0), (-0.015, 0.02, 0), (0, 0, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.5, badge_pos=(0, 0.02, 0.9), badge_size=0.78)


# ============================================================
# スロット — レバーを引くとリールが回り、7がそろう
# ============================================================
REEL_SYMBOLS = ["7", "BAR", "🍒", "ベル", "7", "★", "BAR", "🍋"]


def _symbol_tile(sym, size=128):
    img = Image.new("RGB", (size, size), (252, 250, 244))
    d = ImageDraw.Draw(img)
    if sym == "7":
        tex.draw_text(img, "7", (10, 6, size - 10, size - 6), fill=(222, 28, 40), stroke=(120, 10, 16),
                      stroke_w=5, shadow=False)
    elif sym == "BAR":
        d.rounded_rectangle([12, 38, size - 12, size - 38], 10, fill=(30, 30, 40))
        tex.draw_text(img, "BAR", (20, 42, size - 20, size - 42), fill=(255, 255, 255), shadow=False)
    elif sym == "🍒":
        d.line([(64, 20), (40, 70)], fill=(40, 120, 40), width=6)
        d.line([(64, 20), (88, 74)], fill=(40, 120, 40), width=6)
        d.ellipse([18, 62, 62, 106], fill=(210, 20, 40))
        d.ellipse([66, 66, 110, 110], fill=(210, 20, 40))
    elif sym == "🍋":
        d.ellipse([20, 34, 108, 94], fill=(250, 214, 40), outline=(200, 160, 20), width=4)
    elif sym == "ベル":
        d.pieslice([30, 26, 98, 110], 180, 360, fill=(246, 190, 30))
        d.rectangle([30, 66, 98, 92], fill=(246, 190, 30))
        d.ellipse([54, 88, 74, 108], fill=(200, 140, 20))
    else:
        d.polygon(K.star_points(5, 50, 20, rot=-90) and
                  [(64 + x, 64 + y) for x, y in K.star_points(5, 52, 22, rot=-90)], fill=(250, 190, 30))
    return img


def tex_reel():
    # 1周ぶんの帯。u(横)=周方向=画面の下向き、v(縦)=画面の右向き になるので、
    # 図柄は転置して並べる(_slot_reel_angle の説明参照)。
    n = len(REEL_SYMBOLS)
    strip = Image.new("RGB", (128, 128 * n), (252, 250, 244))
    for i, sym in enumerate(REEL_SYMBOLS):
        strip.paste(_symbol_tile(sym), (0, i * 128))
        ImageDraw.Draw(strip).line([(0, i * 128), (128, i * 128)], fill=(210, 206, 196), width=3)
    return strip.transpose(Image.TRANSPOSE)


def _slot_reel_angle(idx):
    """図柄idxを正面に向けるためのX軸回りの角度(度)。"""
    n = len(REEL_SYMBOLS)
    a_k = 360.0 * (idx + 0.5) / n
    return 90.0 - a_k


def tex_slot_cabinet():
    img = tex.vgrad((512, 512), (130, 20, 36), (70, 8, 20))
    img = tex.grain(img, 5, 61)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([30, 26, 482, 120], 24, fill=(255, 214, 90))
    tex.draw_text(img, "LUCKY 777", (54, 34, 458, 112), fill=(170, 18, 30), shadow=False)
    for i in range(14):
        x = 36 + i * 32
        d.ellipse([x, 134, x + 16, 150], fill=(255, 236, 150))
    return tex.vignette(img, 0.3)


def build_slot(cat, key, label):
    b = G.Builder()
    m_cab = K.texmat(b, "slot_cabinet", tex_slot_cabinet(), rough=0.4)
    m_body = K.col(b, "slot_body", (110, 14, 30), rough=0.45)
    m_gold = gold(b)
    m_window = K.col(b, "slot_window", (18, 16, 22), rough=0.9)
    m_reel = K.texmat(b, "slot_reel", tex_reel(), rough=0.5, colors=64)
    m_knob = K.col(b, "slot_knob", (230, 30, 40), rough=0.25)
    m_chrome = K.col(b, "slot_chrome", (210, 214, 222), rough=0.2, metal=0.9)

    W, H, D = 1.3, 1.34, 0.62
    cab = K.rounded_box(W, H, D, r=0.07, n=3)
    face = K.transform(G.plane(W - 0.1, H - 0.1), t=(0, 0, D / 2 + 0.002))
    window = K.transform(K.rounded_box(W - 0.22, 0.5, 0.04, r=0.04, n=2), t=(0, -0.05, D / 2 - 0.005))
    frame = K.transform(K.extrude(K.rounded_rect_points(W - 0.14, 0.58, 0.07), 0.03), t=(0, -0.05, D / 2 + 0.01))
    cut = K.extrude(K.rounded_rect_points(W - 0.24, 0.48, 0.05), 0.04)
    tray = K.transform(K.rounded_box(0.9, 0.12, 0.22, r=0.04, n=2), t=(0, -H / 2 + 0.1, D / 2 + 0.06))
    cab_mesh = b.add_mesh([G.prim(cab, m_body), G.prim(face, m_cab), G.prim(window, m_window),
                           G.prim(tray, m_gold)], "slot_cabinet")
    # 窓の金縁(中を抜いた枠)は4本の棒で作る
    fw, fh = W - 0.18, 0.56
    bars = [K.transform(G.cylinder(0.022, fw, 10), r=qz(90), t=(0, -0.05 + y * fh / 2, D / 2 + 0.02)) for y in (-1, 1)] + \
           [K.transform(G.cylinder(0.022, fh, 10), t=(x * fw / 2, -0.05, D / 2 + 0.02)) for x in (-1, 1)]
    frame_mesh = b.add_mesh([G.prim(K.merge(*bars), m_gold)], "slot_frame")

    reel_geo = K.transform(G.cylinder(0.3, 0.3, 40, caps=True), r=qz(90))
    reel_mesh = b.add_mesh([G.prim(reel_geo, m_reel)], "slot_reel")
    reels = []
    for i, x in enumerate((-0.36, 0, 0.36)):
        reels.append(b.add_node("reel_%d" % i, mesh=reel_mesh, t=(x, -0.05, D / 2 - 0.26)))

    lever_arm = K.tube([(0, 0, 0), (0.08, 0.12, 0), (0.1, 0.42, 0)], 0.028, 12)
    lever_knob = K.transform(G.sphere(0.08, 20, 12), t=(0.1, 0.46, 0))
    lever_mesh = b.add_mesh([G.prim(lever_arm, m_chrome), G.prim(lever_knob, m_knob)], "slot_lever")
    lever = b.add_node("lever", mesh=lever_mesh, t=(W / 2 + 0.02, -0.05, 0))

    cabinet = b.add_node("cabinet", mesh=cab_mesh)
    frameN = b.add_node("frame", mesh=frame_mesh)
    group = b.add_node("group", children=[cabinet, frameN, lever] + reels, t=(0, -0.25, 0))

    win = key not in ("hazure", "cookie")
    stops = [0, 0, 0] if win else [0, 2, 5]   # 0=7。はずれはバラバラ

    def action(root):
        tr = [{"node": lever, "times": [0, 0.15, 0.35, 0.55],
               "rotation": [qx(0), qx(0), qx(70), qx(0)]}]
        for i, rn in enumerate(reels):
            end = 1.0 + 0.3 * i
            final = _slot_reel_angle(stops[i]) - 360.0 * (3 + i)
            n = 8 * (3 + i)
            ts = [0.35 + (end - 0.35) * k / n for k in range(n + 1)]
            ang = [final * (k / n) ** 0.8 for k in range(n + 1)]
            ang = [_slot_reel_angle(stops[i]) * 0 + a for a in ang]
            ts = [0.0] + ts + [end + 0.08, end + 0.16]
            ang = [0.0] + ang + [final + 6, final]
            tr.append({"node": rn, "times": ts, "rotation": [qx(a) for a in ang]})
        return tr

    def idle(root):
        tr = []
        for i, rn in enumerate(reels):
            ks = K.spin_keys((1, 0, 0), -1, 6)
            n = len(ks) - 1
            per = 0.7 + 0.1 * i
            tr.append({"node": rn, "times": [per * k / n for k in range(n + 1)], "rotation": ks})
        return tr

    return K.finish(b, [group], label, action, idle, badge_at=1.75, badge_pos=(0, 0.52, 0.6), badge_size=0.8)


# ============================================================
# だるま — 起き上がりこぼしのように揺れ、目が入る
# ============================================================
DARUMA_PROFILE = K.smooth_profile([(0.0, -0.56), (0.36, -0.52), (0.53, -0.3), (0.56, -0.02),
                                   (0.5, 0.26), (0.36, 0.48), (0.0, 0.6)], 5)


def tex_daruma():
    W, H = 1024, 512
    img = tex.vgrad((W, H), (222, 36, 40), (170, 18, 24))
    img = tex.grain(img, 5, 71)
    d = ImageDraw.Draw(img)
    cx = int(W * 0.75)
    # 顔(白い楕円) — u=0.75 が正面
    d.ellipse([cx - 150, 44, cx + 150, 270], fill=(252, 238, 214), outline=(212, 170, 70), width=8)
    # 眉(太い墨)
    d.arc([cx - 125, 44, cx - 20, 144], 200, 340, fill=(30, 20, 20), width=18)
    d.arc([cx + 20, 44, cx + 125, 144], 200, 340, fill=(30, 20, 20), width=18)
    # 目: 左は黒目入り、右は空っぽ(演出で入る)
    for ex in (cx - 62, cx + 62):
        d.ellipse([ex - 40, 114, ex + 40, 186], fill=(255, 255, 255), outline=(40, 30, 30), width=5)
    d.ellipse([cx - 62 - 20, 130, cx - 62 + 20, 170], fill=(20, 16, 16))
    # 鼻と口ひげ
    d.arc([cx - 18, 170, cx + 18, 206], 20, 160, fill=(40, 30, 30), width=6)
    d.arc([cx - 110, 174, cx, 274], 200, 330, fill=(40, 30, 30), width=10)
    d.arc([cx, 174, cx + 110, 274], 210, 340, fill=(40, 30, 30), width=10)
    # お腹の金文字
    tex.draw_text(img, "福", (cx - 80, 286, cx + 80, 420), fill=(255, 214, 90), stroke=(140, 70, 10),
                  stroke_w=6, path=SERIF, shadow=False)
    # 背中側の金の渦模様
    for k in range(6):
        x = int(W * 0.25) + (k - 3) * 70
        d.arc([x - 40, 200, x + 40, 280], 0, 300, fill=(250, 200, 80), width=8)
    return tex.vignette(img, 0.2)


def build_daruma(cat, key, label):
    b = G.Builder()
    m_body = K.texmat(b, "daruma_body", tex_daruma(), rough=0.35, colors=128)
    m_eye = K.col(b, "daruma_eye", (18, 14, 14), rough=0.4)
    body = K.lathe(DARUMA_PROFILE, 48)
    body_mesh = b.add_mesh([G.prim(body, m_body)], "daruma")
    # 空いている右目の位置(テクスチャと同じ座標から求める)
    u = 0.75 + 62.0 / 1024.0
    v = 150.0 / 512.0
    pos, nrm = K.lathe_point(DARUMA_PROFILE, u, v, push=0.006)
    eye_mesh = b.add_mesh([G.prim(K.transform(G.disc(0.043, 28), r=K.look_quat(nrm)), m_eye)], "daruma_eye")
    eye = b.add_node("eye", mesh=eye_mesh, t=pos, s=(0, 0, 0))
    doll = b.add_node("doll", mesh=body_mesh, children=[eye], t=(0, 0.56, 0))
    pivot = b.add_node("pivot", children=[doll], t=(0, -0.66, 0))

    def action(root):
        angs = [0, 26, -20, 14, -9, 5, -2, 0]
        ts = [0.0, 0.18, 0.4, 0.58, 0.74, 0.88, 0.98, 1.08]
        return [{"node": pivot, "times": ts, "rotation": [qz(a) for a in angs]},
                K.pop(eye, 1.15, 0.25),
                K.bump(pivot, 1.15, 0.06, base=(0, -0.66, 0))]

    def idle(root):
        return [{"node": pivot, "times": [0, 0.35, 0.7, 1.05, 1.4],
                 "rotation": [qz(a) for a in (0, 14, 0, -14, 0)]}]

    return K.finish(b, [pivot], label, action, idle, badge_at=1.4, badge_pos=(0, 0.5, 0.7), badge_size=0.78)


# ============================================================
# おみくじ — 六角の箱を逆さに振ると、みくじ棒が出てくる
# ============================================================
def tex_omikuji_label():
    img = tex.paper((256, 512), (252, 248, 236), seed=81)
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 246, 502], outline=(196, 30, 36), width=10)
    f = ImageFont.truetype(SERIF, 88)
    for i, ch in enumerate("おみくじ"):
        l, t, r, bb = d.textbbox((0, 0), ch, font=f)
        d.text((128 - (r - l) / 2 - l, 40 + i * 110), ch, font=f, fill=(190, 24, 30))
    return img


def build_omikuji(cat, key, label):
    b = G.Builder()
    m_wood = K.texmat(b, "omikuji_wood", tex.wood((256, 256), (206, 160, 104), seed=82, vertical=True), rough=0.7)
    m_label = K.texmat(b, "omikuji_label", tex_omikuji_label(), rough=0.8)
    m_hole = K.col(b, "omikuji_hole", (20, 12, 8), rough=1.0)
    m_bamboo = K.col(b, "omikuji_stick", (222, 196, 140), rough=0.6)
    m_tip = K.col(b, "omikuji_tip", (200, 30, 36), rough=0.5)
    m_rope = K.col(b, "omikuji_rope", (196, 30, 36), rough=0.8)

    R, L = 0.34, 1.0
    hexa = K.transform(K.extrude(K.ngon(6, R, rot=0), L), r=qx(90))
    label_pl = K.transform(G.plane(0.26, 0.62), t=(0, 0.02, R * math.cos(math.pi / 6) + 0.004))
    hole = K.transform(G.disc(0.05, 24), r=qx(-90), t=(0, L / 2 + 0.003, 0))
    rope = K.transform(G.torus(R * 0.93, 0.02, 40, 8), t=(0, L / 2 - 0.12, 0), s=(1, 1, 1.02))
    box_mesh = b.add_mesh([G.prim(hexa, m_wood), G.prim(label_pl, m_label), G.prim(hole, m_hole),
                           G.prim(rope, m_rope)], "omikuji_box")
    stick_mesh = b.add_mesh([G.prim(G.cylinder(0.022, 0.72, 12), m_bamboo),
                             G.prim(K.transform(G.cylinder(0.024, 0.1, 12), t=(0, 0.33, 0)), m_tip)], "stick")
    stick = b.add_node("stick", mesh=stick_mesh, t=(0, 0.0, 0))
    box = b.add_node("box", mesh=box_mesh, children=[stick])
    group = b.add_node("group", children=[box], t=(0, -0.2, 0))

    def action(root):
        ang = [0, 90, 180, 170, 190, 172, 188, 180, 270, 360]
        ts = [0, 0.15, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.95, 1.1]
        return [{"node": box, "times": ts, "rotation": [qz(a) for a in ang]},
                {"node": stick, "times": [0, 0.55, 0.8, 1.1],
                 "translation": [(0, 0, 0), (0, 0, 0), (0, 0.62, 0), (0, 0.62, 0)]},
                K.bump(group, 1.1, 0.06, base=(0, -0.2, 0))]

    def idle(root):
        return [{"node": box, "times": [0, 0.12, 0.24, 0.36, 0.48, 1.0],
                 "rotation": [qz(a) for a in (0, -8, 8, -6, 0, 0)],
                 "translation": [(0, 0, 0), (0, 0.04, 0), (0, 0, 0), (0, 0.04, 0), (0, 0, 0), (0, 0, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.2, badge_pos=(0, 0.42, 0.55), badge_size=0.8)


# ============================================================
# ガラガラ抽選 — 八角の抽選器を回すと玉が出る
# ============================================================
BALL_COLORS = {"1tou": (240, 190, 50), "ohatari": (240, 190, 50), "2tou": (210, 214, 222),
               "atari": (210, 214, 222), "3tou": (220, 40, 50), "4tou": (40, 110, 230),
               "5tou": (40, 170, 90), "6tou": (250, 220, 60), "coupon": (240, 110, 170)}


def tex_garagara_face():
    img = tex.rgrad((512, 512), (230, 50, 50), (150, 16, 22), cy=0.45)
    img = tex.grain(img, 5, 91)
    d = ImageDraw.Draw(img)
    d.ellipse([96, 96, 416, 416], outline=(255, 214, 110), width=12)
    d.ellipse([130, 130, 382, 382], fill=(252, 244, 226))
    tex.draw_text(img, "福", (160, 160, 352, 352), fill=(200, 26, 34), path=SERIF, shadow=False)
    return tex.vignette(img, 0.25)


def build_garagara(cat, key, label):
    b = G.Builder()
    m_face = K.texmat(b, "garagara_face", tex_garagara_face(), rough=0.35)
    m_side = K.col(b, "garagara_side", (170, 24, 30), rough=0.4)
    m_gold = gold(b)
    m_wood = K.texmat(b, "garagara_wood", tex.wood((256, 256), (150, 100, 56), seed=92), rough=0.7)
    m_ball = K.col(b, "garagara_ball", BALL_COLORS.get(key, (250, 250, 248)), rough=0.2,
                   metal=0.6 if key in ("1tou", "ohatari", "2tou", "atari") else 0.0)

    R, Dp = 0.52, 0.5
    octa = K.ngon(8, R, rot=22.5)
    drum = K.extrude(octa, Dp, uv_box=(-R, -R, R, R))
    # 前面だけ絵を貼るため、前面を別の板として重ねる
    front = K.transform(K.extrude(octa, 0.004, uv_box=(-R, -R, R, R)), t=(0, 0, Dp / 2 + 0.003))
    edge = []
    for i in range(8):
        a0 = octa[i]
        a1 = octa[(i + 1) % 8]
        mid = ((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2)
        ang = math.degrees(math.atan2(a1[1] - a0[1], a1[0] - a0[0]))
        ln = math.hypot(a1[0] - a0[0], a1[1] - a0[1])
        for zz in (Dp / 2, -Dp / 2):
            edge.append(K.transform(G.cylinder(0.02, ln, 8), r=qz(ang - 90), t=(mid[0], mid[1], zz)))
    arm = K.transform(K.rounded_box(0.36, 0.06, 0.05, r=0.02, n=2), t=(0.18, 0, Dp / 2 + 0.06))
    grip = K.transform(G.cylinder(0.04, 0.2, 16), r=qx(90), t=(0.36, 0, Dp / 2 + 0.16))
    hub = K.transform(G.cylinder(0.06, 0.06, 20), r=qx(90), t=(0, 0, Dp / 2 + 0.04))
    drum_mesh = b.add_mesh([G.prim(drum, m_side), G.prim(front, m_face),
                            G.prim(K.merge(*edge, arm, hub), m_gold),
                            G.prim(grip, m_wood)], "garagara_drum")
    drumN = b.add_node("drum", mesh=drum_mesh)
    # 台と脚
    base = K.transform(K.rounded_box(1.5, 0.1, 0.8, r=0.03, n=2), t=(0, -0.78, 0))
    legs = [K.tube([(x * 0.62, -0.74, -0.1), (x * 0.56, 0, -0.1)], 0.035, 10) for x in (-1, 1)]
    axle = K.transform(G.cylinder(0.03, 1.2, 12), r=qz(90), t=(0, 0, -0.1))
    tray = K.transform(K.rounded_box(0.5, 0.06, 0.3, r=0.03, n=2), t=(0, -0.7, 0.34))
    stand_mesh = b.add_mesh([G.prim(base, m_wood), G.prim(K.merge(*legs), m_gold),
                             G.prim(tray, m_gold)], "garagara_stand")
    stand = b.add_node("stand", mesh=stand_mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.07, 20, 12), m_ball)], "ball")
    ball = b.add_node("ball", mesh=ball_mesh, t=(0, -0.45, 0.2), s=(0, 0, 0))
    group = b.add_node("group", children=[stand, drumN, ball], t=(0, -0.05, 0), r=qx(8))

    def action(root):
        ks = K.spin_keys((0, 0, 1), -2, 6)
        n = len(ks) - 1
        return [
            {"node": drumN, "times": [1.3 * (i / n) ** 1.3 for i in range(n + 1)], "rotation": ks},
            {"node": ball, "times": [0, 1.1, 1.2, 1.36, 1.48, 1.58, 1.7],
             "translation": [(0, -0.47, 0.2), (0, -0.47, 0.2), (0, -0.5, 0.26), (0.02, -0.6, 0.34),
                             (0.04, -0.54, 0.36), (0.06, -0.6, 0.36), (0.07, -0.6, 0.36)],
             "scale": [(0, 0, 0), (0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1)]},
        ]

    def idle(root):
        ks = K.spin_keys((0, 0, 1), -1, 6)
        n = len(ks) - 1
        return [{"node": drumN, "times": [1.4 * i / n for i in range(n + 1)], "rotation": ks}]

    return K.finish(b, [group], label, action, idle, badge_at=1.65, badge_pos=(0, 0.3, 0.75), badge_size=0.8)


# ============================================================
# あみだくじ — 玉が線をたどって当たりへ
# ============================================================
AMIDA_COLS = 5
AMIDA_W, AMIDA_H = 1.36, 0.98


def _amida_layout():
    xs = [-AMIDA_W / 2 + 0.2 + i * (AMIDA_W - 0.4) / (AMIDA_COLS - 1) for i in range(AMIDA_COLS)]
    y_top, y_bot = AMIDA_H / 2 - 0.16, -AMIDA_H / 2 + 0.16
    rnd = random.Random(12)
    rungs = []
    for k in range(9):
        y = y_top - 0.08 - k * (y_top - y_bot - 0.16) / 8
        c = rnd.randrange(AMIDA_COLS - 1)
        rungs.append((y, c))
    return xs, y_top, y_bot, rungs


def _amida_path(start):
    xs, y_top, y_bot, rungs = _amida_layout()
    col = start
    pts = [(xs[col], y_top)]
    for y, c in rungs:
        if c == col:
            pts += [(xs[col], y), (xs[col + 1], y)]
            col += 1
        elif c == col - 1:
            pts += [(xs[col], y), (xs[col - 1], y)]
            col -= 1
    pts.append((xs[col], y_bot))
    return pts, col


def tex_amida(win=True):
    xs, y_top, y_bot, rungs = _amida_layout()
    W, H = 680, 490
    img = tex.paper((W, H), (250, 244, 228), seed=13)
    d = ImageDraw.Draw(img)

    def px(x, y):
        return (W / 2 + x / AMIDA_W * W, H / 2 - y / AMIDA_H * H)
    for x in xs:
        d.line([px(x, y_top), px(x, y_bot)], fill=(60, 40, 30), width=6)
    for y, c in rungs:
        d.line([px(xs[c], y), px(xs[c + 1], y)], fill=(60, 40, 30), width=6)
    f = ImageFont.truetype(SANS, 26)
    for i, x in enumerate(xs):
        X, Y = px(x, y_top + 0.08)
        d.text((X - 9, Y - 16), "ABCDE"[i], font=f, fill=(90, 70, 60))
    _, goal = _amida_path(1)
    for i, x in enumerate(xs):
        X, Y = px(x, y_bot - 0.07)
        if i == goal and win:
            pts = [(X + a, Y + c) for a, c in K.star_points(5, 22, 9, rot=-90)]
            d.polygon(pts, fill=(230, 170, 30))
        else:
            d.ellipse([X - 6, Y - 6, X + 6, Y + 6], fill=(170, 150, 130))
    d.rectangle([4, 4, W - 5, H - 5], outline=(150, 100, 50), width=8)
    return img


def build_amida(cat, key, label):
    b = G.Builder()
    m_board = K.texmat(b, "amida_board", tex_amida(key not in ("hazure", "cookie")), rough=0.8)
    m_frame = K.texmat(b, "amida_frame", tex.wood((256, 256), (140, 92, 50), seed=14), rough=0.7)
    m_ball = K.col(b, "amida_ball", (228, 30, 50), rough=0.15, metal=0.2)
    board = K.transform(G.plane(AMIDA_W, AMIDA_H), t=(0, 0, 0.031))
    back_ = K.rounded_box(AMIDA_W + 0.1, AMIDA_H + 0.1, 0.06, r=0.025, n=2)
    board_mesh = b.add_mesh([G.prim(back_, m_frame), G.prim(board, m_board)], "amida_board")
    boardN = b.add_node("board", mesh=board_mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.055, 20, 12), m_ball)], "amida_ball")
    pts, _ = _amida_path(1)
    ball = b.add_node("ball", mesh=ball_mesh, t=(pts[0][0], pts[0][1], 0.09))
    group = b.add_node("group", children=[boardN, ball], t=(0, -0.12, 0))

    def action(root):
        L = [0.0]
        for i in range(1, len(pts)):
            L.append(L[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
        total = L[-1]
        ts = [0.2 + 1.3 * l / total for l in L]
        return [{"node": ball, "times": [0.0] + ts + [ts[-1] + 0.15, ts[-1] + 0.3],
                 "translation": [(pts[0][0], pts[0][1], 0.09)] + [(x, y, 0.09) for x, y in pts] +
                                [(pts[-1][0], pts[-1][1] + 0.06, 0.14), (pts[-1][0], pts[-1][1], 0.09)]}]

    def idle(root):
        xs, y_top, _, _ = _amida_layout()
        return [{"node": ball, "times": [0, 0.5, 1.0, 1.5, 2.0],
                 "translation": [(xs[0], y_top, 0.09), (xs[2], y_top + 0.03, 0.09), (xs[4], y_top, 0.09),
                                 (xs[2], y_top + 0.03, 0.09), (xs[0], y_top, 0.09)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.85, badge_pos=(0, 0.1, 0.4), badge_size=0.84)


# ============================================================
# スクラッチ — コインで削ると結果が出る
# ============================================================
def tex_scratch_card(marks=("当", "当", "当")):
    W, H = 640, 420
    img = tex.vgrad((W, H), (40, 150, 90), (20, 100, 60))
    img = tex.grain(img, 5, 101)
    d = ImageDraw.Draw(img)
    for i in range(40):
        x = (i * 97) % W
        y = (i * 53) % H
        d.ellipse([x, y, x + 8, y + 8], fill=(255, 236, 140))
    tex.draw_text(img, "LUCKY SCRATCH", (40, 16, W - 40, 90), fill=(255, 226, 90), stroke=(20, 80, 40),
                  stroke_w=4, shadow=False)
    for i in range(3):
        x0 = 60 + i * 180
        d.rounded_rectangle([x0, 130, x0 + 160, 330], 18, fill=(255, 250, 236))
        tex.draw_text(img, marks[i], (x0 + 20, 160, x0 + 140, 300),
                      fill=(220, 30, 40) if marks[i] == "当" else (90, 96, 110), path=SERIF, shadow=False)
    return img


def tex_silver():
    img = tex.metal((256, 256), (188, 192, 198), seed=102)
    d = ImageDraw.Draw(img)
    tex.draw_text(img, "けずる", (40, 90, 216, 166), fill=(120, 124, 130), shadow=False)
    return img


def build_scratch(cat, key, label):
    b = G.Builder()
    marks = ("当", "当", "当") if key not in ("hazure", "cookie") else ("当", "当", "×")
    m_card = K.texmat(b, "scratch_card", tex_scratch_card(marks), rough=0.5)
    m_back = K.col(b, "scratch_back", (240, 240, 236), rough=0.6)
    m_silver = K.texmat(b, "scratch_silver", tex_silver(), rough=0.35, metal=0.6)
    m_coin = K.col(b, "scratch_coin", (230, 180, 70), rough=0.25, metal=0.85)
    W, H = 1.4, 0.92
    card = K.transform(G.plane(W, H), t=(0, 0, 0.012))
    back_ = K.rounded_box(W + 0.02, H + 0.02, 0.02, r=0.01, n=1, face_uv=False)
    card_mesh = b.add_mesh([G.prim(back_, m_back), G.prim(card, m_card)], "scratch_card")
    cardN = b.add_node("card", mesh=card_mesh)
    panels = []
    for i in range(3):
        x = -W / 2 + (60 + i * 180 + 80) / 640 * W
        y = H / 2 - (230 / 420) * H
        pm = b.add_mesh([G.prim(G.plane(160 / 640 * W, 200 / 420 * H), m_silver)], "silver_%d" % i)
        panels.append((b.add_node("silver_%d" % i, mesh=pm, t=(x, y, 0.016)), x, y))
    coin_geo = K.transform(G.cylinder(0.12, 0.03, 32), r=qx(80))
    coin_mesh = b.add_mesh([G.prim(coin_geo, m_coin)], "coin")
    coin = b.add_node("coin", mesh=coin_mesh, t=(0.9, 0.5, 0.2))
    group = b.add_node("group", children=[cardN, coin] + [p[0] for p in panels], t=(0, -0.05, 0))

    def action(root):
        tr = []
        cts, cps = [0.0], [(0.9, 0.5, 0.2)]
        t = 0.15
        for i, (pn, x, y) in enumerate(panels):
            for k, dy in enumerate((0.12, -0.12, 0.08, -0.08)):
                cts.append(t)
                cps.append((x + (-0.1 + 0.07 * k), y + dy, 0.06))
                t += 0.08
            tr.append({"node": pn, "times": [0, t - 0.3, t], "scale": [(1, 1, 1), (1, 1, 1), (0, 1, 1)]})
        cts += [t + 0.15, t + 0.3]
        cps += [(0.6, -0.34, 0.12), (0.6, -0.34, 0.05)]
        tr.append({"node": coin, "times": cts, "translation": cps})
        return tr

    def idle(root):
        return [{"node": coin, "times": [0, 0.5, 1.0],
                 "translation": [(0.6, 0.3, 0.2), (0.62, 0.36, 0.26), (0.6, 0.3, 0.2)],
                 "rotation": [qz(0), qz(12), qz(0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.2, badge_pos=(0, 0.0, 0.3), badge_size=0.86)


# ============================================================
# ダーツ — 矢が飛んできて刺さる
# ============================================================
def tex_dartboard(size=512):
    img = Image.new("RGB", (size, size), (20, 20, 22))
    d = ImageDraw.Draw(img)
    c = size / 2
    R = size / 2 - 4
    for i in range(20):
        a0 = -99 + i * 18
        light = i % 2 == 0
        d.pieslice([c - R * 0.86, c - R * 0.86, c + R * 0.86, c + R * 0.86], a0, a0 + 18,
                   fill=(242, 228, 196) if light else (26, 26, 28))
        # 倍/3倍リング
        for rr in (0.86, 0.55):
            d.pieslice([c - R * rr, c - R * rr, c + R * rr, c + R * rr], a0, a0 + 18,
                       fill=(206, 34, 40) if light else (30, 140, 70))
            inner = rr - 0.06
            d.pieslice([c - R * inner, c - R * inner, c + R * inner, c + R * inner], a0, a0 + 18,
                       fill=(242, 228, 196) if light else (26, 26, 28))
    d.ellipse([c - R * 0.12, c - R * 0.12, c + R * 0.12, c + R * 0.12], fill=(30, 140, 70))
    d.ellipse([c - R * 0.055, c - R * 0.055, c + R * 0.055, c + R * 0.055], fill=(206, 34, 40))
    f = ImageFont.truetype(SANS, 26)
    nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
    for i, n in enumerate(nums):
        a = math.radians(-90 + i * 18)
        x, y = c + math.cos(a) * R * 0.93, c + math.sin(a) * R * 0.93
        l, t, r, bb = d.textbbox((0, 0), str(n), font=f)
        d.text((x - (r - l) / 2 - l, y - (bb - t) / 2 - t), str(n), font=f, fill=(240, 240, 240))
    return img


def build_darts(cat, key, label):
    b = G.Builder()
    m_board = K.texmat(b, "dartboard", tex_dartboard(), rough=0.7, colors=64)
    m_rim = K.col(b, "dart_rim", (40, 40, 44), rough=0.6)
    m_shaft = K.col(b, "dart_shaft", (40, 44, 60), rough=0.3, metal=0.4)
    m_tip = K.col(b, "dart_tip", (210, 214, 222), rough=0.2, metal=0.9)
    m_fl = K.col(b, "dart_flight", (230, 40, 60), rough=0.5)
    R = 0.78
    board = K.transform(G.cylinder(R, 0.08, 64), r=qx(90))
    rim = K.transform(G.torus(R + 0.01, 0.05, 64, 10), r=qx(90))
    board_mesh = b.add_mesh([G.prim(board, m_board), G.prim(rim, m_rim)], "dartboard")
    boardN = b.add_node("board", mesh=board_mesh)
    # 矢(+Z方向が後ろ。先端が-Z)
    shaft = K.transform(G.cylinder(0.022, 0.42, 14), r=qx(90), t=(0, 0, 0.3))
    barrel = K.transform(G.cylinder(0.035, 0.16, 16), r=qx(90), t=(0, 0, 0.12))
    tip = K.transform(G.cylinder(0.004, 0.14, 10, r_top=0.02), r=qx(90), t=(0, 0, -0.03))
    fl = K.extrude([(0, 0), (0.12, -0.02), (0.12, -0.16), (0, -0.2)], 0.008)
    flights = [K.transform(fl, r=qmul(qz(a), qy(-90)), t=(0, 0, 0.62)) for a in (0, 120, 240)]
    dart_mesh = b.add_mesh([G.prim(K.merge(shaft), m_shaft), G.prim(K.merge(barrel, tip), m_tip),
                            G.prim(K.merge(*flights), m_fl)], "dart")
    hit = (0.0, 0.0) if key in ("1tou", "ohatari") else ((0.18, 0.28) if key not in ("hazure", "cookie") else (0.52, -0.42))
    dart_rot = qmul(qy(28), qx(-22))
    dart = b.add_node("dart", mesh=dart_mesh, t=(hit[0], hit[1], 0.06), r=dart_rot, s=(1.7, 1.7, 1.7))
    group = b.add_node("group", children=[boardN, dart], t=(0, 0, 0))

    def action(root):
        return [{"node": dart, "times": [0, 0.3, 0.62, 0.72, 0.8],
                 "translation": [(hit[0] + 0.6, hit[1] - 0.5, 3.2), (hit[0] + 0.6, hit[1] - 0.5, 3.2),
                                 (hit[0], hit[1], 0.06), (hit[0], hit[1], 0.08), (hit[0], hit[1], 0.06)]},
                {"node": boardN, "times": [0, 0.62, 0.7, 0.8, 0.9],
                 "rotation": [qx(0), qx(0), qx(-5), qx(2), qx(0)]}]

    def idle(root):
        return [{"node": dart, "times": [0, 0.8, 1.6],
                 "translation": [(0.55, -0.45, 1.1), (0.45, -0.35, 1.2), (0.55, -0.45, 1.1)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.95, badge_pos=(0, 0.2, 0.75), badge_size=0.82)


# ============================================================
# ルーレット — 回って止まり、針の先が光る
# ============================================================
def tex_wheel(size=512):
    img = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    R = size / 2 - 2
    cols = [(226, 40, 50), (250, 244, 232), (40, 120, 220), (250, 244, 232),
            (250, 190, 40), (250, 244, 232), (40, 170, 100), (250, 244, 232)]
    for i in range(8):
        d.pieslice([c - R, c - R, c + R, c + R], -90 - 22.5 + i * 45, -90 + 22.5 + i * 45, fill=cols[i])
    for i in range(8):
        a = math.radians(-90 + i * 45)
        x, y = c + math.cos(a) * R * 0.66, c + math.sin(a) * R * 0.66
        pts = [(x + px, y + py) for px, py in K.star_points(5, 26, 11, rot=-90)]
        d.polygon(pts, fill=(255, 214, 80) if cols[i][0] < 200 or cols[i][2] > 200 else (230, 60, 70))
    for i in range(8):
        a = math.radians(-90 - 22.5 + i * 45)
        d.line([(c, c), (c + math.cos(a) * R, c + math.sin(a) * R)], fill=(212, 170, 72), width=5)
    return img


def build_roulette(cat, key, label):
    b = G.Builder()
    m_wheel = K.texmat(b, "wheel_face", tex_wheel(), rough=0.45, colors=64)
    m_gold = gold(b)
    m_wood = K.texmat(b, "wheel_wood", tex.wood((256, 256), (120, 64, 34), seed=111), rough=0.6)
    m_red = K.col(b, "pointer", (220, 30, 40), rough=0.3)
    R = 0.72
    wheel = K.transform(G.cylinder(R, 0.07, 64), r=qx(90))
    hub = K.transform(G.sphere(0.09, 20, 12), t=(0, 0, 0.05), s=(1, 1, 0.6))
    pegs = [K.transform(G.cylinder(0.018, 0.06, 8), r=qx(90), t=(math.cos(K.TAU * i / 16) * (R - 0.03),
                                                                  math.sin(K.TAU * i / 16) * (R - 0.03), 0.06))
            for i in range(16)]
    wheel_mesh = b.add_mesh([G.prim(wheel, m_wheel), G.prim(K.merge(hub, *pegs), m_gold)], "wheel")
    wheelN = b.add_node("wheel", mesh=wheel_mesh)
    ring = K.transform(G.torus(R + 0.07, 0.07, 64, 12), r=qx(90), t=(0, 0, -0.02))
    stand = K.merge(K.transform(K.rounded_box(0.3, 0.6, 0.18, r=0.04, n=2), t=(0, -R - 0.3, -0.05)),
                    K.transform(K.rounded_box(1.0, 0.1, 0.46, r=0.04, n=2), t=(0, -R - 0.62, -0.05)))
    pointer = K.transform(K.extrude([(-0.08, 0.1), (0.08, 0.1), (0, -0.1)], 0.05), t=(0, R + 0.08, 0.08))
    frame_mesh = b.add_mesh([G.prim(ring, m_wood), G.prim(stand, m_wood), G.prim(pointer, m_red)], "wheel_frame")
    frame = b.add_node("frame", mesh=frame_mesh)
    group = b.add_node("group", children=[frame, wheelN], t=(0, 0.2, 0), s=(0.9, 0.9, 0.9))

    stop_sector = 0 if key not in ("hazure", "cookie") else 1

    def action(root):
        final = -(360 * 3) - stop_sector * 45
        n = 18
        ts = [1.5 * (1 - (1 - i / n) ** 2.2) for i in range(n + 1)]
        # ts が等間隔でないと回転の補間が破綻するので、角度側で減速させる
        ts = [1.5 * i / n for i in range(n + 1)]
        ang = [final * (1 - (1 - i / n) ** 2.4) for i in range(n + 1)]
        return [{"node": wheelN, "times": ts + [1.62, 1.72], "rotation": [qz(a) for a in ang] + [qz(final + 4), qz(final)]}]

    def idle(root):
        ks = K.spin_keys((0, 0, 1), -1, 8)
        n = len(ks) - 1
        return [{"node": wheelN, "times": [1.2 * i / n for i in range(n + 1)], "rotation": ks}]

    return K.finish(b, [group], label, action, idle, badge_at=1.8, badge_pos=(0, 0.2, 0.55), badge_size=0.84)


# ============================================================
# 招き猫 — 手招きして小判を掲げる
# ============================================================
def tex_cat_face():
    W, H = 1024, 512  # 描いてから半分に縮める
    img = Image.new("RGB", (W, H), (252, 250, 246))
    d = ImageDraw.Draw(img)
    cx, cy = int(W * 0.25), int(H * 0.56)
    # ぶち模様(背中側)
    for x, y, r in ((int(W * 0.72), 160, 90), (int(W * 0.85), 260, 60), (int(W * 0.6), 300, 50)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=(236, 150, 60))
    d.ellipse([cx + 90, cy - 190, cx + 200, cy - 90], fill=(40, 36, 36))
    # 目(にっこり)
    for ex in (cx - 70, cx + 70):
        d.arc([ex - 36, cy - 64, ex + 36, cy - 8], 200, 340, fill=(30, 26, 26), width=11)
    # 鼻と口
    d.polygon([(cx - 14, cy - 2), (cx + 14, cy - 2), (cx, cy + 14)], fill=(236, 110, 130))
    d.arc([cx - 34, cy + 2, cx, cy + 36], 0, 160, fill=(30, 26, 26), width=6)
    d.arc([cx, cy + 2, cx + 34, cy + 36], 20, 180, fill=(30, 26, 26), width=6)
    # ほっぺ
    for ex in (cx - 110, cx + 110):
        d.ellipse([ex - 28, cy + 6, ex + 28, cy + 36], fill=(250, 196, 200))
    # ひげ
    for sgn in (-1, 1):
        for k in (-1, 0, 1):
            d.line([(cx + sgn * 60, cy + 14 + k * 12), (cx + sgn * 150, cy + 4 + k * 22)], fill=(80, 70, 70), width=4)
    return img


def tex_koban():
    img = tex.rgrad((256, 384), (255, 236, 150), (206, 150, 40), cy=0.35)
    d = ImageDraw.Draw(img)
    for y in range(40, 360, 16):
        d.line([(30, y), (226, y)], fill=(214, 164, 60), width=2)
    tex.draw_text(img, "千万両", (70, 70, 186, 320), fill=(90, 50, 10), path=SERIF, shadow=False)
    return img


def build_cat(cat, key, label):
    b = G.Builder()
    m_white = K.col(b, "cat_white", (252, 250, 246), rough=0.35)
    m_face = K.texmat(b, "cat_face", tex_cat_face().resize((512, 256), Image.LANCZOS), rough=0.35)
    m_pink = K.col(b, "cat_pink", (248, 170, 180), rough=0.5)
    m_red = K.col(b, "cat_collar", (210, 30, 40), rough=0.4)
    m_gold = gold(b)
    m_koban = K.texmat(b, "koban", tex_koban(), rough=0.25, metal=0.6)

    body_prof = K.smooth_profile([(0, -0.62), (0.38, -0.6), (0.46, -0.4), (0.44, -0.12), (0.34, 0.1), (0.0, 0.16)], 4)
    body = K.lathe(body_prof, 32)
    head = K.transform(G.sphere(0.4, 32, 16), s=(1.08, 0.9, 0.92), t=(0, 0.42, 0.02))
    ear_pts = [(-0.13, 0), (0.13, 0), (0.02, 0.2)]
    ears_o, ears_i = [], []
    for sgn in (-1, 1):
        q = qmul(qz(-sgn * 18), qx(-8))
        ears_o.append(K.transform(K.extrude(ear_pts, 0.06), r=q, t=(sgn * 0.24, 0.7, 0)))
        ears_i.append(K.transform(K.extrude([(-0.08, 0.02), (0.08, 0.02), (0.015, 0.14)], 0.02), r=q,
                                  t=(sgn * 0.24, 0.7, 0.035)))
    collar = K.transform(G.torus(0.33, 0.035, 32, 6), t=(0, 0.1, 0.02), s=(1, 1, 0.95))
    bell = K.transform(G.sphere(0.07, 16, 10), t=(0, 0.04, 0.35))
    feet = [K.transform(G.sphere(0.13, 16, 10), s=(1, 0.6, 1.2), t=(sgn * 0.2, -0.6, 0.3)) for sgn in (-1, 1)]
    body_mesh = b.add_mesh([G.prim(K.merge(body, *ears_o, *feet), m_white), G.prim(head, m_face),
                            G.prim(K.merge(*ears_i), m_pink), G.prim(collar, m_red), G.prim(bell, m_gold)], "cat_body")
    bodyN = b.add_node("cat", mesh=body_mesh)
    # 招く手(右手 = 画面の左)。肩を支点に振る
    arm = K.tube([(0, 0, 0), (0, 0.18, 0.06), (0, 0.34, 0.06)], 0.085, 14)
    pad = K.transform(G.sphere(0.05, 12, 8), t=(0, 0.36, 0.14), s=(1, 1, 0.5))
    arm_mesh = b.add_mesh([G.prim(arm, m_white), G.prim(pad, m_pink)], "cat_arm")
    arm_n = b.add_node("arm", mesh=arm_mesh, t=(-0.36, 0.1, 0.12), r=qz(20))
    # 小判(左手に抱える)
    koban = K.merge(K.transform(G.sphere(0.5, 32, 16), s=(0.32, 0.46, 0.04)))
    koban_mesh = b.add_mesh([G.prim(koban, m_koban)], "koban")
    koban_n = b.add_node("koban", mesh=koban_mesh, t=(0.2, -0.2, 0.42), r=qz(-12))
    group = b.add_node("group", children=[bodyN, arm_n, koban_n], t=(0, -0.1, 0))

    def action(root):
        ang = [20, 40, 5, 40, 5, 40, 20]
        return [{"node": arm_n, "times": [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1.05], "rotation": [qz(a) for a in ang]},
                {"node": koban_n, "times": [0, 1.0, 1.2, 1.35],
                 "translation": [(0.2, -0.2, 0.42), (0.2, -0.2, 0.42), (0.26, 0.02, 0.5), (0.26, -0.02, 0.5)],
                 "rotation": [qz(-12), qz(-12), qz(8), qz(0)]}]

    def idle(root):
        return [{"node": arm_n, "times": [0, 0.3, 0.6], "rotation": [qz(20), qz(42), qz(20)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.35, badge_pos=(0, 0.9, 0.5), badge_size=0.8)


# ============================================================
# 打ち出の小槌 — 振ると小判が飛び出す
# ============================================================
def tex_mallet():
    img = tex.vgrad((512, 256), (220, 36, 44), (150, 14, 24))
    img = tex.grain(img, 5, 121)
    d = ImageDraw.Draw(img)
    for x in range(0, 512, 128):
        d.ellipse([x + 30, 70, x + 98, 186], outline=(255, 214, 110), width=6)
        tex.draw_text(img, "宝", (x + 42, 84, x + 86, 172), fill=(255, 214, 110), path=SERIF, shadow=False)
    d.rectangle([0, 0, 512, 14], fill=(236, 190, 80))
    d.rectangle([0, 242, 512, 256], fill=(236, 190, 80))
    return img


def build_mallet(cat, key, label):
    b = G.Builder()
    m_head = K.texmat(b, "mallet_head", tex_mallet(), rough=0.35)
    m_gold = gold(b)
    m_handle = K.texmat(b, "mallet_handle", tex.wood((128, 256), (170, 110, 60), seed=122, vertical=True), rough=0.6)
    m_cord = K.col(b, "mallet_cord", (200, 30, 40), rough=0.7)
    m_coin = K.texmat(b, "coin_face", tex_koban(), rough=0.25, metal=0.6)
    prof = K.smooth_profile([(0.0, -0.36), (0.25, -0.36), (0.3, -0.26), (0.32, 0), (0.3, 0.26), (0.25, 0.36), (0, 0.36)], 4)
    head = K.transform(K.lathe(prof, 40), r=qz(90))
    caps = [K.transform(G.cylinder(0.26, 0.03, 32), r=qz(90), t=(x, 0, 0)) for x in (-0.37, 0.37)]
    handle = K.transform(G.cylinder(0.055, 0.8, 16), t=(0, -0.62, 0))
    knob = K.transform(G.sphere(0.07, 16, 10), t=(0, -1.02, 0))
    cord = K.tube(K.bezier((0, -0.98, 0), (0.1, -1.1, 0.05), (0.2, -1.2, 0.05), (0.14, -1.32, 0.02), 10), 0.018, 8)
    mallet_mesh = b.add_mesh([G.prim(head, m_head), G.prim(K.merge(*caps, knob), m_gold),
                              G.prim(handle, m_handle), G.prim(cord, m_cord)], "mallet")
    mallet = b.add_node("mallet", mesh=mallet_mesh, t=(0, 1.02, 0))
    pivot = b.add_node("pivot", children=[mallet], t=(0.2, -0.95, 0), r=qz(20))
    # 飛び出す小判
    coin_mesh = b.add_mesh([G.prim(K.transform(G.sphere(0.5, 20, 10), s=(0.16, 0.24, 0.025)), m_coin)], "coin")
    coins = []
    rnd = random.Random(5)
    for i in range(7):
        a = deg(30 + i * 20)
        coins.append((b.add_node("coin_%d" % i, mesh=coin_mesh, t=(0, -0.1, 0.1), s=(0, 0, 0)),
                      (math.cos(a) * 0.75, 0.25 + math.sin(a) * 0.45, 0.2 + rnd.uniform(0, 0.2)), rnd.uniform(-60, 60)))
    group = b.add_node("group", children=[pivot] + [c[0] for c in coins])

    def action(root):
        tr = [{"node": pivot, "times": [0, 0.25, 0.5, 0.62, 0.75],
               "rotation": [qz(20), qz(40), qz(-35), qz(-28), qz(-32)]}]
        for i, (n, dst, spin) in enumerate(coins):
            t0 = 0.55 + i * 0.03
            tr.append({"node": n, "times": [0, t0, t0 + 0.35, t0 + 0.55],
                       "translation": [(0.05, -0.1, 0.1), (0.05, -0.1, 0.1), dst, (dst[0], dst[1] - 0.08, dst[2])],
                       "scale": [(0, 0, 0), (0.3,) * 3, (1, 1, 1), (1, 1, 1)],
                       "rotation": [qz(0), qz(0), qz(spin), qz(spin * 1.2)]})
        return tr

    def idle(root):
        return [{"node": pivot, "times": [0, 0.5, 1.0], "rotation": [qz(20), qz(30), qz(20)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.05, badge_pos=(-0.05, 0.25, 0.6), badge_size=0.8)


# ============================================================
# ランタン(提灯) — 灯りがともって揺れる
# ============================================================
def tex_chochin(lit=True):
    W, H = 1024, 512
    base = (238, 60, 50) if lit else (190, 36, 36)
    img = tex.vgrad((W, H), base, tuple(max(0, c - 40) for c in base))
    d = ImageDraw.Draw(img)
    for y in range(0, H, 22):
        d.line([(0, y), (W, y)], fill=tuple(max(0, c - 55) for c in base), width=3)
    tex.draw_text(img, "福", (int(W * 0.75) - 150, 90, int(W * 0.75) + 150, 420), fill=(20, 16, 16),
                  path=SERIF, shadow=False)
    tex.draw_text(img, "祭", (int(W * 0.25) - 150, 90, int(W * 0.25) + 150, 420), fill=(20, 16, 16),
                  path=SERIF, shadow=False)
    return img


def build_lantern(cat, key, label):
    b = G.Builder()
    m_paper = K.texmat(b, "chochin_paper", tex_chochin(), rough=0.8, emissive=(0.55, 0.28, 0.12),
                       emissive_texture=True)
    m_black = K.col(b, "chochin_black", (26, 22, 22), rough=0.5)
    m_gold = gold(b)
    m_glow = glow_mat(b, "chochin_glow", (255, 200, 110), 128, 2.0)
    prof = []
    for i in range(29):
        y = -0.55 + 1.1 * i / 28
        r = 0.46 * math.sqrt(max(0.0, 1 - (y / 0.62) ** 2)) + 0.012 * (1 if i % 2 else -1)
        prof.append((max(0.2, r), y))
    body = K.lathe(prof, 40)
    caps = [K.transform(G.cylinder(0.22, 0.09, 32), t=(0, y, 0)) for y in (-0.59, 0.59)]
    handle = K.tube([(-0.22, 0.64, 0), (-0.22, 0.8, 0), (0.22, 0.8, 0), (0.22, 0.64, 0)], 0.02, 8)
    tassel = K.transform(G.cylinder(0.02, 0.26, 10, r_top=0.035), t=(0, -0.78, 0))
    lamp_mesh = b.add_mesh([G.prim(body, m_paper), G.prim(K.merge(*caps), m_black),
                            G.prim(handle, m_gold), G.prim(tassel, m_gold)], "chochin")
    lamp = b.add_node("lamp", mesh=lamp_mesh, t=(0, -0.8, 0))
    glow_mesh = b.add_mesh([G.prim(G.plane(1.9, 1.9), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, -0.8, -0.35), s=(0, 0, 0))
    pivot = b.add_node("pivot", children=[lamp, glow], t=(0, 0.75, 0))

    def action(root):
        return [{"node": pivot, "times": [0, 0.3, 0.6, 0.9, 1.2, 1.5],
                 "rotation": [qz(a) for a in (0, 10, -8, 5, -3, 0)]},
                {"node": glow, "times": [0, 0.3, 0.55, 0.7, 1.5],
                 "scale": [(0, 0, 0), (0, 0, 0), (1.25, 1.25, 1.25), (1, 1, 1), (1, 1, 1)]}]

    def idle(root):
        return [{"node": pivot, "times": [0, 0.7, 1.4], "rotation": [qz(-6), qz(6), qz(-6)]},
                {"node": glow, "times": [0, 0.7, 1.4], "scale": [(0.5,) * 3, (0.62,) * 3, (0.5,) * 3]}]

    return K.finish(b, [pivot], label, action, idle, badge_at=0.8, badge_pos=(0, -0.05, 0.62), badge_size=0.82)


# ============================================================
# 打ち上げ花火 — 筒から上がって夜空に開く
# ============================================================
SPARK_COLORS = [(255, 90, 90), (255, 200, 80), (120, 200, 255), (160, 255, 150), (255, 140, 230)]


def build_firework(cat, key, label):
    b = G.Builder()
    m_tube = K.texmat(b, "firework_tube", tex.stripes((256, 256), (214, 40, 46), (246, 238, 220), pitch=64), rough=0.7)
    m_cap = K.col(b, "firework_cap", (40, 36, 40), rough=0.7)
    sparks_m = [glow_mat(b, "spark_%d" % i, c, 64, 1.1) for i, c in enumerate(SPARK_COLORS)]
    m_flash = glow_mat(b, "flash", (255, 250, 220), 128, 2.0)
    tube = K.transform(G.cylinder(0.16, 0.5, 32), t=(0, -0.95, 0))
    rim = K.transform(G.torus(0.16, 0.02, 32, 6), t=(0, -0.7, 0))
    base = K.transform(K.rounded_box(0.6, 0.1, 0.5, r=0.03, n=2), t=(0, -1.22, 0))
    tube_mesh = b.add_mesh([G.prim(tube, m_tube), G.prim(K.merge(rim, base), m_cap)], "tube")
    tubeN = b.add_node("tube", mesh=tube_mesh)
    shell_mesh = b.add_mesh([G.prim(G.plane(0.22, 0.22), sparks_m[1])], "shell")
    shell = b.add_node("shell", mesh=shell_mesh, t=(0, -0.7, 0.05), s=(0, 0, 0))
    flash_mesh = b.add_mesh([G.prim(G.plane(1.6, 1.6), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0, 0.45, -0.1), s=(0, 0, 0))
    spark_meshes = [b.add_mesh([G.prim(G.plane(0.34, 0.34), m)], "spark_%d" % i) for i, m in enumerate(sparks_m)]
    sparks = []
    rnd = random.Random(8)
    for ring, (rad, count) in enumerate(((0.95, 20), (0.6, 12))):
        for i in range(count):
            a = K.TAU * (i + 0.5 * ring) / count
            n = b.add_node("spark_%d_%d" % (ring, i), mesh=spark_meshes[(i + ring) % len(spark_meshes)],
                           t=(0, 0.45, 0), s=(0, 0, 0))
            sparks.append((n, (math.cos(a) * rad, 0.45 + math.sin(a) * rad, rnd.uniform(-0.05, 0.05))))
    group = b.add_node("group", children=[tubeN, shell, flash] + [s_[0] for s_ in sparks])

    def action(root):
        tr = [{"node": shell, "times": [0, 0.15, 0.2, 0.7, 0.75],
               "translation": [(0, -0.7, 0.05), (0, -0.7, 0.05), (0, -0.6, 0.05), (0, 0.45, 0.05), (0, 0.45, 0.05)],
               "scale": [(0, 0, 0), (0, 0, 0), (1, 1, 1), (0.8, 0.8, 0.8), (0, 0, 0)]},
              {"node": flash, "times": [0, 0.72, 0.85, 1.3], "scale": [(0, 0, 0), (0, 0, 0), (1.2,) * 3, (0.7,) * 3]},
              {"node": tubeN, "times": [0, 0.15, 0.25, 0.35], "translation": [(0, 0, 0), (0, 0, 0), (0, -0.04, 0), (0, 0, 0)]}]
        for n, dst in sparks:
            mid = (dst[0] * 0.8, 0.45 + (dst[1] - 0.45) * 0.8, dst[2])
            tr.append({"node": n, "times": [0, 0.72, 0.95, 1.5],
                       "translation": [(0, 0.45, 0), (0, 0.45, 0), mid, (dst[0], dst[1] - 0.1, dst[2])],
                       "scale": [(0, 0, 0), (0.5,) * 3, (1.3,) * 3, (0.9,) * 3]})
        return tr

    def idle(root):
        return [{"node": shell, "times": [0, 0.2, 0.4, 0.6, 0.8],
                 "translation": [(0, -0.68, 0.05)] * 5,
                 "scale": [(0.5,) * 3, (0.8,) * 3, (0.45,) * 3, (0.75,) * 3, (0.5,) * 3]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.95, badge_pos=(0, 0.45, 0.3), badge_size=0.82)


# ============================================================
# 扇子 — パッと開いて結果が現れる
# ============================================================
def tex_fan(W=1024, H=512):
    img = tex.vgrad((W, H), (236, 60, 60), (170, 20, 30))
    d = ImageDraw.Draw(img)
    for k in range(7):
        y = 60 + k * 64
        for x in range(-40, W, 120):
            d.arc([x, y, x + 120, y + 90], 180, 360, fill=(255, 214, 120), width=6)
    d.rectangle([0, 0, W, 30], fill=(236, 190, 80))
    return tex.grain(img, 4, 131)


def build_fan(cat, key, label):
    b = G.Builder()
    m_paper = K.texmat(b, "fan_paper", tex_fan(), rough=0.7)
    m_rib = K.col(b, "fan_rib", (90, 50, 24), rough=0.5)
    m_gold = gold(b)
    N = 14
    SPREAD = 160.0
    R0, R1 = 0.22, 1.02
    step = SPREAD / N
    segs = []
    for i in range(N):
        a0 = deg(90 + step / 2)
        a1 = deg(90 - step / 2)
        # 1枚の扇面(中心が真上を向いた状態で作り、ノードの回転で広げる)
        u0, u1 = i / N, (i + 1) / N
        pts = [(math.cos(a0) * R0, math.sin(a0) * R0), (math.cos(a1) * R0, math.sin(a1) * R0),
               (math.cos(a1) * R1, math.sin(a1) * R1), (math.cos(a0) * R1, math.sin(a0) * R1)]
        geo = dict(positions=[(x, y, 0) for x, y in pts], normals=[(0, 0, 1)] * 4,
                   uvs=[(u0, 1), (u1, 1), (u1, 0), (u0, 0)], indices=[0, 1, 2, 0, 2, 3])
        tilt = qy(10 if i % 2 else -10)
        mesh = b.add_mesh([G.prim(K.transform(geo, r=tilt), m_paper), G.prim(K.transform(G.back(geo), r=tilt), m_rib),
                           G.prim(K.transform(K.rounded_box(0.028, R1 - 0.05, 0.012, r=0.005, n=1),
                                              t=(0, (R1 + 0.02) / 2, -0.01)), m_rib)], "fan_seg_%d" % i)
        final = SPREAD / 2 - step * (i + 0.5)
        segs.append((b.add_node("seg_%d" % i, mesh=mesh, r=qz(0)), final))
    pin = K.transform(G.cylinder(0.05, 0.06, 20), r=qx(90), t=(0, 0, 0.02))
    pin_mesh = b.add_mesh([G.prim(pin, m_gold)], "fan_pin")
    pinN = b.add_node("pin", mesh=pin_mesh)
    fan = b.add_node("fan", children=[s_[0] for s_ in segs] + [pinN], t=(0, -0.55, 0))

    def action(root):
        tr = []
        for n, final in segs:
            tr.append({"node": n, "times": [0, 0.25, 0.7, 0.82, 0.92],
                       "rotation": [qz(0), qz(0), qz(final * 1.04), qz(final * 0.98), qz(final)]})
        tr.append({"node": fan, "times": [0, 0.25, 0.7, 0.9, 1.2],
                   "rotation": [qz(-25), qz(-25), qz(4), qz(-2), qz(0)]})
        return tr

    def idle(root):
        tr = []
        for n, final in segs:
            tr.append({"node": n, "times": [0, 0.5, 1.0], "rotation": [qz(0), qz(final * 0.12), qz(0)]})
        tr.append({"node": fan, "times": [0, 0.5, 1.0], "rotation": [qz(-25), qz(-18), qz(-25)]})
        return tr

    return K.finish(b, [fan], label, action, idle, badge_at=0.95, badge_pos=(0, 0.02, 0.35), badge_size=0.86)


# ============================================================
# エアー抽選機 — 風で舞う玉のうち1つが飛び出す
# ============================================================
def tex_air_base():
    img = tex.vgrad((512, 256), (40, 60, 120), (20, 30, 70))
    tex.draw_text(img, "LOTTERY", (60, 60, 452, 196), fill=(255, 220, 120), shadow=False)
    return img


def build_airlottery(cat, key, label):
    b = G.Builder()
    m_glass = K.col(b, "air_glass", (220, 236, 255), rough=0.05, alpha=0.22)
    m_base = K.texmat(b, "air_base", tex_air_base(), rough=0.4)
    m_body = K.col(b, "air_body", (30, 46, 100), rough=0.4)
    m_chrome = K.col(b, "air_chrome", (210, 214, 222), rough=0.2, metal=0.9)
    ball_cols = [(240, 60, 60), (60, 140, 240), (250, 200, 50), (80, 200, 110), (250, 250, 248), (240, 130, 40)]
    balls_m = [K.col(b, "air_ball_%d" % i, c, rough=0.25) for i, c in enumerate(ball_cols)]
    prize_m = K.col(b, "air_prize", BALL_COLORS.get(key, (250, 250, 248)), rough=0.2,
                    metal=0.6 if key in ("1tou", "ohatari", "2tou", "atari") else 0.0)
    dome = K.transform(G.sphere(0.55, 32, 16), t=(0, 0.15, 0))
    base = K.transform(G.cylinder(0.46, 0.42, 40, r_top=0.36), t=(0, -0.55, 0))
    front = K.transform(G.plane(0.52, 0.26), t=(0, -0.56, 0.42), r=qx(-12))
    pipe = K.transform(G.cylinder(0.06, 0.4, 20), t=(0, 0.85, 0))
    chute = K.tube([(0, 1.02, 0), (0, 1.1, 0.12), (0, 1.02, 0.3)], 0.06, 14)
    ring = K.transform(G.torus(0.37, 0.03, 40, 8), t=(0, -0.33, 0))
    mesh = b.add_mesh([G.prim(base, m_body), G.prim(front, m_base), G.prim(K.merge(ring), m_chrome),
                       G.prim(K.merge(pipe, chute), m_glass)], "air_base")
    dome_mesh = b.add_mesh([G.prim(dome, m_glass)], "air_dome")
    baseN = b.add_node("machine", mesh=mesh)
    domeN = b.add_node("dome", mesh=dome_mesh)
    ball_mesh = [b.add_mesh([G.prim(G.sphere(0.075, 16, 10), m)], "air_ball_%d" % i) for i, m in enumerate(balls_m)]
    rnd = random.Random(21)
    balls = []
    for i in range(12):
        pts = [(rnd.uniform(-0.35, 0.35), rnd.uniform(-0.2, 0.45), rnd.uniform(-0.3, 0.3)) for _ in range(4)]
        pts.append(pts[0])
        n = b.add_node("ball_%d" % i, mesh=ball_mesh[i % len(ball_mesh)], t=pts[0])
        balls.append((n, pts, rnd.uniform(0.9, 1.3)))
    prize_mesh = b.add_mesh([G.prim(G.sphere(0.085, 20, 12), prize_m)], "air_prize")
    prize = b.add_node("prize", mesh=prize_mesh, t=(0, 0.3, 0), s=(0, 0, 0))
    group = b.add_node("group", children=[baseN, domeN, prize] + [x[0] for x in balls], t=(0, -0.3, 0))

    def bounce(tr, dur_scale=1.0):
        for n, pts, per in balls:
            per *= dur_scale
            tr.append({"node": n, "times": [per * i / 4 for i in range(5)], "translation": pts})

    def action(root):
        tr = []
        bounce(tr)
        tr.append({"node": prize, "times": [0, 0.8, 1.1, 1.3, 1.5, 1.6],
                   "translation": [(0, 0.3, 0), (0, 0.3, 0), (0, 1.0, 0), (0, 1.12, 0.14), (0, 1.0, 0.36), (0, 0.98, 0.4)],
                   "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        tr = []
        bounce(tr)
        return tr

    return K.finish(b, [group], label, action, idle, badge_at=1.6, badge_pos=(0, 0.2, 0.7), badge_size=0.8)


def glow_mat(b, name, rgb, size=128, power=2.0):
    return K.texmat(b, name, K.glow_image(rgb, size, power), rough=1.0, alpha_mode="BLEND",
                    emissive=(1, 1, 1), emissive_texture=True, colors=0)


def streak_mat(b, name, rgb):
    return K.texmat(b, name, K.streak_image(rgb), rough=1.0, alpha_mode="BLEND",
                    emissive=(1, 1, 1), emissive_texture=True, colors=0)


def tex_target(size=512, rings=((230, 40, 50), (250, 248, 240))):
    img = Image.new("RGB", (size, size), rings[1])
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(5):
        r = c * (1 - i * 0.2)
        d.ellipse([c - r, c - r, c + r, c + r], fill=rings[i % 2])
    return img


def shockwave(b, name, rgb=(255, 240, 200)):
    """広がる光の輪(トゲの無い衝撃表現)。"""
    img = Image.new("RGBA", (256, 256), (rgb[0], rgb[1], rgb[2], 0))
    px = img.load()
    for y in range(256):
        for x in range(256):
            d = math.hypot(x - 127.5, y - 127.5) / 127.5
            a = math.exp(-((d - 0.78) ** 2) / 0.006) * (1 if d < 1 else 0)
            px[x, y] = (rgb[0], rgb[1], rgb[2], int(230 * a))
    return K.texmat(b, name, img.resize((128, 128), Image.LANCZOS), rough=1.0, alpha_mode="BLEND",
                    emissive=(1, 1, 1), emissive_texture=True, colors=0)


# ============================================================
# 戦闘機の的撃ち — 飛んできて的を撃ち抜く
# ============================================================
def build_jet(cat, key, label):
    b = G.Builder()
    m_body = K.col(b, "jet_body", (170, 182, 196), rough=0.35, metal=0.5)
    m_dark = K.col(b, "jet_dark", (70, 80, 96), rough=0.4, metal=0.4)
    m_glass = K.col(b, "jet_canopy", (40, 120, 200), rough=0.05, metal=0.3)
    m_red = K.col(b, "jet_red", (220, 40, 50), rough=0.4)
    m_target = K.texmat(b, "jet_target", tex_target(), rough=0.6, colors=32)
    m_pole = K.col(b, "jet_pole", (90, 70, 50), rough=0.7)
    m_bolt = streak_mat(b, "jet_bolt", (120, 230, 255))
    m_flash = glow_mat(b, "jet_flash", (255, 230, 150))
    m_ring = shockwave(b, "jet_ring")
    m_fire = glow_mat(b, "jet_afterburner", (255, 150, 60), 64, 1.4)
    # 機体(+Xが機首)
    prof = K.smooth_profile([(0, -0.7), (0.07, -0.62), (0.11, -0.3), (0.12, 0.2), (0.09, 0.5), (0.0, 0.72)], 4)
    fus = K.transform(K.lathe(prof, 24), r=qz(-90))
    wing = K.extrude([(-0.2, 0), (0.25, 0), (-0.12, 0.62), (-0.3, 0.62)], 0.03)
    wings = [K.transform(wing, r=qx(-90), t=(0, 0, 0.02)), K.transform(wing, r=qx(90), t=(0, 0, -0.02))]
    tail = K.transform(K.extrude([(-0.62, 0), (-0.42, 0), (-0.58, 0.3), (-0.7, 0.3)], 0.025), t=(0, 0.06, 0))
    stab = K.extrude([(-0.62, 0), (-0.45, 0), (-0.6, 0.22), (-0.68, 0.22)], 0.02)
    stabs = [K.transform(stab, r=qx(-90)), K.transform(stab, r=qx(90))]
    canopy = K.transform(G.sphere(0.1, 16, 10), s=(2.2, 0.8, 0.9), t=(0.28, 0.09, 0))
    nose = K.transform(G.cylinder(0.001, 0.12, 12, r_top=0.05), r=qz(-90), t=(0.72, 0, 0))
    jet_mesh = b.add_mesh([G.prim(K.merge(fus, *wings), m_body), G.prim(K.merge(tail, *stabs), m_dark),
                           G.prim(canopy, m_glass), G.prim(nose, m_red)], "jet")
    fire_mesh = b.add_mesh([G.prim(K.transform(G.plane(0.4, 0.2), t=(-0.85, 0, 0)), m_fire)], "afterburner")
    fire = b.add_node("fire", mesh=fire_mesh)
    jet = b.add_node("jet", mesh=jet_mesh, children=[fire], t=(-1.6, 0.6, 0.3), r=qmul(qx(-60), qz(-8)), s=(0.8,) * 3)
    # 的
    tgt = K.transform(G.cylinder(0.42, 0.05, 48), r=qx(90))
    pole = K.transform(G.cylinder(0.03, 0.7, 10), t=(0, -0.72, -0.03))
    tgt_mesh = b.add_mesh([G.prim(tgt, m_target)], "target")
    pole_mesh = b.add_mesh([G.prim(pole, m_pole)], "pole")
    target = b.add_node("target", mesh=tgt_mesh, t=(0.35, -0.2, 0))
    poleN = b.add_node("pole", mesh=pole_mesh, t=(0.35, -0.2, 0))
    bolt_mesh = b.add_mesh([G.prim(G.plane(0.5, 0.1), m_bolt)], "bolt")
    bolts = [b.add_node("bolt_%d" % i, mesh=bolt_mesh, t=(-0.6, 0.4, 0.3), s=(0, 0, 0)) for i in range(2)]
    flash_mesh = b.add_mesh([G.prim(G.plane(1.2, 1.2), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0.35, -0.2, 0.1), s=(0, 0, 0))
    ring_mesh = b.add_mesh([G.prim(G.plane(1.0, 1.0), m_ring)], "ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(0.35, -0.2, 0.08), s=(0, 0, 0))
    group = b.add_node("group", children=[poleN, target, jet, flash, ring] + bolts)

    def action(root):
        tr = [{"node": jet, "times": [0, 0.5, 0.9, 1.4],
               "translation": [(-1.6, 0.6, 0.3), (-0.7, 0.45, 0.3), (-0.3, 0.5, 0.3), (1.8, 1.0, 0.1)],
               "rotation": [qmul(qx(-60), qz(-8)), qmul(qx(-60), qz(-12)), qmul(qx(-50), qz(-8)), qmul(qx(-70), qz(18))]}]
        for i, n in enumerate(bolts):
            t0 = 0.55 + i * 0.14
            tr.append({"node": n, "times": [0, t0, t0 + 0.18, t0 + 0.2],
                       "translation": [(-0.5, 0.42, 0.3), (-0.5, 0.42, 0.3), (0.3, -0.18, 0.12), (0.3, -0.18, 0.12)],
                       "rotation": [qz(-35)] * 4,
                       "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (0, 0, 0)]})
        tr.append({"node": target, "times": [0, 0.87, 1.0, 1.15, 1.3],
                   "rotation": [qx(0), qx(0), qx(-70), qx(20), qx(0)]})
        tr.append({"node": flash, "times": [0, 0.86, 0.96, 1.3], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (0, 0, 0)]})
        tr.append({"node": ring, "times": [0, 0.88, 1.3, 1.32], "scale": [(0, 0, 0), (0.2,) * 3, (1.8,) * 3, (0, 0, 0)]})
        return tr

    def idle(root):
        return [{"node": jet, "times": [0, 0.8, 1.6],
                 "translation": [(-0.8, 0.55, 0.3), (-0.7, 0.65, 0.3), (-0.8, 0.55, 0.3)],
                 "rotation": [qmul(qx(-60), qz(-8)), qmul(qx(-54), qz(-4)), qmul(qx(-60), qz(-8))]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.25, badge_pos=(0.35, 0.05, 0.55), badge_size=0.8)


# ============================================================
# ロケット発射 — 煙を上げて飛び立つ
# ============================================================
def build_rocket(cat, key, label):
    b = G.Builder()
    m_white = K.col(b, "rocket_white", (246, 246, 244), rough=0.35)
    m_red = K.col(b, "rocket_red", (220, 36, 46), rough=0.35)
    m_win = K.col(b, "rocket_window", (60, 160, 230), rough=0.05, metal=0.2)
    m_metal = K.col(b, "rocket_metal", (150, 156, 166), rough=0.35, metal=0.7)
    m_pad = K.col(b, "rocket_pad", (70, 76, 90), rough=0.6)
    m_fire = glow_mat(b, "rocket_fire", (255, 170, 60), 64, 1.2)
    m_core = glow_mat(b, "rocket_core", (255, 250, 210), 64, 1.6)
    m_smoke = K.texmat(b, "rocket_smoke", K.glow_image((230, 230, 236), 64, 1.2), rough=1.0, alpha_mode="BLEND", colors=0)
    prof = K.smooth_profile([(0.0, -0.5), (0.2, -0.48), (0.24, -0.3), (0.25, 0.1), (0.22, 0.35), (0.13, 0.55), (0.0, 0.7)], 4)
    body = K.lathe(prof, 32)
    nose_band = K.transform(G.cylinder(0.232, 0.08, 32), t=(0, 0.34, 0))
    window = K.transform(G.cylinder(0.08, 0.03, 24), r=qx(90), t=(0, 0.12, 0.24))
    win_ring = K.transform(G.torus(0.085, 0.018, 24, 6), r=qx(90), t=(0, 0.12, 0.245))
    fin = K.extrude([(0.2, -0.5), (0.42, -0.62), (0.42, -0.4), (0.22, -0.18)], 0.035)
    fins = [K.transform(fin, r=qy(a)) for a in (0, 120, 240)]
    nozzle = K.transform(G.cylinder(0.12, 0.12, 24, r_top=0.16), t=(0, -0.55, 0))
    rocket_mesh = b.add_mesh([G.prim(body, m_white), G.prim(K.merge(nose_band, *fins), m_red),
                              G.prim(window, m_win), G.prim(K.merge(win_ring, nozzle), m_metal)], "rocket")
    flame_mesh = b.add_mesh([G.prim(K.transform(G.plane(0.34, 0.7), t=(0, -0.95, 0.02)), m_fire),
                             G.prim(K.transform(G.plane(0.18, 0.36), t=(0, -0.78, 0.04)), m_core)], "flame")
    flame = b.add_node("flame", mesh=flame_mesh, s=(0.3, 0.2, 0.3))
    rocket = b.add_node("rocket", mesh=rocket_mesh, children=[flame], t=(0, -0.2, 0))
    pad = K.merge(K.transform(K.rounded_box(1.1, 0.12, 0.6, r=0.03, n=2), t=(0, -0.92, 0)),
                  K.transform(G.cylinder(0.04, 1.2, 10), t=(-0.42, -0.3, -0.1)),
                  K.transform(K.rounded_box(0.3, 0.05, 0.05, r=0.02, n=1), t=(-0.3, -0.1, -0.1)))
    pad_mesh = b.add_mesh([G.prim(pad, m_pad)], "pad")
    padN = b.add_node("pad", mesh=pad_mesh)
    smoke_mesh = b.add_mesh([G.prim(G.plane(0.6, 0.6), m_smoke)], "smoke")
    puffs = []
    for i, (x, z) in enumerate(((-0.35, 0.2), (0.35, 0.2), (-0.15, 0.3), (0.2, 0.32), (0, 0.25))):
        puffs.append((b.add_node("smoke_%d" % i, mesh=smoke_mesh, t=(0, -0.8, 0.2), s=(0, 0, 0)), (x, -0.8, z)))
    group = b.add_node("group", children=[padN, rocket] + [p_[0] for p_ in puffs], t=(0, -0.15, 0))

    def action(root):
        tr = [{"node": rocket, "times": [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1.1, 1.3, 1.5],
               "translation": [(0, -0.2, 0), (0.01, -0.2, 0), (-0.01, -0.2, 0), (0.01, -0.2, 0), (0, -0.2, 0),
                               (0, -0.12, 0), (0, 0.55, 0), (0, 0.62, 0), (0, 0.58, 0)]},
              {"node": flame, "times": [0, 0.1, 0.45, 0.6, 1.5],
               "scale": [(0.3, 0.2, 0.3), (0.5, 0.4, 0.5), (1.1, 1.2, 1), (1, 1.4, 1), (0.9, 1.1, 1)]}]
        for i, (n, dst) in enumerate(puffs):
            t0 = 0.35 + i * 0.05
            tr.append({"node": n, "times": [0, t0, t0 + 0.6, 1.6],
                       "translation": [(0, -0.8, 0.2), (0, -0.8, 0.2), dst, (dst[0] * 1.3, dst[1] + 0.1, dst[2])],
                       "scale": [(0, 0, 0), (0.3,) * 3, (1.3,) * 3, (1.6,) * 3]})
        return tr

    def idle(root):
        return [{"node": rocket, "times": [0, 0.1, 0.2, 0.3, 0.4, 1.2],
                 "translation": [(0, -0.2, 0), (0.008, -0.2, 0), (-0.008, -0.2, 0), (0.008, -0.2, 0), (0, -0.2, 0), (0, -0.2, 0)]},
                {"node": flame, "times": [0, 0.3, 0.6, 1.2], "scale": [(0.3, 0.2, 0.3), (0.45, 0.35, 0.45), (0.3, 0.2, 0.3), (0.3, 0.2, 0.3)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.3, badge_pos=(0, -0.5, 0.7), badge_size=0.8)


# ============================================================
# 隕石落下 — 空から落ちて地面が光る
# ============================================================
def build_meteor(cat, key, label):
    b = G.Builder()
    m_rock = K.texmat(b, "meteor_rock", tex.grain(tex.rgrad((256, 256), (120, 96, 84), (50, 40, 36)), 14, 141),
                      rough=0.9, emissive=(0.25, 0.08, 0.0))
    m_ground = K.texmat(b, "meteor_ground", tex.grain(tex.vgrad((256, 256), (128, 104, 76), (86, 68, 50)), 12, 142), rough=0.95)
    m_lava = glow_mat(b, "meteor_lava", (255, 140, 40), 128, 1.5)
    m_trail = streak_mat(b, "meteor_trail", (255, 170, 80))
    m_ring = shockwave(b, "meteor_ring", (255, 200, 140))
    rock = K.lumpy(G.sphere(0.3, 24, 14), 0.16, 3, 5.0)
    rock_mesh = b.add_mesh([G.prim(rock, m_rock)], "meteor")
    trail_mesh = b.add_mesh([G.prim(K.transform(G.plane(1.4, 0.5), t=(0.75, 0, -0.05)), m_trail)], "trail")
    trail = b.add_node("trail", mesh=trail_mesh)
    meteor = b.add_node("meteor", mesh=rock_mesh, children=[trail], t=(1.6, 1.6, 0), r=qz(40))
    ground = K.merge(K.transform(G.cylinder(1.0, 0.18, 48), t=(0, -0.72, 0), s=(1, 1, 0.55)))
    crater = K.transform(G.torus(0.42, 0.08, 40, 8), t=(0, -0.63, 0), s=(1, 1, 0.55))
    ground_mesh = b.add_mesh([G.prim(K.merge(ground, crater), m_ground)], "ground")
    groundN = b.add_node("ground", mesh=ground_mesh)
    lava_mesh = b.add_mesh([G.prim(K.transform(G.plane(1.3, 1.3), r=qx(-90), t=(0, -0.62, 0)), m_lava)], "lava")
    lava = b.add_node("lava", mesh=lava_mesh, s=(0, 0, 0))
    ring_mesh = b.add_mesh([G.prim(G.plane(1.6, 1.6), m_ring)], "impact_ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(0, -0.45, 0.1), s=(0, 0, 0))
    rnd = random.Random(4)
    chunk_mesh = b.add_mesh([G.prim(K.lumpy(G.sphere(0.07, 10, 6), 0.3, 9, 8.0), m_rock)], "chunk")
    chunks = []
    for i in range(8):
        a = deg(20 + i * 20)
        chunks.append((b.add_node("chunk_%d" % i, mesh=chunk_mesh, t=(0, -0.55, 0), s=(0, 0, 0)),
                       (math.cos(a) * rnd.uniform(0.6, 0.9), -0.45 + math.sin(a) * 0.45, rnd.uniform(-0.1, 0.3))))
    group = b.add_node("group", children=[groundN, lava, meteor, ring] + [c[0] for c in chunks], t=(0, 0.1, 0), r=qx(18))

    def action(root):
        tr = [{"node": meteor, "times": [0, 0.7, 0.75, 1.0],
               "translation": [(1.6, 1.6, 0), (0, -0.45, 0), (0, -0.52, 0), (0, -0.55, 0)],
               "scale": [(1, 1, 1), (1, 1, 1), (1.1, 0.8, 1.1), (0.9, 0.8, 0.9)]},
              {"node": trail, "times": [0, 0.7, 0.8], "scale": [(1, 1, 1), (1, 1, 1), (0, 0, 0)]},
              {"node": lava, "times": [0, 0.72, 0.9, 1.4], "scale": [(0, 0, 0), (0, 0, 0), (1.2, 1.2, 1.2), (1, 1, 1)]},
              {"node": ring, "times": [0, 0.72, 1.2, 1.22], "scale": [(0, 0, 0), (0.2,) * 3, (1.8,) * 3, (0, 0, 0)]}]
        for n, dst in chunks:
            tr.append({"node": n, "times": [0, 0.72, 1.0, 1.25],
                       "translation": [(0, -0.55, 0), (0, -0.55, 0), (dst[0] * 0.8, dst[1] + 0.25, dst[2]), (dst[0], -0.6, dst[2])],
                       "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        return [{"node": meteor, "times": [0, 0.6, 1.2],
                 "translation": [(0.9, 0.9, 0), (0.8, 1.0, 0), (0.9, 0.9, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.05, badge_pos=(0, 0.05, 0.55), badge_size=0.84)


# ============================================================
# 手裏剣ヒット — 回転しながら飛んで的に刺さる
# ============================================================
def tex_log(size=512):
    img = tex.rgrad((size, size), (226, 190, 140), (150, 104, 60), cy=0.5)
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(1, 12):
        r = c * i / 12
        d.ellipse([c - r, c - r, c + r, c + r], outline=(160, 116, 70), width=3)
    d.ellipse([c - 36, c - 36, c + 36, c + 36], fill=(200, 40, 40))
    return tex.grain(img, 6, 151)


def build_shuriken(cat, key, label):
    b = G.Builder()
    m_log = K.texmat(b, "shuriken_log", tex_log(), rough=0.8)
    m_bark = K.texmat(b, "shuriken_bark", tex.wood((256, 256), (96, 64, 40), seed=152, vertical=True), rough=0.9)
    m_steel = K.col(b, "shuriken_steel", (150, 158, 170), rough=0.25, metal=0.9)
    m_dark = K.col(b, "shuriken_dark", (40, 44, 52), rough=0.4, metal=0.6)
    m_ring = shockwave(b, "shuriken_ring", (255, 240, 200))
    log = K.transform(G.cylinder(0.6, 0.3, 48), r=qx(90))
    log_face = K.transform(G.disc(0.6, 48), t=(0, 0, 0.152))
    stand = K.merge(K.transform(K.rounded_box(0.14, 0.7, 0.14, r=0.03, n=2), t=(0, -0.85, -0.05)),
                    K.transform(K.rounded_box(0.9, 0.08, 0.4, r=0.03, n=2), t=(0, -1.2, -0.05)))
    log_mesh = b.add_mesh([G.prim(log, m_bark), G.prim(log_face, m_log), G.prim(stand, m_bark)], "log")
    logN = b.add_node("log", mesh=log_mesh)
    star = K.extrude(K.star_points(4, 0.3, 0.09, rot=45), 0.03)
    hub = K.transform(G.torus(0.06, 0.02, 24, 6), r=qx(90), t=(0, 0, 0.0))
    shu_mesh = b.add_mesh([G.prim(star, m_steel), G.prim(hub, m_dark)], "shuriken")
    hit = (0.0, 0.0) if key in ("1tou", "ohatari") else ((0.2, 0.18) if key not in ("hazure", "cookie") else (0.38, -0.3))
    shu = b.add_node("shuriken", mesh=shu_mesh, t=(hit[0], hit[1], 0.17), r=qmul(qy(20), qz(0)))
    ring_mesh = b.add_mesh([G.prim(G.plane(1.0, 1.0), m_ring)], "hit_ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(hit[0], hit[1], 0.2), s=(0, 0, 0))
    group = b.add_node("group", children=[logN, shu, ring], t=(0, 0.1, 0))

    def action(root):
        ks = K.spin_keys((0, 0, 1), -3, 4)
        n = len(ks) - 1
        return [{"node": shu, "times": [0.6 * i / n for i in range(n + 1)] + [0.66, 0.74],
                 "rotation": [qmul(qy(20), k) for k in ks] + [qmul(qy(26), qz(0)), qmul(qy(20), qz(0))],
                 "translation": [(1.5 - (1.5 - hit[0]) * i / n, 0.6 - (0.6 - hit[1]) * i / n, 1.6 - 1.43 * i / n)
                                 for i in range(n + 1)] + [(hit[0], hit[1], 0.17)] * 2},
                {"node": logN, "times": [0, 0.6, 0.68, 0.78, 0.9], "rotation": [qx(0), qx(0), qx(-6), qx(3), qx(0)]},
                {"node": ring, "times": [0, 0.6, 1.0, 1.02], "scale": [(0, 0, 0), (0.2,) * 3, (1.4,) * 3, (0, 0, 0)]}]

    def idle(root):
        ks = K.spin_keys((0, 0, 1), -1, 4)
        n = len(ks) - 1
        return [{"node": shu, "times": [0.6 * i / n for i in range(n + 1)], "rotation": ks,
                 "translation": [(0.8, 0.5, 0.9)] * (n + 1)}]

    return K.finish(b, [group], label, action, idle, badge_at=0.8, badge_pos=(0, 0.45, 0.55), badge_size=0.8)


# ============================================================
# 龍が玉を掴む — 龍がうねりながら現れ、光る玉をつかむ
# ============================================================
def tex_scales(size=256, base=(40, 150, 90)):
    img = tex.vgrad((size, size), tuple(min(255, c + 30) for c in base), tuple(max(0, c - 30) for c in base))
    d = ImageDraw.Draw(img)
    for y in range(0, size + 16, 16):
        for x in range(0, size + 16, 16):
            ox = 8 if (y // 16) % 2 else 0
            d.arc([x + ox - 10, y - 10, x + ox + 10, y + 10], 20, 160, fill=tuple(max(0, c - 50) for c in base), width=2)
    return img


def build_dragon(cat, key, label):
    b = G.Builder()
    m_body = K.texmat(b, "dragon_scales", tex_scales(), rough=0.35, metal=0.2)
    m_belly = K.col(b, "dragon_belly", (240, 214, 120), rough=0.5)
    m_horn = K.col(b, "dragon_horn", (250, 236, 200), rough=0.4)
    m_eye = K.col(b, "dragon_eye", (255, 210, 40), rough=0.2, emissive=(0.4, 0.3, 0))
    m_pupil = K.col(b, "dragon_pupil", (10, 10, 10), rough=0.3)
    m_mane = K.col(b, "dragon_mane", (220, 50, 40), rough=0.6)
    m_orb = K.col(b, "dragon_orb", (255, 220, 120), rough=0.05, metal=0.1, emissive=(0.7, 0.5, 0.15))
    m_glow = glow_mat(b, "dragon_glow", (255, 220, 140), 128, 1.8)
    # 胴: S字の管。頭側(始点)が太く、尾に向かって細くなる
    path = K.bezier((0.45, 0.35, 0.1), (1.3, 0.9, -0.3), (-1.3, -0.1, -0.3), (-0.7, -0.9, -0.1), 30)
    path += K.bezier((-0.7, -0.9, -0.1), (-0.5, -1.2, 0), (0.2, -1.1, 0.05), (0.5, -0.8, 0.0), 12)[1:]
    n = len(path)
    radii = [0.13 * (1 - 0.85 * (i / (n - 1)) ** 1.3) + 0.012 for i in range(n)]
    body = K.tube(path, radii=radii, seg=12)
    # 背びれ(たてがみ): 胴に沿って小さな炎形
    mane = []
    for i in range(2, n - 6, 3):
        p0 = path[i]
        mane.append(K.transform(K.extrude([(-0.05, 0), (0.05, 0), (0.0, 0.12)], 0.02),
                                t=(p0[0], p0[1] + radii[i] * 0.9, p0[2]), s=(1.0, 0.9 + 0.3 * (1 - i / n), 1)))
    # 頭
    head = K.transform(G.sphere(0.2, 20, 12), s=(1.25, 0.85, 0.9), t=(0.62, 0.4, 0.12))
    snout = K.transform(K.rounded_box(0.28, 0.14, 0.2, r=0.06, n=3), t=(0.84, 0.36, 0.14))
    jaw = K.transform(K.rounded_box(0.26, 0.06, 0.16, r=0.03, n=2), t=(0.82, 0.25, 0.14))
    horns = [K.tube(K.bezier((0.55, 0.52, 0.12 + z), (0.5, 0.7, 0.14 + z), (0.38, 0.78, 0.12 + z), (0.3, 0.8, 0.1 + z), 8),
                    radii=[0.03 - 0.025 * k / 8 for k in range(9)], seg=8) for z in (-0.08, 0.08)]
    whisk = [K.tube(K.bezier((0.95, 0.38, 0.14 + z), (1.15, 0.36, 0.2 + z), (1.2, 0.2, 0.3 + z), (1.1, 0.1, 0.35 + z), 10),
                    0.008, 6) for z in (-0.06, 0.06)]
    eyes = [K.transform(G.sphere(0.045, 12, 8), t=(0.72, 0.47, 0.12 + z)) for z in (-0.12, 0.12)]
    pupils = [K.transform(G.sphere(0.02, 8, 6), t=(0.75, 0.47, 0.12 + z * 1.12)) for z in (-0.12, 0.12)]
    # 前足(玉をつかむ爪)
    arm = K.tube(K.bezier((0.3, 0.05, 0.1), (0.5, -0.1, 0.25), (0.6, -0.25, 0.35), (0.62, -0.32, 0.4), 10), 0.045, 10)
    claws = [K.transform(G.cylinder(0.002, 0.12, 8, r_top=0.018), t=(0.62 + dx, -0.4, 0.42 + dz), r=qz(180 + dx * 200))
             for dx, dz in ((-0.07, 0.0), (0.0, 0.05), (0.07, 0.0))]
    dragon_mesh = b.add_mesh([G.prim(K.merge(body, head, snout, arm), m_body), G.prim(jaw, m_belly),
                              G.prim(K.merge(*horns, *claws), m_horn), G.prim(K.merge(*mane, *whisk), m_mane),
                              G.prim(K.merge(*eyes), m_eye), G.prim(K.merge(*pupils), m_pupil)], "dragon")
    dragon = b.add_node("dragon", mesh=dragon_mesh, t=(0, 0, 0))
    orb_mesh = b.add_mesh([G.prim(G.sphere(0.13, 24, 14), m_orb)], "orb")
    glow_mesh = b.add_mesh([G.prim(G.plane(0.9, 0.9), m_glow)], "orb_glow")
    orb = b.add_node("orb", mesh=orb_mesh, t=(0.62, -0.52, 0.42))
    glow = b.add_node("glow", mesh=glow_mesh, t=(0.62, -0.52, 0.38), s=(0.4, 0.4, 0.4))
    group = b.add_node("group", children=[dragon, orb, glow], t=(-0.1, 0.15, 0), s=(0.95,) * 3)

    def action(root):
        return [{"node": dragon, "times": [0, 0.5, 0.8, 1.0],
                 "translation": [(1.2, 1.4, -0.4), (0.15, 0.25, -0.1), (-0.03, -0.02, 0.02), (0, 0, 0)],
                 "rotation": [qz(-30), qz(-8), qz(3), qz(0)]},
                {"node": orb, "times": [0, 0.8, 1.0, 1.15], "scale": [(1, 1, 1), (1, 1, 1), (1.25,) * 3, (1.1,) * 3]},
                {"node": glow, "times": [0, 0.85, 1.05, 1.3], "scale": [(0.4,) * 3, (0.4,) * 3, (1.9,) * 3, (1.5,) * 3]}]

    def idle(root):
        return [{"node": dragon, "times": [0, 0.8, 1.6],
                 "translation": [(0.5, 0.6, -0.2), (0.4, 0.75, -0.2), (0.5, 0.6, -0.2)],
                 "rotation": [qz(-12), qz(-6), qz(-12)]},
                {"node": glow, "times": [0, 0.8, 1.6], "scale": [(0.4,) * 3, (0.7,) * 3, (0.4,) * 3]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.1, badge_pos=(-0.2, 0.3, 0.75), badge_size=0.8)


# ============================================================
# 居合斬り — 一閃で巻藁が斬れる
# ============================================================
def tex_straw():
    img = tex.vgrad((256, 256), (214, 190, 120), (170, 144, 80))
    d = ImageDraw.Draw(img)
    rnd = random.Random(161)
    for i in range(160):
        x = rnd.randint(0, 256)
        d.line([(x, 0), (x + rnd.randint(-6, 6), 256)], fill=(150, 126, 70) if i % 2 else (230, 210, 150), width=1)
    return img


def build_iaido(cat, key, label):
    b = G.Builder()
    m_straw = K.texmat(b, "iaido_straw", tex_straw(), rough=0.9)
    m_cut = K.col(b, "iaido_cut", (236, 222, 170), rough=0.9)
    m_band = K.col(b, "iaido_band", (40, 30, 24), rough=0.8)
    m_wood = K.texmat(b, "iaido_stand", tex.wood((256, 256), (110, 72, 40), seed=162), rough=0.8)
    m_blade = K.col(b, "iaido_blade", (226, 232, 240), rough=0.08, metal=1.0)
    m_tsuba = gold(b, "iaido_tsuba")
    m_grip = K.col(b, "iaido_grip", (30, 30, 40), rough=0.7)
    m_slash = streak_mat(b, "iaido_slash", (220, 240, 255))
    R = 0.2
    low = K.merge(K.transform(G.cylinder(R, 0.7, 32), t=(0, -0.35, 0)),
                  K.transform(G.torus(R + 0.005, 0.015, 32, 6), t=(0, -0.55, 0)))
    up = K.merge(K.transform(G.cylinder(R, 0.55, 32, caps=False), t=(0, 0.275, 0)),
                 K.transform(G.torus(R + 0.005, 0.015, 32, 6), t=(0, 0.35, 0)))
    up_cap = K.transform(G.disc(R, 32), r=qx(-90), t=(0, 0.55, 0))
    cut_face = K.transform(G.disc(R, 32), r=qx(90), t=(0, 0.0, 0))
    lower_mesh = b.add_mesh([G.prim(low, m_straw), G.prim(K.transform(G.disc(R, 32), r=qx(-90), t=(0, 0.0, 0)), m_cut)], "straw_low")
    upper_mesh = b.add_mesh([G.prim(up, m_straw), G.prim(up_cap, m_straw), G.prim(cut_face, m_cut)], "straw_up")
    stand = K.merge(K.transform(K.rounded_box(0.8, 0.1, 0.5, r=0.03, n=2), t=(0, -0.75, 0)),
                    K.transform(G.cylinder(0.04, 0.3, 10), t=(0, -0.6, 0)))
    stand_mesh = b.add_mesh([G.prim(stand, m_wood)], "stand")
    lower = b.add_node("lower", mesh=lower_mesh, t=(0, -0.05, 0))
    upper = b.add_node("upper", mesh=upper_mesh, t=(0, -0.05, 0))
    standN = b.add_node("stand", mesh=stand_mesh)
    # 刀(刃先が+X)
    blade = K.extrude([(0, -0.02), (1.15, -0.02), (1.28, 0.03), (1.1, 0.04), (0, 0.025)], 0.012)
    tsuba = K.transform(G.cylinder(0.08, 0.02, 24), r=qz(90), t=(-0.02, 0, 0))
    grip = K.transform(K.rounded_box(0.32, 0.055, 0.04, r=0.02, n=2), t=(-0.2, 0, 0))
    sword_mesh = b.add_mesh([G.prim(blade, m_blade), G.prim(tsuba, m_tsuba), G.prim(grip, m_grip)], "katana")
    sword = b.add_node("sword", mesh=sword_mesh, t=(-1.2, 0.2, 0.35), r=qz(-18))
    slash_mesh = b.add_mesh([G.prim(G.plane(2.0, 0.28), m_slash)], "slash")
    slash = b.add_node("slash", mesh=slash_mesh, t=(0, -0.05, 0.28), r=qz(8), s=(0, 0, 0))
    group = b.add_node("group", children=[standN, lower, upper, sword, slash], t=(0, 0.05, 0))

    def action(root):
        return [{"node": sword, "times": [0, 0.3, 0.45, 0.6],
                 "translation": [(-1.2, 0.2, 0.35), (-1.2, 0.2, 0.35), (0.45, -0.12, 0.35), (0.55, -0.15, 0.3)],
                 "rotation": [qz(-18), qz(-18), qz(-4), qz(0)]},
                {"node": slash, "times": [0, 0.36, 0.46, 0.75], "scale": [(0, 0, 0), (0.1, 1, 1), (1.1, 1, 1), (0, 0.2, 1)]},
                {"node": upper, "times": [0, 0.6, 0.8, 1.0, 1.1],
                 "translation": [(0, -0.05, 0), (0, -0.05, 0), (0.12, -0.02, 0.05), (0.42, -0.3, 0.15), (0.48, -0.36, 0.18)],
                 "rotation": [qz(0), qz(0), qz(-10), qz(-60), qz(-72)]}]

    def idle(root):
        return [{"node": sword, "times": [0, 0.6, 1.2],
                 "translation": [(-1.2, 0.2, 0.35), (-1.16, 0.24, 0.35), (-1.2, 0.2, 0.35)],
                 "rotation": [qz(-18), qz(-14), qz(-18)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.95, badge_pos=(-0.1, 0.45, 0.6), badge_size=0.8)


# ============================================================
# UFOビーム — 光線で景品の箱を吸い上げる
# ============================================================
def build_ufo(cat, key, label):
    b = G.Builder()
    m_hull = K.col(b, "ufo_hull", (190, 196, 210), rough=0.25, metal=0.8)
    m_dome = K.col(b, "ufo_dome", (140, 220, 255), rough=0.05, alpha=0.55)
    m_light = K.col(b, "ufo_light", (255, 230, 90), rough=0.3, emissive=(1.0, 0.8, 0.2))
    m_beam = K.texmat(b, "ufo_beam", K.streak_image((150, 255, 190), 64, 256).rotate(90, expand=True), rough=1.0,
                      alpha_mode="BLEND", emissive=(1, 1, 1), emissive_texture=True, colors=0)
    m_box = K.col(b, "ufo_gift", (230, 50, 70), rough=0.4)
    m_rib = K.col(b, "ufo_ribbon", (255, 214, 90), rough=0.3, metal=0.4)
    prof = K.smooth_profile([(0.0, -0.1), (0.3, -0.12), (0.62, -0.03), (0.66, 0.0), (0.6, 0.05), (0.3, 0.1), (0.0, 0.11)], 4)
    hull = K.lathe(prof, 40)
    dome = K.transform(K.hemisphere(0.24, 24, 8), t=(0, 0.08, 0))
    lights = [K.transform(G.sphere(0.04, 10, 6), t=(math.cos(K.TAU * i / 10) * 0.6, 0.0, math.sin(K.TAU * i / 10) * 0.6))
              for i in range(10)]
    ufo_mesh = b.add_mesh([G.prim(hull, m_hull), G.prim(dome, m_dome), G.prim(K.merge(*lights), m_light)], "ufo")
    ufo = b.add_node("ufo", mesh=ufo_mesh, t=(0, 0.75, 0), r=qx(14))
    beam_geo = K.transform(G.cylinder(0.5, 1.3, 32, caps=False, r_top=0.18), t=(0, 0.0, 0))
    beam_mesh = b.add_mesh([G.prim(beam_geo, m_beam)], "beam")
    beam = b.add_node("beam", mesh=beam_mesh, t=(0, 0.02, 0), s=(1, 0, 1))
    box = K.rounded_box(0.34, 0.3, 0.34, r=0.03, n=2)
    ribbons = K.merge(K.transform(G.box(0.36, 0.31, 0.06)), K.transform(G.box(0.06, 0.31, 0.36)),
                      K.transform(G.torus(0.06, 0.02, 16, 6), r=qx(90), t=(-0.05, 0.19, 0), s=(1, 1, 1)),
                      K.transform(G.torus(0.06, 0.02, 16, 6), r=qx(90), t=(0.05, 0.19, 0), s=(1, 1, 1)))
    gift_mesh = b.add_mesh([G.prim(box, m_box), G.prim(ribbons, m_rib)], "gift")
    gift = b.add_node("gift", mesh=gift_mesh, t=(0, -0.68, 0.05))
    group = b.add_node("group", children=[ufo, beam, gift], t=(0, 0, 0))

    def action(root):
        return [{"node": ufo, "times": [0, 0.4, 0.7, 1.6],
                 "translation": [(-1.4, 1.1, 0), (0, 0.8, 0), (0, 0.75, 0), (0, 0.78, 0)],
                 "rotation": [qmul(qx(14), qz(15)), qmul(qx(14), qz(-6)), qx(14), qx(14)]},
                {"node": beam, "times": [0, 0.7, 0.85, 1.6], "scale": [(1, 0, 1), (1, 0, 1), (1, 1, 1), (1, 1, 1)]},
                {"node": gift, "times": [0, 0.9, 1.4, 1.5, 1.6],
                 "translation": [(0, -0.68, 0.05), (0, -0.68, 0.05), (0, -0.12, 0.08), (0, -0.08, 0.08), (0, -0.1, 0.08)],
                 "rotation": [qy(0), qy(0), qy(160), qy(180), qy(180)]}]

    def idle(root):
        return [{"node": ufo, "times": [0, 0.6, 1.2, 1.8, 2.4],
                 "translation": [(-0.3, 0.8, 0), (0, 0.86, 0), (0.3, 0.8, 0), (0, 0.74, 0), (-0.3, 0.8, 0)],
                 "rotation": [qmul(qx(14), qz(6)), qx(14), qmul(qx(14), qz(-6)), qx(14), qmul(qx(14), qz(6))]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.55, badge_pos=(0, 0.05, 0.6), badge_size=0.8)


# ============================================================
# 大砲・クラッカー砲 — ドンと紙吹雪が舞う
# ============================================================
CONFETTI = [(240, 60, 70), (250, 200, 50), (60, 150, 240), (80, 200, 120), (250, 130, 200), (255, 255, 255)]


def build_cannon(cat, key, label):
    b = G.Builder()
    m_iron = K.col(b, "cannon_iron", (50, 54, 62), rough=0.35, metal=0.7)
    m_gold = gold(b)
    m_wood = K.texmat(b, "cannon_wood", tex.wood((256, 256), (140, 84, 44), seed=171), rough=0.7)
    m_flash = glow_mat(b, "cannon_flash", (255, 230, 150), 128, 1.6)
    conf_m = [K.col(b, "confetti_%d" % i, c, rough=0.6) for i, c in enumerate(CONFETTI)]
    prof = K.smooth_profile([(0.0, -0.55), (0.2, -0.55), (0.24, -0.45), (0.2, -0.3), (0.16, 0.3), (0.19, 0.42), (0.19, 0.5),
                             (0.12, 0.5)], 3)
    barrel = K.lathe(prof, 32)
    bands = [K.transform(G.torus(r, 0.025, 32, 6), t=(0, y, 0)) for r, y in ((0.2, -0.3), (0.17, 0.1), (0.19, 0.44))]
    bore = K.transform(G.disc(0.12, 24), r=qx(-90), t=(0, 0.505, 0))
    barrel_mesh = b.add_mesh([G.prim(barrel, m_iron), G.prim(K.merge(*bands), m_gold),
                              G.prim(bore, K.col(b, "cannon_bore", (10, 10, 12), rough=1.0))], "barrel")
    barrelN = b.add_node("barrel", mesh=barrel_mesh, t=(0, 0.0, 0), r=qz(-48))
    carriage = K.merge(K.transform(K.rounded_box(0.9, 0.2, 0.5, r=0.04, n=2), t=(-0.1, -0.35, 0)))
    wheel = K.merge(K.transform(G.torus(0.26, 0.04, 28, 6), r=qx(90)),
                    *[K.transform(G.cylinder(0.02, 0.5, 8), r=qz(a)) for a in (0, 45, 90, 135)],
                    K.transform(G.cylinder(0.06, 0.1, 16), r=qx(90)))
    wheels = [K.transform(wheel, t=(-0.1, -0.45, z)) for z in (0.3, -0.3)]
    car_mesh = b.add_mesh([G.prim(carriage, m_wood), G.prim(K.merge(*wheels), m_gold)], "carriage")
    carN = b.add_node("carriage", mesh=car_mesh)
    muzzle = (0.37, 0.33, 0)
    flash_mesh = b.add_mesh([G.prim(G.plane(0.9, 0.9), m_flash)], "muzzle_flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0.4, 0.36, 0.1), s=(0, 0, 0))
    conf_meshes = [b.add_mesh([G.prim(G.plane(0.07, 0.11), m)], "confetti_%d" % i) for i, m in enumerate(conf_m)]
    rnd = random.Random(17)
    bits = []
    for i in range(28):
        a = deg(rnd.uniform(10, 80))
        sp = rnd.uniform(0.9, 1.6)
        dst = (muzzle[0] + math.cos(a) * sp * 0.8, muzzle[1] + math.sin(a) * sp * 0.6, rnd.uniform(-0.2, 0.5))
        land = (dst[0] + rnd.uniform(-0.2, 0.2), dst[1] - rnd.uniform(0.4, 0.8), dst[2])
        n = b.add_node("confetti_%d" % i, mesh=conf_meshes[i % len(conf_meshes)], t=muzzle, s=(0, 0, 0))
        bits.append((n, dst, land, rnd.uniform(-300, 300), rnd.uniform(-200, 200)))
    group = b.add_node("group", children=[carN, barrelN, flash] + [x[0] for x in bits], t=(-0.35, -0.15, 0))

    def action(root):
        tr = [{"node": barrelN, "times": [0, 0.35, 0.45, 0.7],
               "translation": [(0, 0, 0), (0, 0, 0), (-0.08, -0.05, 0), (0, 0, 0)]},
              {"node": carN, "times": [0, 0.35, 0.45, 0.7], "translation": [(0, 0, 0), (0, 0, 0), (-0.06, 0, 0), (0, 0, 0)]},
              {"node": flash, "times": [0, 0.36, 0.46, 0.7], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (0, 0, 0)]}]
        for n, dst, land, r1, r2 in bits:
            tr.append({"node": n, "times": [0, 0.38, 0.75, 1.6],
                       "translation": [muzzle, muzzle, dst, land],
                       "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1)],
                       "rotation": [qz(0), qz(0), qmul(qz(r1), qx(r2)), qmul(qz(r1 * 2), qx(r2 * 2))]})
        return tr

    def idle(root):
        return [{"node": barrelN, "times": [0, 0.5, 1.0], "rotation": [qz(-48), qz(-44), qz(-48)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.95, badge_pos=(0.2, 0.3, 0.7), badge_size=0.82)


# ============================================================
# 雷神の一撃 — 雷雲から稲妻が落ちる
# ============================================================
def tex_taiko(size=128):
    img = Image.new("RGB", (size, size), (246, 236, 214))
    d = ImageDraw.Draw(img)
    c = size / 2
    for k in range(3):
        a = math.radians(k * 120)
        x, y = c + math.cos(a) * size * 0.18, c + math.sin(a) * size * 0.18
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=(200, 30, 40))
    d.ellipse([4, 4, size - 4, size - 4], outline=(60, 40, 30), width=6)
    return img


def build_thunder(cat, key, label):
    b = G.Builder()
    m_cloud = K.col(b, "cloud", (120, 126, 146), rough=0.9)
    m_cloud2 = K.col(b, "cloud_light", (190, 196, 214), rough=0.9)
    m_bolt = K.col(b, "bolt", (255, 236, 90), rough=0.3, emissive=(1.0, 0.85, 0.2))
    m_flash = glow_mat(b, "thunder_flash", (255, 250, 200), 128, 1.6)
    m_drum = K.col(b, "taiko_body", (200, 40, 40), rough=0.4)
    m_skin = K.texmat(b, "taiko_skin", tex_taiko(), rough=0.7)
    m_ring = K.col(b, "taiko_ring", (214, 170, 72), rough=0.35, metal=0.7)
    rnd = random.Random(19)
    puffs_d, puffs_l = [], []
    for i in range(9):
        x = -0.6 + 1.2 * i / 8
        r = rnd.uniform(0.18, 0.3)
        g = K.lumpy(G.sphere(r, 16, 10), 0.08, i, 6.0)
        puffs_d.append(K.transform(g, t=(x, rnd.uniform(-0.05, 0.1), rnd.uniform(-0.1, 0.1))))
        if i % 2 == 0:
            puffs_l.append(K.transform(K.lumpy(G.sphere(r * 0.8, 14, 8), 0.08, i + 20, 6.0), t=(x + 0.05, 0.18, 0.08)))
    cloud_mesh = b.add_mesh([G.prim(K.merge(*puffs_d), m_cloud), G.prim(K.merge(*puffs_l), m_cloud2)], "cloud")
    cloud = b.add_node("cloud", mesh=cloud_mesh, t=(0, 0.6, 0))
    # 雷神の太鼓の輪(背後)
    ring = K.transform(G.torus(0.95, 0.03, 48, 6), r=qx(90), t=(0, 0.6, -0.4))
    drums_b, drums_s = [], []
    for i in range(8):
        a = K.TAU * i / 8
        x, y = math.cos(a) * 0.95, 0.6 + math.sin(a) * 0.95
        drums_b.append(K.transform(G.cylinder(0.13, 0.12, 20), r=qx(90), t=(x, y, -0.4)))
        drums_s.append(K.transform(G.disc(0.12, 20), t=(x, y, -0.338)))
    drum_mesh = b.add_mesh([G.prim(ring, m_ring), G.prim(K.merge(*drums_b), m_drum), G.prim(K.merge(*drums_s), m_skin)], "drums")
    drums = b.add_node("drums", mesh=drum_mesh)
    bolt_pts = [(-0.05, 0), (0.12, 0), (0.02, -0.45), (0.16, -0.45), (-0.08, -1.1), (0.0, -0.58), (-0.14, -0.58)]
    bolt = K.extrude(bolt_pts, 0.05)
    bolt_mesh = b.add_mesh([G.prim(bolt, m_bolt)], "bolt")
    boltN = b.add_node("bolt", mesh=bolt_mesh, t=(0, 0.45, 0.1), s=(1, 0, 1))
    flash_mesh = b.add_mesh([G.prim(G.plane(1.8, 1.8), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0, -0.5, 0.05), s=(0, 0, 0))
    group = b.add_node("group", children=[drums, cloud, boltN, flash], t=(0, 0.05, 0))

    def action(root):
        return [{"node": cloud, "times": [0, 0.15, 0.3, 0.45, 0.6],
                 "translation": [(0, 0.6, 0), (0.02, 0.62, 0), (-0.02, 0.6, 0), (0.02, 0.62, 0), (0, 0.6, 0)]},
                {"node": drums, "times": [0, 0.7, 1.0], "rotation": [qz(0), qz(30), qz(45)]},
                {"node": boltN, "times": [0, 0.55, 0.65, 0.72, 0.8, 1.5],
                 "scale": [(1, 0, 1), (1, 0, 1), (1, 1, 1), (1, 0.9, 1), (1, 1, 1), (1, 1, 1)]},
                {"node": flash, "times": [0, 0.62, 0.72, 0.95, 1.2], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (0.8,) * 3, (0.9,) * 3]}]

    def idle(root):
        return [{"node": drums, "times": [0, 1.2, 2.4], "rotation": [qz(0), qz(22.5), qz(45)]},
                {"node": cloud, "times": [0, 0.6, 1.2, 1.8, 2.4],
                 "translation": [(0, 0.6, 0), (0, 0.64, 0), (0, 0.6, 0), (0, 0.64, 0), (0, 0.6, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.95, badge_pos=(0, -0.45, 0.55), badge_size=0.84)


# ============================================================
# 超パンチ — グローブが的を打ち抜く
# ============================================================
def build_punch(cat, key, label):
    b = G.Builder()
    m_glove = K.col(b, "glove", (220, 30, 40), rough=0.25, metal=0.05)
    m_cuff = K.col(b, "glove_cuff", (246, 246, 244), rough=0.4)
    m_lace = K.col(b, "glove_lace", (250, 250, 250), rough=0.5)
    m_pad = K.texmat(b, "punch_pad", tex_target(512, ((40, 110, 230), (250, 248, 240))), rough=0.5, colors=32)
    m_frame = K.col(b, "punch_frame", (60, 64, 74), rough=0.4, metal=0.5)
    m_ring = shockwave(b, "punch_ring", (255, 240, 180))
    m_flash = glow_mat(b, "punch_flash", (255, 240, 180), 128, 1.8)
    # グローブ(+Xが拳の正面)
    fist = K.transform(G.sphere(0.3, 28, 16), s=(1.05, 0.9, 1.0))
    thumb = K.transform(G.sphere(0.12, 16, 10), s=(1.4, 0.8, 0.8), t=(0.05, -0.12, 0.24), r=qz(20))
    cuff = K.transform(G.cylinder(0.2, 0.3, 28), r=qz(90), t=(-0.36, -0.02, 0))
    lace = K.transform(G.torus(0.2, 0.015, 28, 6), r=qz(90), t=(-0.25, -0.02, 0))
    glove_mesh = b.add_mesh([G.prim(K.merge(fist, thumb), m_glove), G.prim(cuff, m_cuff), G.prim(lace, m_lace)], "glove")
    glove = b.add_node("glove", mesh=glove_mesh, t=(-0.9, 0.0, 0.25), r=qy(-15))
    pad = K.transform(G.cylinder(0.42, 0.12, 48), r=qz(90))
    pad_face = K.transform(G.disc(0.42, 48), r=qy(-90), t=(-0.062, 0, 0))
    frame = K.merge(K.transform(G.cylinder(0.035, 1.1, 10), t=(0.12, -0.5, 0)),
                    K.transform(K.rounded_box(0.6, 0.08, 0.5, r=0.03, n=2), t=(0.12, -1.05, 0)))
    pad_mesh = b.add_mesh([G.prim(pad, m_frame), G.prim(pad_face, m_pad)], "pad")
    frame_mesh = b.add_mesh([G.prim(frame, m_frame)], "frame")
    padN = b.add_node("pad", mesh=pad_mesh, t=(0.6, 0.05, 0), r=qy(40))
    frameN = b.add_node("frame", mesh=frame_mesh, t=(0.6, 0.05, 0))
    ring_mesh = b.add_mesh([G.prim(G.plane(1.2, 1.2), m_ring)], "ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(0.35, 0.05, 0.3), r=qy(-30), s=(0, 0, 0))
    flash_mesh = b.add_mesh([G.prim(G.plane(1.0, 1.0), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0.35, 0.05, 0.32), s=(0, 0, 0))
    group = b.add_node("group", children=[frameN, padN, glove, ring, flash], t=(0, 0.1, 0))

    def action(root):
        return [{"node": glove, "times": [0, 0.3, 0.5, 0.58, 0.8, 1.0],
                 "translation": [(-0.9, 0, 0.25), (-1.1, 0.02, 0.3), (0.1, 0, 0.2), (0.05, 0, 0.2), (-0.35, -0.05, 0.3), (-0.4, -0.05, 0.3)],
                 "rotation": [qy(-15), qmul(qy(-15), qz(10)), qy(-25), qy(-25), qy(-15), qy(-15)]},
                {"node": padN, "times": [0, 0.5, 0.58, 0.7, 0.85, 1.0],
                 "rotation": [qy(40), qy(40), qmul(qy(40), qz(-30)), qmul(qy(40), qz(15)), qmul(qy(40), qz(-6)), qy(40)],
                 "scale": [(1, 1, 1), (1, 1, 1), (0.7, 1.1, 1.1), (1.05, 0.97, 0.97), (1, 1, 1), (1, 1, 1)]},
                {"node": ring, "times": [0, 0.52, 0.95, 0.97], "scale": [(0, 0, 0), (0.2,) * 3, (1.7,) * 3, (0, 0, 0)]},
                {"node": flash, "times": [0, 0.5, 0.58, 0.8], "scale": [(0, 0, 0), (0, 0, 0), (1.4,) * 3, (0, 0, 0)]}]

    def idle(root):
        return [{"node": glove, "times": [0, 0.25, 0.5, 0.75, 1.0],
                 "translation": [(-0.9, 0, 0.25), (-0.85, 0.04, 0.25), (-0.9, 0, 0.25), (-0.85, 0.04, 0.25), (-0.9, 0, 0.25)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.85, badge_pos=(0.1, 0.55, 0.6), badge_size=0.8)


# ============================================================
# パチンコ — 玉が釘を抜けて入賞し、液晶がそろう
# ============================================================
def tex_pachinko_board():
    W, H = 512, 640
    img = tex.rgrad((W, H), (70, 120, 220), (20, 40, 110), cy=0.4)
    d = ImageDraw.Draw(img)
    rnd = random.Random(181)
    for i in range(70):
        x, y = rnd.randint(20, W - 20), rnd.randint(20, H - 20)
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 255))
    d.arc([10, 10, W - 10, H * 1.3], 180, 360, fill=(255, 214, 110), width=10)
    tex.draw_text(img, "FEVER", (130, 40, 382, 110), fill=(255, 230, 120), stroke=(160, 40, 20), stroke_w=5, shadow=False)
    return img


def tex_lcd(digits):
    img = Image.new("RGB", (384, 160), (20, 20, 30))
    d = ImageDraw.Draw(img)
    for i, ch in enumerate(digits):
        x0 = 12 + i * 124
        d.rounded_rectangle([x0, 12, x0 + 112, 148], 14, fill=(250, 248, 240))
        tex.draw_text(img, ch, (x0 + 10, 18, x0 + 102, 142), fill=(220, 30, 40) if ch == "7" else (40, 90, 200),
                      stroke=(100, 10, 16), stroke_w=4, shadow=False)
    return img


def build_pachinko(cat, key, label):
    b = G.Builder()
    win = key not in ("hazure", "cookie")
    m_board = K.texmat(b, "pachinko_board", tex_pachinko_board(), rough=0.5)
    m_frame = K.col(b, "pachinko_frame", (230, 232, 238), rough=0.25, metal=0.6)
    m_glass = K.col(b, "pachinko_glass", (220, 236, 255), rough=0.05, alpha=0.14)
    m_pin = K.col(b, "pachinko_pin", (230, 200, 120), rough=0.2, metal=0.9)
    m_ball = K.col(b, "pachinko_ball", (230, 234, 240), rough=0.08, metal=1.0)
    m_lcd_idle = K.texmat(b, "pachinko_lcd_idle", tex_lcd("?? ?".replace(" ", "")), rough=0.3, emissive=(0.6, 0.6, 0.6),
                          emissive_texture=True)
    m_lcd = K.texmat(b, "pachinko_lcd", tex_lcd("777" if win else "773"), rough=0.3, emissive=(0.8, 0.8, 0.8),
                     emissive_texture=True)
    m_tulip = K.col(b, "pachinko_tulip", (240, 60, 90), rough=0.3)
    m_glow = glow_mat(b, "pachinko_glow", (255, 230, 150), 128, 1.8)
    W, H = 1.2, 1.5
    frame = K.rounded_box(W + 0.12, H + 0.12, 0.12, r=0.05, n=3)
    board = K.transform(G.plane(W, H), t=(0, 0, 0.062))
    glass = K.transform(G.plane(W, H), t=(0, 0, 0.16))
    tray = K.transform(K.rounded_box(W, 0.2, 0.3, r=0.06, n=2), t=(0, -H / 2 - 0.12, 0.1))
    pins = []
    for row in range(6):
        for col in range(6 if row % 2 else 5):
            x = -0.45 + col * 0.18 + (0.09 if row % 2 == 0 else 0)
            y = 0.5 - row * 0.12
            if abs(x) < 0.3 and -0.1 < y < 0.35:
                continue
            pins.append(K.transform(G.cylinder(0.01, 0.1, 6, caps=False), r=qx(90), t=(x, y, 0.11)))
    for col in range(5):
        x = -0.36 + col * 0.18
        pins.append(K.transform(G.cylinder(0.01, 0.1, 6, caps=False), r=qx(90), t=(x, -0.42, 0.11)))
    tulip = K.transform(K.hemisphere(0.08, 16, 5, top=False), t=(0, -0.28, 0.1))
    lcd_frame = K.transform(K.rounded_box(0.56, 0.3, 0.05, r=0.03, n=2), t=(0, 0.12, 0.08))
    mesh = b.add_mesh([G.prim(frame, m_frame), G.prim(board, m_board), G.prim(K.merge(*pins), m_pin),
                       G.prim(tulip, m_tulip), G.prim(K.merge(tray, lcd_frame), m_frame)], "pachinko")
    glass_mesh = b.add_mesh([G.prim(glass, m_glass)], "glass")
    lcd_idle = b.add_mesh([G.prim(K.transform(G.plane(0.5, 0.22), t=(0, 0.12, 0.108)), m_lcd_idle)], "lcd_idle")
    lcd_res = b.add_mesh([G.prim(K.transform(G.plane(0.5, 0.22), t=(0, 0.12, 0.109)), m_lcd)], "lcd_result")
    machine = b.add_node("machine", mesh=mesh)
    glassN = b.add_node("glass", mesh=glass_mesh)
    lcdI = b.add_node("lcd_idle", mesh=lcd_idle)
    lcdR = b.add_node("lcd_result", mesh=lcd_res, s=(0, 0, 0))
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.035, 14, 8), m_ball)], "ball")
    ball = b.add_node("ball", mesh=ball_mesh, t=(0.52, -0.6, 0.11))
    glow_mesh = b.add_mesh([G.prim(G.plane(0.9, 0.6), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, 0.12, 0.12), s=(0, 0, 0))
    group = b.add_node("group", children=[machine, lcdI, lcdR, glow, ball, glassN], t=(0, 0.05, 0))

    def action(root):
        path = [(0.52, -0.6), (0.54, 0.2), (0.4, 0.62), (0.0, 0.7), (-0.35, 0.58), (-0.3, 0.44), (-0.2, 0.38),
                (-0.25, 0.26), (-0.18, 0.02), (-0.08, -0.08), (-0.1, -0.16), (0.0, -0.26)]
        ts = [0.1 + 1.1 * i / (len(path) - 1) for i in range(len(path))]
        return [{"node": ball, "times": [0.0] + ts + [ts[-1] + 0.08],
                 "translation": [(0.52, -0.6, 0.11)] + [(x, y, 0.11) for x, y in path] + [(0, -0.26, 0.11)],
                 "scale": [(1, 1, 1)] * (len(path) + 1) + [(0, 0, 0)]},
                {"node": lcdR, "times": [0, 1.25, 1.35], "scale": [(0, 0, 0), (0, 0, 0), (1, 1, 1)]},
                {"node": glow, "times": [0, 1.25, 1.4, 1.6], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (1,) * 3] if win
                 else [(0, 0, 0)] * 4}]

    def idle(root):
        return [{"node": ball, "times": [0, 0.4, 0.8, 1.2],
                 "translation": [(0.52, -0.6, 0.11), (0.54, 0.2, 0.11), (0.4, 0.62, 0.11), (0.52, -0.6, 0.11)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.45, badge_pos=(0, 0.5, 0.45), badge_size=0.8)

BUILDERS = {
    "dice": build_dice,
    "treasure": build_treasure,
    "box": build_box,
    "gacha": build_gacha,
    "slot": build_slot,
    "daruma": build_daruma,
    "omikuji": build_omikuji,
    "garagara": build_garagara,
    "amida": build_amida,
    "scratch": build_scratch,
    "darts": build_darts,
    "roulette": build_roulette,
    "cat": build_cat,
    "mallet": build_mallet,
    "lantern": build_lantern,
    "firework": build_firework,
    "fan": build_fan,
    "airlottery": build_airlottery,
    "jet": build_jet,
    "rocket": build_rocket,
    "meteor": build_meteor,
    "shuriken": build_shuriken,
    "dragon": build_dragon,
    "iaido": build_iaido,
    "ufo": build_ufo,
    "cannon": build_cannon,
    "thunder": build_thunder,
    "punch": build_punch,
    "pachinko": build_pachinko,
}
