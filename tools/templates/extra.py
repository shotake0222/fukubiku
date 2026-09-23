# -*- coding: utf-8 -*-
"""2026-09 追加の20カテゴリ。
#
#   ゲーム・イベント: くす玉 / ビンゴ / 力試し / サッカーPK / バスケット / 水晶玉 / プレゼント箱
#   季節            : スイカ割り / 雪だるま / 凧揚げ / こいのぼり / お月見 / 風鈴 / 重箱(おせち)
#   業種            : ラーメン / コーヒー / トースター / ビール / ケーキ / ピザ
#
# 出力の約束は build.py / legacy.py と同じ。
"""
import math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)

import glbwrite as G
import tex
import kit as K
from kit import deg, qx, qy, qz, qmul
from legacy import gold, glow_mat, streak_mat, shockwave, CONFETTI, SERIF, SANS
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIN = lambda key: key not in ("hazure", "cookie")


def confetti_burst(b, origin, count=24, spread=(1.2, 0.9), seed=5, prefix="confetti"):
    """紙吹雪。(ノード, 行き先, 着地点, 回転)のリストを返す。"""
    mats = [K.col(b, "%s_%d" % (prefix, i), c, rough=0.6) for i, c in enumerate(CONFETTI)]
    meshes = [b.add_mesh([G.prim(G.plane(0.06, 0.1), m)], "%s_%d" % (prefix, i)) for i, m in enumerate(mats)]
    rnd = random.Random(seed)
    out = []
    for i in range(count):
        a = rnd.uniform(0, K.TAU)
        dst = (origin[0] + math.cos(a) * rnd.uniform(0.3, 1) * spread[0],
               origin[1] + abs(math.sin(a)) * rnd.uniform(0.2, 1) * spread[1], origin[2] + rnd.uniform(-0.1, 0.4))
        land = (dst[0] + rnd.uniform(-0.15, 0.15), dst[1] - rnd.uniform(0.5, 0.9), dst[2])
        n = b.add_node("%s_%d" % (prefix, i), mesh=meshes[i % len(meshes)], t=origin, s=(0, 0, 0))
        out.append((n, dst, land, rnd.uniform(-300, 300), rnd.uniform(-200, 200)))
    return out


def confetti_tracks(bits, origin, t0, t1=None):
    t1 = t1 or t0 + 1.0
    tr = []
    for n, dst, land, r1, r2 in bits:
        tr.append({"node": n, "times": [0, t0, t0 + 0.35, t1],
                   "translation": [origin, origin, dst, land],
                   "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1), (1, 1, 1)],
                   "rotation": [qz(0), qz(0), qmul(qz(r1), qx(r2)), qmul(qz(r1 * 2), qx(r2 * 2))]})
    return tr


# ============================================================
# くす玉 — 割れて垂れ幕が下りる
# ============================================================
def tex_banner(text):
    img = tex.paper((256, 640), (252, 250, 244), seed=201)
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 248, 632], outline=(200, 30, 40), width=10)
    f = ImageFont.truetype(SERIF, 150)
    for i, ch in enumerate(text):
        l, t, r, bb = d.textbbox((0, 0), ch, font=f)
        d.text((128 - (r - l) / 2 - l, 60 + i * 190 - t), ch, font=f, fill=(196, 24, 32))
    return img


def build_kusudama(cat, key, label):
    b = G.Builder()
    m_gold = K.col(b, "kusudama_gold", (236, 184, 60), rough=0.3, metal=0.7)
    m_red = K.col(b, "kusudama_red", (210, 30, 40), rough=0.4)
    m_inner = K.col(b, "kusudama_inner", (250, 236, 200), rough=0.7)
    banner_text = "祝当選" if WIN(key) else ("参加賞" if key == "cookie" else "おしい")
    m_banner = K.texmat(b, "kusudama_banner", tex_banner(banner_text), rough=0.8)
    R = 0.42
    half = K.hemisphere(R, 24, 8)
    inner = K.flip(K.hemisphere(R * 0.98, 24, 8))
    band = K.transform(G.torus(R, 0.025, 32, 6), r=qx(90), s=(1, 1, 1))
    left = K.transform(K.merge(half), r=qz(90))
    left_in = K.transform(inner, r=qz(90))
    right = K.transform(half, r=qz(-90))
    right_in = K.transform(inner, r=qz(-90))
    lh_mesh = b.add_mesh([G.prim(left, m_gold), G.prim(left_in, m_inner),
                          G.prim(K.transform(G.torus(R * 0.72, 0.03, 28, 6), r=qz(90), t=(-R * 0.7, 0, 0)), m_red)], "half_l")
    rh_mesh = b.add_mesh([G.prim(right, m_gold), G.prim(right_in, m_inner),
                          G.prim(K.transform(G.torus(R * 0.72, 0.03, 28, 6), r=qz(90), t=(R * 0.7, 0, 0)), m_red)], "half_r")
    lh = b.add_node("half_l", mesh=lh_mesh, t=(0, -R, 0))
    rh = b.add_node("half_r", mesh=rh_mesh, t=(0, -R, 0))
    pl = b.add_node("pivot_l", children=[lh], t=(-0.02, R, 0))
    pr = b.add_node("pivot_r", children=[rh], t=(0.02, R, 0))
    cord = K.merge(K.transform(G.cylinder(0.02, 0.5, 8), t=(0, R + 0.25, 0)),
                   K.transform(G.torus(0.06, 0.015, 16, 6), r=qx(90), t=(0, R + 0.03, 0)))
    tassel = K.transform(G.cylinder(0.015, 0.4, 8, r_top=0.035), t=(0, -R - 0.22, 0))
    cord_mesh = b.add_mesh([G.prim(cord, m_red), G.prim(tassel, m_red)], "cord")
    cordN = b.add_node("cord", mesh=cord_mesh)
    banner_mesh = b.add_mesh([G.prim(K.transform(G.plane(0.4, 1.0), t=(0, -0.5, 0)), m_banner)], "banner")
    banner = b.add_node("banner", mesh=banner_mesh, t=(0, 0.1, 0.02), s=(1, 0, 1))
    bits = confetti_burst(b, (0, 0.0, 0.1), 26, (1.1, 0.7), 9)
    group = b.add_node("group", children=[cordN, pl, pr, banner] + [x[0] for x in bits], t=(0, 0.3, 0))

    def action(root):
        tr = [{"node": group, "times": [0, 0.15, 0.3, 0.45, 0.6],
               "rotation": [qz(0), qz(4), qz(-4), qz(2), qz(0)]},
              {"node": pl, "times": [0, 0.55, 0.8, 0.95, 1.1], "rotation": [qz(0), qz(0), qz(-78), qz(-66), qz(-70)]},
              {"node": pr, "times": [0, 0.55, 0.8, 0.95, 1.1], "rotation": [qz(0), qz(0), qz(78), qz(66), qz(70)]},
              {"node": banner, "times": [0, 0.7, 1.05, 1.15], "scale": [(1, 0, 1), (1, 0, 1), (1, 1.05, 1), (1, 1, 1)]}]
        tr += confetti_tracks(bits, (0, 0.0, 0.1), 0.62, 1.7)
        return tr

    def idle(root):
        return [{"node": group, "times": [0, 0.5, 1.0, 1.5, 2.0], "rotation": [qz(0), qz(5), qz(0), qz(-5), qz(0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.15, badge_pos=(0, -0.2, 0.3), badge_size=0.8)


# ============================================================
# ビンゴ — 穴が次々と開いて一列そろう
# ============================================================
BINGO_NUMS = [[3, 17, 34, 49, 62], [11, 25, 38, 52, 70], [7, 22, 0, 57, 66], [14, 29, 41, 46, 73], [9, 19, 31, 55, 61]]


def tex_bingo_card():
    W, H = 512, 600
    img = Image.new("RGB", (W, H), (252, 250, 244))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 100], fill=(40, 110, 220))
    f = ImageFont.truetype(SANS, 70)
    for i, ch in enumerate("BINGO"):
        l, t, r, bb = d.textbbox((0, 0), ch, font=f)
        d.text((51 + i * 102 - (r - l) / 2 - l, 50 - (bb - t) / 2 - t), ch, font=f, fill=(255, 255, 255))
    f2 = ImageFont.truetype(SANS, 44)
    for row in range(5):
        for col in range(5):
            x0, y0 = col * 102, 100 + row * 100
            d.rectangle([x0, y0, x0 + 102, y0 + 100], outline=(40, 110, 220), width=4)
            n = BINGO_NUMS[row][col]
            text = "FREE" if n == 0 else str(n)
            ff = ImageFont.truetype(SANS, 26) if n == 0 else f2
            l, t, r, bb = d.textbbox((0, 0), text, font=ff)
            d.text((x0 + 51 - (r - l) / 2 - l, y0 + 50 - (bb - t) / 2 - t), text, font=ff, fill=(40, 40, 50))
    return img


def build_bingo(cat, key, label):
    b = G.Builder()
    m_card = K.texmat(b, "bingo_card", tex_bingo_card(), rough=0.6)
    m_back = K.col(b, "bingo_back", (40, 110, 220), rough=0.5)
    m_mark = K.col(b, "bingo_mark", (236, 40, 60), rough=0.35)
    m_line = K.texmat(b, "bingo_line", K.streak_image((255, 220, 90)), rough=1.0, alpha_mode="BLEND",
                      emissive=(1, 1, 1), emissive_texture=True, colors=0)
    m_easel = K.texmat(b, "bingo_easel", tex.wood((128, 256), (150, 100, 56), seed=202, vertical=True), rough=0.7)
    W, H = 1.02, 1.2
    card = K.transform(G.plane(W, H), t=(0, 0, 0.012))
    back_ = K.rounded_box(W + 0.04, H + 0.04, 0.02, r=0.01, n=1, face_uv=False)
    easel = K.merge(K.tube([(-0.35, -0.75, 0.1), (-0.3, -0.5, -0.02)], 0.03, 8),
                    K.tube([(0.35, -0.75, 0.1), (0.3, -0.5, -0.02)], 0.03, 8),
                    K.tube([(0, -0.75, -0.35), (0, 0.3, -0.05)], 0.03, 8),
                    K.transform(K.rounded_box(1.0, 0.05, 0.12, r=0.02, n=1), t=(0, -0.6, 0.04)))
    card_mesh = b.add_mesh([G.prim(back_, m_back), G.prim(card, m_card)], "bingo_card")
    easel_mesh = b.add_mesh([G.prim(easel, m_easel)], "easel")
    cardN = b.add_node("card", mesh=card_mesh, r=qx(-8))
    easelN = b.add_node("easel", mesh=easel_mesh)
    mark_mesh = b.add_mesh([G.prim(K.transform(G.cylinder(0.075, 0.02, 24), r=qx(90)), m_mark)], "mark")

    def cell(row, col):
        return (-W / 2 + (col + 0.5) * W / 5, H / 2 - (100 / 600) * H - (row + 0.5) * (500 / 600) * H / 5, 0.03)
    # 斜め一列(当たり)/ 1つだけ足りない(はずれ)
    diag = [(i, i) for i in range(5)]
    extra = [(0, 3), (3, 1), (4, 2)]
    order = extra + (diag if WIN(key) else diag[:2] + diag[3:])
    marks = []
    for i, (r_, c_) in enumerate(order):
        marks.append((b.add_node("mark_%d" % i, mesh=mark_mesh, t=cell(r_, c_), s=(0, 0, 0)), i))
    line_mesh = b.add_mesh([G.prim(G.plane(1.7, 0.18), m_line)], "bingo_line")
    line = b.add_node("line", mesh=line_mesh, t=(0, cell(2, 2)[1], 0.05),
                      r=qz(-math.degrees(math.atan2(H * 500 / 600, W))), s=(0, 0, 0))
    cardN_children = [m[0] for m in marks] + [line]
    b.nodes[cardN]["children"] = cardN_children
    group = b.add_node("group", children=[easelN, cardN], t=(0, 0.1, 0))

    def action(root):
        tr = []
        for n, i in marks:
            t0 = 0.15 + i * 0.14
            tr.append({"node": n, "times": [0, t0, t0 + 0.1, t0 + 0.18],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.3, 1.3, 1.3), (1, 1, 1)]})
        if WIN(key):
            t0 = 0.15 + len(marks) * 0.14
            tr.append({"node": line, "times": [0, t0, t0 + 0.25], "scale": [(0, 0, 0), (0, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        return [{"node": cardN, "times": [0, 0.8, 1.6], "rotation": [qx(-8), qmul(qx(-8), qz(3)), qx(-8)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.45, badge_pos=(0, 0.1, 0.4), badge_size=0.84)


# ============================================================
# 力試し(ハイストライカー) — ハンマーで打つと玉が鐘まで上がる
# ============================================================
def tex_striker():
    W, H = 128, 1024
    img = Image.new("RGB", (W, H), (250, 244, 230))
    d = ImageDraw.Draw(img)
    cols = [(230, 40, 50), (250, 140, 40), (250, 210, 50), (80, 190, 90), (60, 140, 230)]
    for i in range(10):
        y0 = i * H / 10
        d.rectangle([12, y0 + 6, W - 12, y0 + H / 10 - 6], fill=cols[i // 2])
    return img


def build_striker(cat, key, label):
    b = G.Builder()
    m_scale = K.texmat(b, "striker_scale", tex_striker(), rough=0.5)
    m_wood = K.texmat(b, "striker_wood", tex.wood((128, 256), (170, 110, 60), seed=203, vertical=True), rough=0.7)
    m_bell = K.col(b, "striker_bell", (240, 190, 60), rough=0.2, metal=0.9)
    m_pad = K.col(b, "striker_pad", (220, 40, 50), rough=0.4)
    m_puck = K.col(b, "striker_puck", (250, 250, 250), rough=0.2, metal=0.3)
    m_head = K.col(b, "hammer_head", (60, 60, 70), rough=0.4, metal=0.5)
    m_glow = glow_mat(b, "striker_glow", (255, 230, 140), 128, 1.8)
    tower = K.transform(K.rounded_box(0.22, 2.0, 0.12, r=0.03, n=2), t=(0, 0.15, 0))
    scale_pl = K.transform(G.plane(0.16, 1.9), t=(0, 0.15, 0.062))
    base = K.transform(K.rounded_box(0.8, 0.12, 0.5, r=0.03, n=2), t=(0, -0.92, 0.05))
    pad = K.transform(G.cylinder(0.14, 0.08, 24), t=(0.26, -0.83, 0.1))
    bell = K.transform(K.hemisphere(0.16, 24, 8), t=(0, 1.18, 0.04))
    tower_mesh = b.add_mesh([G.prim(K.merge(tower, base), m_wood), G.prim(scale_pl, m_scale),
                             G.prim(pad, m_pad), G.prim(bell, m_bell)], "tower")
    towerN = b.add_node("tower", mesh=tower_mesh)
    puck_mesh = b.add_mesh([G.prim(K.transform(G.cylinder(0.07, 0.05, 20), r=qx(90)), m_puck)], "puck")
    puck = b.add_node("puck", mesh=puck_mesh, t=(0, -0.72, 0.1))
    handle = K.transform(G.cylinder(0.035, 0.9, 12), t=(0, 0.45, 0))
    head = K.transform(K.rounded_box(0.34, 0.16, 0.16, r=0.04, n=2), t=(0, 0.92, 0))
    hammer_mesh = b.add_mesh([G.prim(handle, m_wood), G.prim(head, m_head)], "hammer")
    hammer = b.add_node("hammer", mesh=hammer_mesh, t=(0.75, -0.85, 0.25), r=qz(60))
    glow_mesh = b.add_mesh([G.prim(G.plane(0.9, 0.9), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, 1.18, 0.08), s=(0, 0, 0))
    group = b.add_node("group", children=[towerN, puck, hammer, glow], t=(0, -0.1, 0), s=(0.85,) * 3)
    top = 1.0 if WIN(key) else 0.2

    def action(root):
        return [{"node": hammer, "times": [0, 0.3, 0.5, 0.6],
                 "rotation": [qz(60), qz(80), qz(-4), qz(4)]},
                {"node": puck, "times": [0, 0.5, 0.95, 1.05, 1.5],
                 "translation": [(0, -0.72, 0.1), (0, -0.72, 0.1), (0, top, 0.1), (0, top - 0.04, 0.1),
                                 (0, top - 0.04 if WIN(key) else -0.72, 0.1)]},
                {"node": glow, "times": [0, 0.95, 1.1, 1.4],
                 "scale": [(0, 0, 0), (0, 0, 0), (1.4,) * 3, (1.1,) * 3] if WIN(key) else [(0, 0, 0)] * 4},
                {"node": towerN, "times": [0, 0.5, 0.55, 0.62], "translation": [(0, 0, 0), (0, 0, 0), (0, -0.02, 0), (0, 0, 0)]}]

    def idle(root):
        return [{"node": hammer, "times": [0, 0.6, 1.2], "rotation": [qz(60), qz(70), qz(60)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.15, badge_pos=(0, 0.35, 0.5), badge_size=0.8)


# ============================================================
# サッカーPK — シュートがゴールに突き刺さる
# ============================================================
def tex_soccer(W=512, H=256):
    img = Image.new("RGB", (W, H), (250, 250, 250))
    d = ImageDraw.Draw(img)
    phi = (1 + 5 ** 0.5) / 2
    verts = []
    for a, bb in ((1, phi), (-1, phi), (1, -phi), (-1, -phi)):
        verts += [(0, a, bb), (a, bb, 0), (bb, 0, a)]
    for x, y, z in verts:
        l = math.sqrt(x * x + y * y + z * z)
        x, y, z = x / l, y / l, z / l
        # G.sphere の UV: u = θ/2π (x=cosθ, z=sinθ), v = φ/π (y=cosφ)
        th = math.atan2(z, x) % K.TAU
        ph = math.acos(max(-1, min(1, y)))
        u, v = th / K.TAU * W, ph / math.pi * H
        rr = 26
        sx = rr / max(0.25, math.sin(ph))
        for off in (-W, 0, W):
            pts = [(u + off + math.cos(K.TAU * k / 5) * sx, v + math.sin(K.TAU * k / 5) * rr) for k in range(5)]
            d.polygon(pts, fill=(30, 30, 34))
    return img


def build_soccer(cat, key, label):
    b = G.Builder()
    m_post = K.col(b, "goal_post", (248, 248, 248), rough=0.3)
    net = Image.new("RGBA", (256, 256), (255, 255, 255, 0))
    dn = ImageDraw.Draw(net)
    for i in range(0, 256, 22):
        dn.line([(i, 0), (i, 256)], fill=(255, 255, 255, 220), width=3)
        dn.line([(0, i), (256, i)], fill=(255, 255, 255, 220), width=3)
    m_net = K.texmat(b, "goal_net", net, rough=0.8, alpha_mode="BLEND", colors=0)
    m_grass = K.texmat(b, "grass", tex.stripes((256, 256), (70, 160, 70), (90, 180, 90), pitch=64), rough=0.9)
    m_ball = K.texmat(b, "soccer_ball", tex_soccer(), rough=0.35, colors=16)
    GW, GH, GD = 1.6, 0.8, 0.5
    posts = K.merge(K.transform(G.cylinder(0.035, GH, 12), t=(-GW / 2, 0, 0)),
                    K.transform(G.cylinder(0.035, GH, 12), t=(GW / 2, 0, 0)),
                    K.transform(G.cylinder(0.035, GW + 0.07, 12), r=qz(90), t=(0, GH / 2, 0)))
    net_back = K.transform(G.plane(GW, GH), t=(0, 0, -GD))
    net_sides = K.merge(K.transform(G.plane(GD, GH), r=qy(90), t=(-GW / 2, 0, -GD / 2)),
                        K.transform(G.plane(GD, GH), r=qy(-90), t=(GW / 2, 0, -GD / 2)),
                        K.transform(G.plane(GW, GD), r=qx(90), t=(0, GH / 2, -GD / 2)))
    grass = K.transform(K.rounded_box(2.2, 0.06, 1.4, r=0.02, n=1), t=(0, -GH / 2 - 0.03, -0.1))
    goal_mesh = b.add_mesh([G.prim(posts, m_post), G.prim(grass, m_grass)], "goal")
    netb_mesh = b.add_mesh([G.prim(net_back, m_net), G.prim(K.flip(net_back), m_net)], "net_back")
    nets_mesh = b.add_mesh([G.prim(net_sides, m_net)], "net_sides")
    goal = b.add_node("goal", mesh=goal_mesh)
    netb = b.add_node("net_back", mesh=netb_mesh)
    nets = b.add_node("net_sides", mesh=nets_mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.13, 28, 16), m_ball)], "ball")
    ball = b.add_node("ball", mesh=ball_mesh, t=(0.1, -GH / 2 + 0.13, 1.2))
    group = b.add_node("group", children=[goal, netb, nets, ball], t=(0, -0.2, 0), r=qx(10))
    tgt = (-0.5, 0.2, -GD + 0.14) if WIN(key) else (GW / 2 + 0.02, 0.1, 0.05)

    def action(root):
        ks = K.spin_keys((1, 0.3, 0), 3, 4)
        n = len(ks) - 1
        tr = [{"node": ball, "times": [0.2 + 0.5 * i / n for i in range(n + 1)], "rotation": ks}]
        if WIN(key):
            tr.append({"node": ball, "times": [0, 0.2, 0.7, 0.85, 1.1],
                       "translation": [(0.1, -GH / 2 + 0.13, 1.2), (0.1, -GH / 2 + 0.13, 1.2), tgt,
                                       (tgt[0], tgt[1] - 0.05, tgt[2] + 0.04), (tgt[0] + 0.05, -GH / 2 + 0.13, -GD + 0.18)]})
            tr.append({"node": netb, "times": [0, 0.7, 0.8, 1.0], "translation": [(0, 0, 0), (0, 0, 0), (0, 0, -0.1), (0, 0, 0)],
                       "scale": [(1, 1, 1), (1, 1, 1), (1.02, 1.02, 1), (1, 1, 1)]})
        else:
            tr.append({"node": ball, "times": [0, 0.2, 0.7, 1.1],
                       "translation": [(0.1, -GH / 2 + 0.13, 1.2), (0.1, -GH / 2 + 0.13, 1.2), tgt, (1.2, -GH / 2 + 0.13, 0.7)]})
            tr.append({"node": goal, "times": [0, 0.7, 0.76, 0.84, 0.92], "rotation": [qz(0), qz(0), qz(-1.5), qz(1), qz(0)]})
        return tr

    def idle(root):
        return [{"node": ball, "times": [0, 0.3, 0.6], "translation": [(0.1, -GH / 2 + 0.13, 1.2), (0.1, -GH / 2 + 0.25, 1.2),
                                                                        (0.1, -GH / 2 + 0.13, 1.2)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.25, 0.7), badge_size=0.82)


# ============================================================
# バスケット — ボールがリングを通る
# ============================================================
def tex_basketball(W=256, H=128):
    img = Image.new("RGB", (W, H), (230, 110, 40))
    d = ImageDraw.Draw(img)
    for x in (0, W // 4, W // 2, 3 * W // 4):
        d.line([(x, 0), (x, H)], fill=(40, 20, 10), width=4)
    d.line([(0, H // 2), (W, H // 2)], fill=(40, 20, 10), width=4)
    return tex.grain(img, 8, 204)


def build_basketball(cat, key, label):
    b = G.Builder()
    m_board = K.col(b, "backboard", (248, 250, 252), rough=0.2, alpha=0.9)
    sq = Image.new("RGBA", (256, 192), (255, 255, 255, 0))
    ds = ImageDraw.Draw(sq)
    ds.rectangle([4, 4, 251, 187], outline=(220, 40, 40, 255), width=8)
    ds.rectangle([84, 80, 172, 160], outline=(220, 40, 40, 255), width=7)
    m_lines = K.texmat(b, "backboard_lines", sq, rough=0.5, alpha_mode="BLEND", colors=0)
    m_rim = K.col(b, "rim", (240, 90, 30), rough=0.3, metal=0.5)
    net = Image.new("RGBA", (128, 128), (255, 255, 255, 0))
    dn = ImageDraw.Draw(net)
    for i in range(0, 128, 16):
        dn.line([(i, 0), (i + 16, 128)], fill=(255, 255, 255, 230), width=3)
        dn.line([(i + 16, 0), (i, 128)], fill=(255, 255, 255, 230), width=3)
    m_net = K.texmat(b, "hoop_net", net, rough=0.8, alpha_mode="BLEND", colors=0)
    m_pole = K.col(b, "hoop_pole", (60, 64, 74), rough=0.4, metal=0.5)
    m_ball = K.texmat(b, "basketball", tex_basketball(), rough=0.6)
    board = K.rounded_box(1.1, 0.75, 0.04, r=0.02, n=1, face_uv=False)
    lines = K.transform(G.plane(1.06, 0.72), t=(0, 0, 0.022))
    rim = K.transform(G.torus(0.2, 0.018, 32, 6), t=(0, -0.25, 0.25))
    netg = K.transform(G.cylinder(0.12, 0.3, 20, caps=False, r_top=0.2), t=(0, -0.4, 0.25))
    pole = K.merge(K.transform(G.cylinder(0.05, 1.3, 12), t=(0, -0.9, -0.2)),
                   K.transform(K.rounded_box(0.1, 0.1, 0.24, r=0.02, n=1), t=(0, -0.15, -0.1)))
    mesh = b.add_mesh([G.prim(board, m_board), G.prim(lines, m_lines), G.prim(rim, m_rim),
                       G.prim(netg, m_net), G.prim(K.flip(netg), m_net), G.prim(pole, m_pole)], "hoop")
    hoop = b.add_node("hoop", mesh=mesh)
    ball_mesh = b.add_mesh([G.prim(G.sphere(0.13, 24, 14), m_ball)], "ball")
    ball = b.add_node("ball", mesh=ball_mesh, t=(-1.0, -0.9, 0.6))
    group = b.add_node("group", children=[hoop, ball], t=(0, 0.35, 0), r=qx(8))

    def action(root):
        ks = K.spin_keys((0, 0, 1), -2, 4)
        n = len(ks) - 1
        tr = [{"node": ball, "times": [0.2 + 0.9 * i / n for i in range(n + 1)], "rotation": ks}]
        if WIN(key):
            tr.append({"node": ball, "times": [0, 0.2, 0.55, 0.85, 1.0, 1.25],
                       "translation": [(-1.0, -0.9, 0.6), (-1.0, -0.9, 0.6), (-0.4, 0.35, 0.4), (0, -0.1, 0.25),
                                       (0, -0.42, 0.25), (0.02, -1.1, 0.3)]})
            tr.append({"node": hoop, "times": [0, 0.95, 1.05, 1.15], "translation": [(0, 0, 0), (0, 0, 0), (0, -0.02, 0), (0, 0, 0)]})
        else:
            tr.append({"node": ball, "times": [0, 0.2, 0.55, 0.85, 1.25],
                       "translation": [(-1.0, -0.9, 0.6), (-1.0, -0.9, 0.6), (-0.4, 0.35, 0.4), (0.18, -0.16, 0.25),
                                       (0.8, -1.0, 0.5)]})
        return tr

    def idle(root):
        return [{"node": ball, "times": [0, 0.25, 0.5], "translation": [(-1.0, -0.9, 0.6), (-1.0, -1.1, 0.6), (-1.0, -0.9, 0.6)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.1, badge_pos=(0, 0.2, 0.7), badge_size=0.8)


# ============================================================
# 水晶玉 — もやが渦巻き、玉の中に結果が浮かぶ
# ============================================================
def build_crystal(cat, key, label):
    b = G.Builder()
    m_glass = K.col(b, "crystal_glass", (200, 220, 255), rough=0.02, metal=0.1, alpha=0.35)
    m_gold = gold(b)
    m_cloth = K.col(b, "crystal_cloth", (90, 30, 120), rough=0.8)
    m_mist = glow_mat(b, "crystal_mist", (190, 140, 255), 128, 1.3)
    m_mist2 = glow_mat(b, "crystal_mist2", (120, 200, 255), 128, 1.3)
    m_flash = glow_mat(b, "crystal_flash", (255, 250, 230), 128, 1.8)
    R = 0.5
    ball_mesh = b.add_mesh([G.prim(K.transform(G.sphere(R, 40, 20), t=(0, 0, 0)), m_glass)], "crystal")
    stand_prof = K.smooth_profile([(0.0, -0.75), (0.42, -0.74), (0.44, -0.66), (0.28, -0.6), (0.22, -0.5), (0.3, -0.44),
                                   (0.34, -0.4), (0.0, -0.4)], 3)
    stand = K.lathe(stand_prof, 40)
    cloth = K.transform(K.lumpy(G.sphere(0.7, 32, 10), 0.05, 2, 6.0), s=(1.2, 0.12, 0.9), t=(0, -0.8, 0))
    stand_mesh = b.add_mesh([G.prim(stand, m_gold), G.prim(cloth, m_cloth)], "stand")
    standN = b.add_node("stand", mesh=stand_mesh)
    ballN = b.add_node("ball", mesh=ball_mesh, t=(0, 0.1, 0))
    mist_a = b.add_mesh([G.prim(G.plane(0.7, 0.45), m_mist)], "mist_a")
    mist_b = b.add_mesh([G.prim(G.plane(0.6, 0.5), m_mist2)], "mist_b")
    ma = b.add_node("mist_a", mesh=mist_a, t=(0, 0.1, 0.0))
    mb = b.add_node("mist_b", mesh=mist_b, t=(0, 0.1, 0.05))
    flash_mesh = b.add_mesh([G.prim(G.plane(1.5, 1.5), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0, 0.1, 0.1), s=(0, 0, 0))
    group = b.add_node("group", children=[standN, ma, mb, ballN, flash], t=(0, 0.05, 0))

    def swirl(node, period, turns, sgn):
        ks = K.spin_keys((0, 0, 1), sgn * turns, 6)
        n = len(ks) - 1
        return {"node": node, "times": [period * i / n for i in range(n + 1)], "rotation": ks}

    def action(root):
        return [swirl(ma, 1.2, 2, 1), swirl(mb, 1.2, 2, -1),
                {"node": ma, "times": [0, 1.0, 1.2], "scale": [(1, 1, 1), (1.3, 1.3, 1), (0.4, 0.4, 1)]},
                {"node": mb, "times": [0, 1.0, 1.2], "scale": [(1, 1, 1), (1.3, 1.3, 1), (0.4, 0.4, 1)]},
                {"node": flash, "times": [0, 1.0, 1.15, 1.5], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (0.8,) * 3]}]

    def idle(root):
        return [swirl(ma, 2.4, 1, 1), swirl(mb, 2.4, 1, -1)]

    return K.finish(b, [group], label, action, idle, badge_at=1.15, badge_pos=(0, 0.15, 0.55), badge_size=0.78)


# ============================================================
# プレゼント箱 — フタが飛んで中から結果
# ============================================================
def build_giftbox(cat, key, label):
    b = G.Builder()
    m_box = K.col(b, "gift_box", (60, 150, 230), rough=0.4)
    m_rib = K.col(b, "gift_ribbon", (240, 200, 60), rough=0.3, metal=0.4)
    m_inner = K.col(b, "gift_inner", (250, 244, 230), rough=0.8)
    m_glow = glow_mat(b, "gift_glow", (255, 236, 160), 128, 1.6)
    S, H = 0.9, 0.62
    box = K.rounded_box(S, H, S, r=0.03, n=2)
    inner = K.transform(G.plane(S - 0.06, S - 0.06), r=qx(-90), t=(0, H / 2 + 0.001, 0))
    ribbons = K.merge(K.transform(G.box(S + 0.01, H + 0.01, 0.12)), K.transform(G.box(0.12, H + 0.01, S + 0.01)))
    box_mesh = b.add_mesh([G.prim(box, m_box), G.prim(inner, m_inner), G.prim(ribbons, m_rib)], "box")
    boxN = b.add_node("box", mesh=box_mesh)
    lid = K.transform(K.rounded_box(S + 0.08, 0.14, S + 0.08, r=0.03, n=2), t=(0, 0.07, 0))
    lid_rib = K.merge(K.transform(G.box(S + 0.09, 0.15, 0.13), t=(0, 0.07, 0)), K.transform(G.box(0.13, 0.15, S + 0.09), t=(0, 0.07, 0)))
    loop = K.transform(G.torus(0.13, 0.04, 24, 8), s=(1, 1, 0.6))
    bow = K.merge(K.transform(loop, r=qmul(qz(30), qx(90)), t=(-0.12, 0.22, 0)),
                  K.transform(loop, r=qmul(qz(-30), qx(90)), t=(0.12, 0.22, 0)),
                  K.transform(G.sphere(0.06, 12, 8), t=(0, 0.17, 0)))
    lid_mesh = b.add_mesh([G.prim(lid, m_box), G.prim(K.merge(lid_rib, bow), m_rib)], "lid")
    lidN = b.add_node("lid", mesh=lid_mesh, t=(0, H / 2, 0))
    glow_mesh = b.add_mesh([G.prim(G.plane(1.3, 1.3), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, H / 2 + 0.2, 0.1), s=(0, 0, 0))
    bits = confetti_burst(b, (0, H / 2, 0.1), 20, (1.0, 0.8), 13)
    group = b.add_node("group", children=[boxN, lidN, glow] + [x[0] for x in bits], t=(0, -0.45, 0), r=qx(14))

    def action(root):
        tr = [{"node": group, "times": [0, 0.12, 0.24, 0.36, 0.48, 0.6],
               "rotation": [qx(14), qmul(qx(14), qz(-4)), qmul(qx(14), qz(4)), qmul(qx(14), qz(-4)), qmul(qx(14), qz(3)), qx(14)]},
              {"node": lidN, "times": [0, 0.6, 0.9, 1.2],
               "translation": [(0, H / 2, 0), (0, H / 2, 0), (0.55, 1.1, -0.2), (0.8, 0.5, -0.3)],
               "rotation": [qz(0), qz(0), qmul(qz(-40), qx(-30)), qmul(qz(-80), qx(-60))]},
              {"node": glow, "times": [0, 0.65, 0.85, 1.2], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (1,) * 3]}]
        tr += confetti_tracks(bits, (0, H / 2, 0.1), 0.65, 1.7)
        return tr

    def idle(root):
        return [{"node": lidN, "times": [0, 0.2, 0.35, 0.5, 1.2],
                 "translation": [(0, H / 2, 0), (0, H / 2 + 0.08, 0), (0, H / 2, 0), (0, H / 2, 0), (0, H / 2, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.85, badge_pos=(0, 0.3, 0.45), badge_size=0.82)



# ============================================================
# スイカ割り — 棒が振り下ろされ、スイカがぱっかり割れる
# ============================================================
def tex_watermelon(W=512, H=256):
    img = Image.new("RGB", (W, H), (60, 150, 60))
    d = ImageDraw.Draw(img)
    for i in range(16):
        x = i * W / 16
        pts = [(x + math.sin(y / 18.0) * 6, y) for y in range(0, H + 1, 8)]
        d.line(pts, fill=(20, 70, 30), width=13)
    return tex.grain(img, 6, 205)


def tex_melon_flesh(size=256):
    img = tex.rgrad((size, size), (250, 80, 90), (220, 40, 60), cy=0.5, r=0.6)
    d = ImageDraw.Draw(img)
    c = size / 2
    d.ellipse([2, 2, size - 2, size - 2], outline=(250, 250, 230), width=14)
    d.ellipse([0, 0, size, size], outline=(40, 120, 40), width=8)
    rnd = random.Random(206)
    for i in range(22):
        a = rnd.uniform(0, K.TAU)
        r = rnd.uniform(0.2, 0.7) * c
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        d.ellipse([x - 5, y - 8, x + 5, y + 8], fill=(30, 20, 20))
    return img


def build_suikawari(cat, key, label):
    b = G.Builder()
    m_rind = K.texmat(b, "melon_rind", tex_watermelon(), rough=0.35)
    m_flesh = K.texmat(b, "melon_flesh", tex_melon_flesh(), rough=0.6)
    m_sheet = K.texmat(b, "melon_sheet", tex.stripes((256, 256), (60, 130, 220), (246, 246, 246), pitch=64), rough=0.8)
    m_stick = K.texmat(b, "melon_stick", tex.wood((64, 256), (190, 140, 80), seed=207, vertical=True), rough=0.6)
    m_flash = glow_mat(b, "melon_flash", (255, 240, 200), 128, 1.8)
    R = 0.42
    half = K.transform(K.hemisphere(R, 32, 10), s=(1.0, 1.0, 1.0))
    face = G.disc(R, 32)
    # 左半分: 丸い面が-X、切り口が+X
    lhalf = K.merge(K.transform(half, r=qz(90)))
    lface = K.transform(face, r=qy(90), t=(0.001, 0, 0))
    rhalf = K.transform(half, r=qz(-90))
    rface = K.transform(face, r=qy(-90), t=(-0.001, 0, 0))
    lmesh = b.add_mesh([G.prim(lhalf, m_rind), G.prim(lface, m_flesh)], "melon_l")
    rmesh = b.add_mesh([G.prim(rhalf, m_rind), G.prim(rface, m_flesh)], "melon_r")
    lh = b.add_node("melon_l", mesh=lmesh, t=(0, -0.4, 0), s=(1.1, 0.95, 1))
    rh = b.add_node("melon_r", mesh=rmesh, t=(0, -0.4, 0), s=(1.1, 0.95, 1))
    sheet = K.transform(K.rounded_box(1.9, 0.03, 1.1, r=0.01, n=1), t=(0, -0.8, 0))
    sheet_mesh = b.add_mesh([G.prim(sheet, m_sheet)], "sheet")
    sheetN = b.add_node("sheet", mesh=sheet_mesh)
    stick_mesh = b.add_mesh([G.prim(K.transform(G.cylinder(0.035, 0.75, 12, r_top=0.045), t=(0, 0.375, 0)), m_stick)], "stick")
    grip = (0.42, 0.62, 0.35)
    stick = b.add_node("stick", mesh=stick_mesh, t=grip, r=qz(-40))
    flash_mesh = b.add_mesh([G.prim(G.plane(1.2, 1.2), m_flash)], "flash")
    flash = b.add_node("flash", mesh=flash_mesh, t=(0, 0.0, 0.5), s=(0, 0, 0))
    group = b.add_node("group", children=[sheetN, lh, rh, stick, flash], t=(0, 0.1, 0), r=qx(12))
    split = WIN(key)

    def action(root):
        tr = [{"node": stick, "times": [0, 0.3, 0.42, 0.5, 0.56, 0.62, 0.75],
               "rotation": [qz(-40), qz(-70), qz(-10), qz(60), qz(120), qz(150), qz(144)]},
              {"node": flash, "times": [0, 0.54, 0.62, 0.85], "scale": [(0, 0, 0), (0, 0, 0), (1.2,) * 3, (0, 0, 0)]}]
        if split:
            # 切り口がこちらを向くよう、左右に倒しながら少し手前へ回す
            tr += [{"node": lh, "times": [0, 0.6, 0.85, 1.0], "translation": [(0, -0.4, 0), (0, -0.4, 0), (-0.34, -0.42, 0.05), (-0.32, -0.42, 0.05)],
                    "rotation": [qz(0), qz(0), qmul(qz(-20), qy(-62)), qmul(qz(-16), qy(-56))]},
                   {"node": rh, "times": [0, 0.6, 0.85, 1.0], "translation": [(0, -0.4, 0), (0, -0.4, 0), (0.34, -0.42, 0.05), (0.32, -0.42, 0.05)],
                    "rotation": [qz(0), qz(0), qmul(qz(20), qy(62)), qmul(qz(16), qy(56))]}]
        else:
            tr += [{"node": n_, "times": [0, 0.6, 0.66, 0.74, 0.82], "translation": [(0, -0.4, 0), (0, -0.4, 0), (0, -0.44, 0), (0, -0.38, 0), (0, -0.4, 0)]}
                   for n_ in (lh, rh)]
        return tr

    def idle(root):
        return [{"node": stick, "times": [0, 0.5, 1.0, 1.5, 2.0],
                 "rotation": [qz(-40), qz(-52), qz(-40), qz(-28), qz(-40)]}]

    return K.finish(b, [group], label, action, idle, badge_at=0.9, badge_pos=(0, 0.35, 0.6), badge_size=0.82)


# ============================================================
# 雪だるま — ぴょんと跳ねて帽子が飛ぶ
# ============================================================
def build_snowman(cat, key, label):
    b = G.Builder()
    m_snow = K.col(b, "snow", (250, 252, 255), rough=0.6)
    m_coal = K.col(b, "coal", (30, 30, 34), rough=0.6)
    m_carrot = K.col(b, "carrot", (250, 130, 30), rough=0.5)
    m_red = K.col(b, "scarf", (220, 40, 50), rough=0.7)
    m_wood = K.col(b, "twig", (110, 70, 40), rough=0.8)
    m_bucket = K.col(b, "bucket", (60, 120, 210), rough=0.4, metal=0.3)
    m_flake = glow_mat(b, "snowflake", (255, 255, 255), 32, 1.4)
    body = K.merge(K.transform(G.sphere(0.46, 32, 16), t=(0, -0.42, 0)), K.transform(G.sphere(0.32, 32, 16), t=(0, 0.26, 0)))
    eyes = [K.transform(G.sphere(0.035, 10, 6), t=(x, 0.33, 0.29)) for x in (-0.1, 0.1)]
    buttons = [K.transform(G.sphere(0.035, 10, 6), t=(0, y, 0.45 - abs(y + 0.4) * 0.3)) for y in (-0.25, -0.42, -0.58)]
    mouth = [K.transform(G.sphere(0.02, 8, 6), t=(math.sin(a) * 0.12, 0.2 - math.cos(a) * 0.05 + 0.03, 0.3)) for a in (-0.8, -0.4, 0, 0.4, 0.8)]
    nose = K.transform(G.cylinder(0.045, 0.2, 12, r_top=0.002), r=qx(90), t=(0, 0.26, 0.4))
    scarf = K.transform(G.torus(0.28, 0.06, 32, 8), t=(0, 0.02, 0), s=(1, 0.8, 1))
    tail = K.transform(K.rounded_box(0.12, 0.3, 0.04, r=0.02, n=1), t=(0.16, -0.14, 0.3), r=qz(12))
    arms = [K.tube([(s_ * 0.4, -0.2, 0), (s_ * 0.62, 0.05, 0.05), (s_ * 0.8, 0.12, 0.05)], 0.02, 6) for s_ in (-1, 1)]
    body_mesh = b.add_mesh([G.prim(body, m_snow), G.prim(K.merge(*eyes, *buttons, *mouth), m_coal), G.prim(nose, m_carrot),
                            G.prim(K.merge(scarf, tail), m_red), G.prim(K.merge(*arms), m_wood)], "snowman")
    man = b.add_node("snowman", mesh=body_mesh)
    bucket = K.merge(K.transform(G.cylinder(0.2, 0.26, 24, r_top=0.16), t=(0, 0.13, 0)),
                     K.transform(G.torus(0.2, 0.02, 24, 6), t=(0, 0.0, 0)))
    hat_mesh = b.add_mesh([G.prim(bucket, m_bucket)], "hat")
    hat = b.add_node("hat", mesh=hat_mesh, t=(0.02, 0.52, 0), r=qz(-10))
    flake_mesh = b.add_mesh([G.prim(G.plane(0.07, 0.07), m_flake)], "flake")
    rnd = random.Random(208)
    flakes = []
    for i in range(18):
        x, z = rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.5)
        flakes.append((b.add_node("flake_%d" % i, mesh=flake_mesh, t=(x, 1.0, z)), x, z, rnd.uniform(0, 1.2)))
    group = b.add_node("group", children=[man, hat] + [f[0] for f in flakes], t=(0, 0.0, 0))

    def falling(period=2.4, loop=True):
        tr = []
        top, bottom = 1.0, -0.88
        span = top - bottom
        for n, x, z, ph in flakes:
            y0 = top - span * (ph / 1.2)
            if loop:
                tw = period * (y0 - bottom) / span
                tr.append({"node": n, "times": [0, tw, tw + 0.001, period],
                           "translation": [(x, y0, z), (x, bottom, z), (x, top, z), (x, y0, z)]})
            else:
                tr.append({"node": n, "times": [0, period * (y0 - bottom) / span],
                           "translation": [(x, y0, z), (x, bottom, z)]})
        return tr

    def action(root):
        return [{"node": man, "times": [0, 0.3, 0.45, 0.6, 0.75, 0.9],
                 "translation": [(0, 0, 0), (0, 0, 0), (0, 0.15, 0), (0, 0, 0), (0, 0.06, 0), (0, 0, 0)],
                 "scale": [(1, 1, 1), (1.04, 0.95, 1.04), (0.97, 1.04, 0.97), (1.04, 0.96, 1.04), (1, 1, 1), (1, 1, 1)]},
                {"node": hat, "times": [0, 0.45, 0.8, 1.1],
                 "translation": [(0.02, 0.52, 0), (0.02, 0.52, 0), (0.35, 1.1, 0.1), (0.62, 0.75, 0.15)],
                 "rotation": [qz(-10), qz(-10), qz(-100), qz(-160)]}] + falling(2.4, loop=False)

    def idle(root):
        return [{"node": man, "times": [0, 0.6, 1.2], "rotation": [qz(-3), qz(3), qz(-3)]}] + falling()

    return K.finish(b, [group], label, action, idle, badge_at=0.85, badge_pos=(0, 0.72, 0.4), badge_size=0.78)


# ============================================================
# 凧揚げ — 風をつかんで高く上がる
# ============================================================
def tex_tako():
    img = tex.paper((384, 512), (252, 246, 230), seed=209)
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 374, 502], outline=(40, 30, 30), width=10)
    tex.draw_text(img, "寿", (40, 60, 344, 440), fill=(210, 30, 40), stroke=(40, 20, 10), stroke_w=8, path=SERIF, shadow=False)
    return img


def build_tako(cat, key, label):
    b = G.Builder()
    m_paper = K.texmat(b, "tako_paper", tex_tako(), rough=0.8)
    m_bamboo = K.col(b, "tako_bamboo", (200, 170, 110), rough=0.6)
    m_tail = K.col(b, "tako_tail", (220, 40, 50), rough=0.7)
    m_string = K.col(b, "tako_string", (240, 240, 230), rough=0.8)
    W, H = 0.9, 1.2
    kite = K.transform(G.plane(W, H), t=(0, 0, 0.01))
    back_ = K.transform(G.back(G.plane(W, H)), t=(0, 0, 0.005))
    frame = K.merge(K.transform(G.cylinder(0.012, H, 6), t=(0, 0, 0)),
                    K.transform(G.cylinder(0.012, W, 6), r=qz(90), t=(0, H * 0.3, 0)),
                    K.transform(G.cylinder(0.012, W, 6), r=qz(90), t=(0, -H * 0.3, 0)),
                    K.transform(G.cylinder(0.01, math.hypot(W, H), 6), r=qz(math.degrees(math.atan2(W, H))), t=(0, 0, -0.005)),
                    K.transform(G.cylinder(0.01, math.hypot(W, H), 6), r=qz(-math.degrees(math.atan2(W, H))), t=(0, 0, -0.005)))
    tails = []
    for s_ in (-1, 1):
        pts = [(s_ * (W / 2 - 0.08) + math.sin(i * 0.9) * 0.05 * s_, -H / 2 - i * 0.09, 0) for i in range(10)]
        tails.append(K.tube(pts, 0.018, 6))
    kite_mesh = b.add_mesh([G.prim(kite, m_paper), G.prim(back_, m_bamboo), G.prim(frame, m_bamboo),
                            G.prim(K.merge(*tails), m_tail)], "kite")
    kiteN = b.add_node("kite", mesh=kite_mesh, t=(0, -0.6, 0), s=(0.6, 0.6, 0.6), r=qz(5))
    string_mesh = b.add_mesh([G.prim(K.tube(K.bezier((0, 0, 0), (0.3, -0.4, 0.2), (0.6, -0.9, 0.3), (0.9, -1.4, 0.4), 12), 0.006, 5),
                                     m_string)], "string")
    string = b.add_node("string", mesh=string_mesh, t=(0, -0.6, 0), s=(0.6, 0.6, 0.6))
    group = b.add_node("group", children=[string, kiteN], t=(0, 0, 0))

    def action(root):
        return [{"node": kiteN, "times": [0, 0.3, 0.7, 1.0, 1.2, 1.4],
                 "translation": [(0, -0.6, 0), (0.1, -0.4, 0), (-0.1, 0.2, 0), (0.05, 0.35, 0), (0, 0.3, 0), (0, 0.32, 0)],
                 "rotation": [qz(5), qz(-10), qz(12), qz(-6), qz(3), qz(0)],
                 "scale": [(0.6,) * 3, (0.7,) * 3, (0.9,) * 3, (1, 1, 1), (1, 1, 1), (1, 1, 1)]},
                {"node": string, "times": [0, 0.7, 1.0], "translation": [(0, -0.6, 0), (-0.1, 0.2, 0), (0, 0.3, 0)],
                 "scale": [(0.6,) * 3, (0.9,) * 3, (1, 1, 1)]}]

    def idle(root):
        return [{"node": kiteN, "times": [0, 0.5, 1.0, 1.5, 2.0],
                 "rotation": [qz(5), qz(-5), qz(5), qz(-5), qz(5)],
                 "translation": [(0, -0.6, 0), (0.05, -0.55, 0), (0, -0.6, 0), (-0.05, -0.55, 0), (0, -0.6, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.25, badge_pos=(0, 0.3, 0.3), badge_size=0.8)


# ============================================================
# こいのぼり — 3匹の鯉が風に泳ぎ上がる
# ============================================================
def tex_koi(body=(30, 30, 40), belly=(240, 240, 240)):
    W, H = 512, 256
    img = tex.vgrad((W, H), tuple(min(255, c + 40) for c in body), body)
    d = ImageDraw.Draw(img)
    for x in range(40, W - 60, 34):
        for y in range(0, H + 30, 30):
            ox = 17 if (x // 34) % 2 else 0
            d.arc([x - 18, y + ox - 18, x + 18, y + ox + 18], 270, 90, fill=belly, width=4)
    # 目(口に近い側=u小)は周方向の両側(左右の側面)に描く
    for v in (0.25, 0.75):
        cy = int(H * v)
        d.ellipse([20, cy - 26, 72, cy + 26], fill=(255, 255, 255))
        d.ellipse([34, cy - 14, 60, cy + 14], fill=(20, 20, 20))
    return img


def build_koinobori(cat, key, label):
    b = G.Builder()
    m_pole = K.col(b, "koi_pole", (240, 240, 240), rough=0.4)
    m_gold = gold(b)
    koi_cols = [((30, 30, 50), (230, 230, 240)), ((220, 50, 60), (255, 220, 220)), ((50, 120, 230), (220, 235, 255))]
    prof = K.smooth_profile([(0.12, 0.0), (0.16, 0.08), (0.17, 0.3), (0.14, 0.6), (0.07, 0.85), (0.02, 0.95)], 4)
    kois = []
    for i, (bc, lc) in enumerate(koi_cols):
        m = K.texmat(b, "koi_%d" % i, tex_koi(bc, lc), rough=0.6)
        body = K.lathe(prof, 20)
        # lathe は +Y 方向に伸びるので、+X 方向(口が左=ポール側)へ倒す
        body = K.transform(body, r=qz(-90))
        tail = K.transform(K.extrude([(0.9, 0), (1.12, 0.14), (1.06, 0), (1.12, -0.14)], 0.02), t=(0, 0, 0))
        mouth = K.transform(G.torus(0.12, 0.012, 20, 6), r=qz(90))
        mesh = b.add_mesh([G.prim(body, m), G.prim(K.flip(body), m), G.prim(tail, m), G.prim(mouth, m_gold)], "koi_%d" % i)
        scale = 1.1 - i * 0.18
        kois.append((b.add_node("koi_%d" % i, mesh=mesh, t=(0.05, -0.5 - i * 0.05, 0), s=(scale, scale, scale)), 0.45 - i * 0.4, i))
    pole = K.transform(G.cylinder(0.03, 2.0, 12), t=(0, -0.1, 0))
    ball = K.transform(G.sphere(0.06, 16, 10), t=(0, 0.93, 0))
    wheel = K.merge(*[K.transform(G.cylinder(0.01, 0.2, 6), r=qz(a), t=(0, 0.82, 0)) for a in (0, 60, 120)])
    pole_mesh = b.add_mesh([G.prim(pole, m_pole), G.prim(K.merge(ball, wheel), m_gold)], "pole")
    poleN = b.add_node("pole", mesh=pole_mesh)
    group = b.add_node("group", children=[poleN] + [k[0] for k in kois], t=(-0.45, 0.0, 0))

    def flutter(n, y, i, rise_to=None, t_rise=0.0):
        tr = {"node": n, "times": [0, 0.3, 0.6, 0.9, 1.2],
              "rotation": [qmul(qy(a), qz(b_)) for a, b_ in ((0, -4), (12, 3), (0, -4), (-12, 3), (0, -4))]}
        return tr

    def action(root):
        tr = []
        for n, y, i in kois:
            tr.append({"node": n, "times": [0, 0.2 + i * 0.1, 0.9 + i * 0.1, 1.1 + i * 0.1],
                       "translation": [(0.05, -0.5 - i * 0.05, 0), (0.05, -0.5 - i * 0.05, 0), (0.05, y + 0.05, 0), (0.05, y, 0)]})
            tr.append(flutter(n, y, i))
        return tr

    def idle(root):
        return [flutter(n, -0.5, i) for n, y, i in kois]

    return K.finish(b, [group], label, action, idle, badge_at=1.3, badge_pos=(0.45, 0.05, 0.5), badge_size=0.8)


# ============================================================
# お月見 — 雲が晴れて満月と団子
# ============================================================
def tex_moon(size=256):
    img = tex.rgrad((size, size), (255, 244, 190), (240, 206, 110), cy=0.45)
    d = ImageDraw.Draw(img)
    rnd = random.Random(210)
    for i in range(10):
        x, y, r = rnd.randint(40, 216), rnd.randint(40, 216), rnd.randint(8, 24)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(236, 200, 120))
    return img


def build_tsukimi(cat, key, label):
    b = G.Builder()
    m_moon = K.texmat(b, "moon", tex_moon(), rough=0.8, emissive=(0.9, 0.85, 0.6), emissive_texture=True)
    m_moonglow = glow_mat(b, "moon_glow", (255, 236, 170), 128, 1.6)
    m_cloud = K.col(b, "tsukimi_cloud", (90, 96, 130), rough=0.9)
    m_dango = K.col(b, "dango", (252, 250, 244), rough=0.5)
    m_sanbo = K.texmat(b, "sanbo", tex.wood((256, 128), (220, 190, 140), seed=211), rough=0.6)
    m_susuki = K.col(b, "susuki", (200, 180, 120), rough=0.7)
    moon = K.transform(G.disc(0.6, 48), t=(0, 0, 0))
    moon_mesh = b.add_mesh([G.prim(moon, m_moon)], "moon")
    moonN = b.add_node("moon", mesh=moon_mesh, t=(0.25, 0.45, -0.5))
    mg_mesh = b.add_mesh([G.prim(G.plane(2.0, 2.0), m_moonglow)], "moon_glow")
    mg = b.add_node("moon_glow", mesh=mg_mesh, t=(0.25, 0.45, -0.52), s=(0.5, 0.5, 0.5))
    clouds = []
    for i, (x, y) in enumerate(((-0.2, 0.55), (0.55, 0.3))):
        g = K.merge(*[K.transform(K.lumpy(G.sphere(r, 14, 8), 0.1, i * 3 + k, 5.0), t=(dx, dy, 0), s=(1.4, 0.8, 0.6))
                      for k, (dx, dy, r) in enumerate(((0, 0, 0.18), (0.22, 0.03, 0.15), (-0.2, -0.02, 0.14)))])
        cm = b.add_mesh([G.prim(g, m_cloud)], "cloud_%d" % i)
        clouds.append((b.add_node("cloud_%d" % i, mesh=cm, t=(x, y, -0.3)), x, y))
    # 三方と団子(ピラミッド)
    sanbo = K.merge(K.transform(K.rounded_box(0.6, 0.05, 0.5, r=0.02, n=1), t=(0, -0.55, 0.2)),
                    K.transform(K.rounded_box(0.42, 0.22, 0.36, r=0.02, n=1), t=(0, -0.7, 0.2)))
    dangos = []
    for layer, n in enumerate((3, 2, 1)):
        for i in range(n):
            for j in range(n):
                x = (i - (n - 1) / 2) * 0.13
                z = (j - (n - 1) / 2) * 0.13
                dangos.append(K.transform(G.sphere(0.07, 14, 8), t=(x, -0.46 + layer * 0.11, 0.2 + z)))
    susuki = [K.tube(K.bezier((-0.6 + k * 0.05, -0.8, 0.1), (-0.62 + k * 0.05, -0.3, 0.1), (-0.5 + k * 0.1, 0.1, 0.1),
                              (-0.35 + k * 0.12, 0.2 + k * 0.05, 0.1), 10), 0.008, 5) for k in range(4)]
    heads = [K.transform(G.sphere(0.05, 8, 6), s=(0.7, 2.2, 0.7), t=(-0.35 + k * 0.12, 0.26 + k * 0.05, 0.1), r=qz(-40))
             for k in range(4)]
    table_mesh = b.add_mesh([G.prim(sanbo, m_sanbo), G.prim(K.merge(*dangos), m_dango),
                             G.prim(K.merge(*susuki, *heads), m_susuki)], "offering")
    table = b.add_node("offering", mesh=table_mesh)
    group = b.add_node("group", children=[mg, moonN, table] + [c[0] for c in clouds], t=(0, 0.05, 0))

    def action(root):
        tr = [{"node": mg, "times": [0, 0.6, 1.0, 1.4], "scale": [(0.5,) * 3, (0.5,) * 3, (1.25,) * 3, (1.1,) * 3]},
              {"node": table, "times": [0, 0.9, 1.05, 1.2], "translation": [(0, 0, 0), (0, 0, 0), (0, 0.05, 0), (0, 0, 0)]}]
        for n, x, y in clouds:
            dx = -0.8 if x < 0.1 else 0.8
            tr.append({"node": n, "times": [0, 0.2, 1.0, 1.05], "translation": [(x, y, -0.3), (x, y, -0.3), (x + dx, y, -0.3), (x + dx, y, -0.3)],
                       "scale": [(1, 1, 1), (1, 1, 1), (0.5, 0.5, 0.5), (0, 0, 0)]})
        return tr

    def idle(root):
        tr = []
        for n, x, y in clouds:
            tr.append({"node": n, "times": [0, 1.0, 2.0], "translation": [(x, y, -0.3), (x + 0.08, y, -0.3), (x, y, -0.3)]})
        return tr

    return K.finish(b, [group], label, action, idle, badge_at=1.1, badge_pos=(0.2, 0.4, 0.5), badge_size=0.8)


# ============================================================
# 風鈴 — 風に揺れて短冊が翻る
# ============================================================
def tex_furin(W=512, H=256):
    img = Image.new("RGBA", (W, H), (230, 244, 255, 150))
    d = ImageDraw.Draw(img)
    for i, x in enumerate((80, 250, 420)):
        d.ellipse([x - 40, 110, x + 40, 170], fill=(236, 60, 50, 240))
        d.polygon([(x + 36, 140), (x + 70, 115), (x + 70, 165)], fill=(236, 60, 50, 240))
        d.ellipse([x - 22, 126, x - 12, 136], fill=(20, 20, 20, 255))
    for x in range(0, W, 30):
        d.arc([x, 190, x + 30, 220], 0, 180, fill=(80, 150, 230, 220), width=4)
    return img


def tex_tanzaku(text):
    img = tex.paper((128, 512), (200, 230, 255), seed=212)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(SERIF, 72)
    for i, ch in enumerate(text):
        l, t, r, bb = d.textbbox((0, 0), ch, font=f)
        d.text((64 - (r - l) / 2 - l, 40 + i * 110 - t), ch, font=f, fill=(30, 60, 120))
    return img


def build_furin(cat, key, label):
    b = G.Builder()
    m_glass = K.texmat(b, "furin_glass", tex_furin(), rough=0.05, alpha_mode="BLEND", colors=0)
    m_string = K.col(b, "furin_string", (220, 40, 50), rough=0.7)
    m_clapper = K.col(b, "furin_clapper", (240, 240, 240), rough=0.3)
    m_tanzaku = K.texmat(b, "tanzaku", tex_tanzaku("涼風" if WIN(key) else "夏空"), rough=0.8)
    m_ring = shockwave(b, "furin_ring", (200, 236, 255))
    bell = K.transform(K.hemisphere(0.28, 32, 10), t=(0, -0.2, 0))
    bell_in = K.flip(bell)
    bell_mesh = b.add_mesh([G.prim(bell, m_glass), G.prim(bell_in, m_glass)], "bell")
    string_top = K.transform(G.cylinder(0.008, 0.5, 6), t=(0, 0.3, 0))
    string_mid = K.transform(G.cylinder(0.006, 0.55, 6), t=(0, -0.45, 0))
    clapper = K.transform(G.cylinder(0.04, 0.05, 16), t=(0, -0.24, 0))
    s_mesh = b.add_mesh([G.prim(K.merge(string_top, string_mid), m_string), G.prim(clapper, m_clapper)], "strings")
    tz_mesh = b.add_mesh([G.prim(K.transform(G.plane(0.2, 0.8), t=(0, -0.4, 0)), m_tanzaku),
                          G.prim(K.transform(G.back(G.plane(0.2, 0.8)), t=(0, -0.4, -0.002)), m_tanzaku)], "tanzaku")
    tanzaku = b.add_node("tanzaku", mesh=tz_mesh, t=(0, -0.72, 0))
    inner = b.add_node("inner", mesh=s_mesh, children=[tanzaku])
    bellN = b.add_node("bell", mesh=bell_mesh)
    ring_mesh = b.add_mesh([G.prim(G.plane(1.3, 1.3), m_ring)], "ring")
    ring = b.add_node("ring", mesh=ring_mesh, t=(0, -0.1, 0.05), s=(0, 0, 0))
    pivot = b.add_node("pivot", children=[bellN, inner, ring], t=(0, 0.55, 0))

    def action(root):
        return [{"node": pivot, "times": [0, 0.3, 0.6, 0.9, 1.2], "rotation": [qz(a) for a in (0, 12, -9, 5, 0)]},
                {"node": tanzaku, "times": [0, 0.3, 0.6, 0.9, 1.1, 1.3],
                 "rotation": [qy(0), qmul(qy(60), qx(20)), qmul(qy(160), qx(-15)), qmul(qy(300), qx(10)), qy(355), qy(360)]},
                {"node": ring, "times": [0, 0.3, 0.8, 0.82, 0.9, 1.4, 1.42],
                 "scale": [(0, 0, 0), (0.2,) * 3, (1.6,) * 3, (0, 0, 0), (0.2,) * 3, (1.6,) * 3, (0, 0, 0)]}]

    def idle(root):
        return [{"node": pivot, "times": [0, 0.7, 1.4], "rotation": [qz(-6), qz(6), qz(-6)]},
                {"node": tanzaku, "times": [0, 0.7, 1.4], "rotation": [qy(-25), qy(25), qy(-25)]}]

    return K.finish(b, [pivot], label, action, idle, badge_at=1.3, badge_pos=(0, -0.62, 0.3), badge_size=0.78)


# ============================================================
# 重箱(おせち) — 段が開いてごちそうが並ぶ
# ============================================================
def tex_jubako_lid():
    img = Image.new("RGB", (512, 512), (24, 20, 22))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 492, 492], outline=(200, 160, 70), width=8)
    tex.draw_text(img, "寿", (120, 120, 392, 392), fill=(214, 170, 72), path=SERIF, shadow=False)
    return img


def build_jubako(cat, key, label):
    b = G.Builder()
    m_black = K.col(b, "urushi_black", (26, 22, 24), rough=0.15, metal=0.1)
    m_red = K.col(b, "urushi_red", (170, 24, 30), rough=0.2)
    m_lid = K.texmat(b, "jubako_lid", tex_jubako_lid(), rough=0.15)
    m_gold = gold(b)
    foods = [K.col(b, "food_%d" % i, c, rough=0.5) for i, c in enumerate(
        [(30, 24, 30), (250, 210, 60), (250, 250, 246), (240, 120, 130), (230, 120, 40), (80, 150, 60)])]
    S, H = 0.9, 0.24
    tiers = []
    for i in range(3):
        box = K.rounded_box(S, H, S, r=0.02, n=1, face_uv=False)
        inside = K.transform(G.plane(S - 0.08, S - 0.08), r=qx(-90), t=(0, H / 2 - 0.02, 0))
        band = K.transform(G.box(S + 0.005, 0.02, S + 0.005), t=(0, H / 2 - 0.01, 0))
        rnd = random.Random(213 + i)
        items = {k: [] for k in range(len(foods))}
        for gx in range(3):
            for gz in range(3):
                k = (gx + gz * 2 + i) % len(foods)
                cx, cz = (gx - 1) * 0.27, (gz - 1) * 0.27
                for m in range(2):
                    x, z = cx + (m - 0.5) * 0.1, cz + rnd.uniform(-0.04, 0.04)
                    if k in (0, 5):
                        g = K.transform(G.sphere(0.05, 10, 6), t=(x, H / 2 - 0.0, z))
                    else:
                        g = K.transform(G.box(0.1, 0.06, 0.14), t=(x, H / 2 - 0.0, z), r=qy(rnd.uniform(-20, 20)))
                    items[k].append(g)
        prims = [G.prim(box, m_black), G.prim(inside, m_red), G.prim(band, m_gold)]
        prims += [G.prim(K.merge(*v), foods[k]) for k, v in items.items() if v]
        mesh = b.add_mesh(prims, "tier_%d" % i)
        tiers.append(b.add_node("tier_%d" % i, mesh=mesh, t=(0, -0.55 + i * (H + 0.005), 0)))
    lid = K.merge(K.transform(K.rounded_box(S + 0.02, 0.08, S + 0.02, r=0.02, n=1, face_uv=False), t=(0, 0.04, 0)))
    lid_top = K.transform(G.plane(S - 0.04, S - 0.04), r=qx(-90), t=(0, 0.082, 0))
    lid_mesh = b.add_mesh([G.prim(lid, m_black), G.prim(lid_top, m_lid)], "lid")
    lidN = b.add_node("lid", mesh=lid_mesh, t=(0, -0.55 + 3 * (H + 0.005) - H / 2, 0))
    group = b.add_node("group", children=tiers + [lidN], t=(0, 0.0, 0), r=qx(30))
    y0 = -0.55

    def action(root):
        return [{"node": lidN, "times": [0, 0.3, 0.6], "translation": [(0, y0 + 3 * (H + 0.005) - H / 2, 0),
                                                                          (0, y0 + 3 * (H + 0.005) - H / 2, 0), (0.95, 0.5, -0.3)],
                 "rotation": [qx(0), qx(0), qmul(qz(-20), qx(-40))]},
                {"node": tiers[2], "times": [0, 0.55, 0.9], "translation": [(0, y0 + 2 * (H + 0.005), 0), (0, y0 + 2 * (H + 0.005), 0), (0.62, y0 + 0.1, 0.35)]},
                {"node": tiers[1], "times": [0, 0.8, 1.15], "translation": [(0, y0 + (H + 0.005), 0), (0, y0 + (H + 0.005), 0), (-0.62, y0 + 0.1, 0.35)]}]

    def idle(root):
        return [{"node": lidN, "times": [0, 0.25, 0.4, 1.2], "translation": [(0, y0 + 3 * (H + 0.005) - H / 2, 0),
                                                                              (0, y0 + 3 * (H + 0.005) - H / 2 + 0.06, 0),
                                                                              (0, y0 + 3 * (H + 0.005) - H / 2, 0),
                                                                              (0, y0 + 3 * (H + 0.005) - H / 2, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.25, badge_pos=(0, 0.42, 0.45), badge_size=0.82)


def steam(b, name, count, origin, spread=0.25, seed=3):
    m = K.texmat(b, name, K.glow_image((250, 250, 250), 64, 1.3), rough=1.0, alpha_mode="BLEND", colors=0)
    mesh = b.add_mesh([G.prim(G.plane(0.3, 0.3), m)], name)
    rnd = random.Random(seed)
    out = []
    for i in range(count):
        x = origin[0] + rnd.uniform(-spread, spread)
        z = origin[2] + rnd.uniform(-0.05, 0.1)
        out.append((b.add_node("%s_%d" % (name, i), mesh=mesh, t=(x, origin[1], z), s=(0, 0, 0)), x, z, i / count))
    return out


def steam_tracks(puffs, y0, h=0.7, period=1.8):
    tr = []
    for n, x, z, ph in puffs:
        t0 = period * ph
        tr.append({"node": n, "times": [0, t0, t0 + period * 0.5, t0 + period * 0.999],
                   "translation": [(x, y0, z), (x, y0, z), (x + 0.05, y0 + h * 0.5, z), (x + 0.1, y0 + h, z)],
                   "scale": [(0, 0, 0), (0.4,) * 3, (1.0,) * 3, (0, 0, 0)]})
    return tr


# ============================================================
# ラーメン — 箸で麺を持ち上げると湯気が立つ
# ============================================================
def tex_raimon(W=512, H=128):
    img = Image.new("RGB", (W, H), (200, 30, 36))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 10], fill=(250, 244, 230))
    d.rectangle([0, H - 10, W, H], fill=(250, 244, 230))
    for x in range(0, W, 48):
        y = 30
        pts = [(x + 6, y + 60), (x + 6, y + 6), (x + 42, y + 6), (x + 42, y + 48), (x + 18, y + 48), (x + 18, y + 18), (x + 30, y + 18), (x + 30, y + 36)]
        d.line(pts, fill=(250, 244, 230), width=5)
    return img


def tex_naruto(size=128):
    img = Image.new("RGB", (size, size), (252, 250, 246))
    d = ImageDraw.Draw(img)
    c = size / 2
    pts = [(c + math.cos(t) * t * 4.2, c + math.sin(t) * t * 4.2) for t in [i * 0.2 for i in range(70)]]
    d.line(pts, fill=(240, 110, 150), width=7)
    return img


def build_ramen(cat, key, label):
    b = G.Builder()
    m_bowl = K.texmat(b, "bowl_out", tex_raimon(), rough=0.25)
    m_in = K.col(b, "bowl_in", (250, 248, 242), rough=0.25)
    m_soup = K.col(b, "soup", (206, 140, 70), rough=0.15)
    m_noodle = K.col(b, "noodle", (250, 226, 150), rough=0.5)
    m_chashu = K.col(b, "chashu", (190, 120, 90), rough=0.6)
    m_egg_w = K.col(b, "egg_white", (250, 246, 236), rough=0.4)
    m_yolk = K.col(b, "egg_yolk", (250, 170, 40), rough=0.3)
    m_naruto = K.texmat(b, "naruto", tex_naruto(), rough=0.5)
    m_nori = K.col(b, "nori", (30, 50, 36), rough=0.6)
    m_negi = K.col(b, "negi", (110, 190, 80), rough=0.5)
    m_chop = K.col(b, "chopsticks", (160, 100, 60), rough=0.5)
    prof = K.smooth_profile([(0.0, -0.3), (0.2, -0.3), (0.22, -0.27), (0.42, -0.1), (0.55, 0.12), (0.58, 0.18)], 4)
    bowl = K.lathe(prof, 28)
    inner = K.flip(K.lathe([(r * 0.95, y + 0.01) for r, y in prof], 28))
    rim = K.transform(G.torus(0.575, 0.02, 28, 6), t=(0, 0.18, 0))
    soup = K.transform(G.disc(0.52, 32), r=qx(-90), t=(0, 0.1, 0))
    rnd = random.Random(214)
    noodles = []
    for i in range(7):
        pts = [(math.cos(a) * 0.22 + rnd.uniform(-0.1, 0.1), 0.11, math.sin(a) * 0.18 + 0.05) for a in [k * 0.8 + i for k in range(7)]]
        noodles.append(K.tube(pts, 0.018, 5))
    chashu = [K.transform(G.cylinder(0.12, 0.03, 20), t=(x, 0.13, z), r=qx(-12)) for x, z in ((-0.22, -0.12), (-0.08, -0.22))]
    egg = K.merge(K.transform(K.hemisphere(0.08, 16, 5), s=(1, 1, 1.3), t=(0.26, 0.11, -0.1), r=qx(-90)))
    yolk = K.transform(G.disc(0.045, 16), r=qx(-80), t=(0.26, 0.19, -0.08))
    naruto = K.transform(G.cylinder(0.08, 0.02, 20), t=(0.24, 0.13, 0.18))
    naruto_top = K.transform(G.disc(0.08, 20), r=qx(-90), t=(0.24, 0.141, 0.18))
    nori = K.transform(G.plane(0.24, 0.3), t=(0.02, 0.28, -0.4), r=qx(-15))
    negi = [K.transform(G.cylinder(0.02, 0.012, 10), t=(rnd.uniform(-0.2, 0.2), 0.12, rnd.uniform(0.05, 0.35))) for _ in range(12)]
    bowl_mesh = b.add_mesh([G.prim(bowl, m_bowl), G.prim(K.merge(inner, rim), m_in), G.prim(soup, m_soup),
                            G.prim(K.merge(*noodles), m_noodle), G.prim(K.merge(*chashu), m_chashu),
                            G.prim(egg, m_egg_w), G.prim(yolk, m_yolk), G.prim(naruto, m_egg_w), G.prim(naruto_top, m_naruto),
                            G.prim(nori, m_nori), G.prim(K.merge(*negi), m_negi)], "ramen")
    bowlN = b.add_node("bowl", mesh=bowl_mesh)
    chop = K.merge(K.transform(G.cylinder(0.012, 0.9, 8, r_top=0.018), t=(-0.03, 0.45, 0)),
                   K.transform(G.cylinder(0.012, 0.9, 8, r_top=0.018), t=(0.03, 0.45, 0)))
    lift = K.merge(*[K.tube([(dx, 0.02, 0), (dx * 1.5, -0.2, 0.02), (dx * 2.2, -0.42, 0)], 0.016, 5) for dx in (-0.04, -0.015, 0.015, 0.04)])
    chop_mesh = b.add_mesh([G.prim(chop, m_chop), G.prim(lift, m_noodle)], "chopsticks")
    chopN = b.add_node("chopsticks", mesh=chop_mesh, t=(0.05, 0.12, 0.05), r=qz(-20), s=(1, 0, 1))
    puffs = steam(b, "ramen_steam", 6, (0, 0.2, 0.0), 0.3)
    group = b.add_node("group", children=[bowlN, chopN] + [p_[0] for p_ in puffs], t=(0, -0.2, 0), r=qx(28))

    def action(root):
        return [{"node": chopN, "times": [0, 0.3, 0.8, 1.0], "scale": [(1, 0, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1)],
                 "translation": [(0.05, 0.12, 0.05), (0.05, 0.12, 0.05), (0.05, 0.45, 0.05), (0.05, 0.42, 0.05)]}] + \
            steam_tracks(puffs, 0.2, 0.7, 1.6)

    def idle(root):
        return steam_tracks(puffs, 0.2, 0.7, 1.6)

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.45, 0.55), badge_size=0.8)


# ============================================================
# コーヒー — ラテアートが浮かぶ
# ============================================================
def tex_latte(heart=True, size=256):
    img = tex.rgrad((size, size), (200, 150, 100), (120, 70, 36), cy=0.5, r=0.6)
    d = ImageDraw.Draw(img)
    c = size / 2
    if heart:
        pts = [(c + x * 110, c - y * 110 + 10) for x, y in K.heart_points(1.0, 48)]
        d.polygon(pts, fill=(250, 242, 226))
    else:
        d.ellipse([c - 60, c - 50, c + 60, c + 50], fill=(240, 226, 200))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def build_coffee(cat, key, label):
    b = G.Builder()
    m_cup = K.col(b, "cup", (250, 250, 248), rough=0.2)
    m_band = K.col(b, "cup_band", (40, 120, 90), rough=0.3)
    m_latte = K.texmat(b, "latte", tex_latte(WIN(key)), rough=0.3)
    m_plain = K.col(b, "coffee_plain", (120, 70, 36), rough=0.2)
    m_spoon = K.col(b, "spoon", (210, 214, 222), rough=0.2, metal=0.9)
    prof = K.smooth_profile([(0.0, -0.3), (0.22, -0.3), (0.3, -0.24), (0.36, 0.0), (0.38, 0.2)], 4)
    cup = K.lathe(prof, 40)
    inner = K.flip(K.lathe([(r * 0.93, y + 0.012) for r, y in prof], 40))
    band = K.transform(G.cylinder(0.372, 0.05, 40, caps=False), t=(0, 0.12, 0))
    handle = K.transform(G.torus(0.12, 0.03, 20, 8), r=qx(90), t=(0.42, 0.0, 0), s=(0.8, 1, 1))
    saucer = K.lathe(K.smooth_profile([(0.0, -0.34), (0.5, -0.33), (0.62, -0.28), (0.64, -0.26), (0.0, -0.3)], 3), 40)
    spoon = K.merge(K.transform(K.rounded_box(0.04, 0.012, 0.36, r=0.005, n=1), t=(0.45, -0.28, 0.2), r=qy(-30)),
                    K.transform(G.sphere(0.06, 12, 6), s=(1, 0.3, 1.4), t=(0.36, -0.27, 0.36)))
    cup_mesh = b.add_mesh([G.prim(K.merge(cup, inner, handle, saucer), m_cup), G.prim(band, m_band), G.prim(spoon, m_spoon)], "cup")
    cupN = b.add_node("cup", mesh=cup_mesh)
    surf_mesh = b.add_mesh([G.prim(K.transform(G.disc(0.34, 40), r=qx(-90), t=(0, 0.15, 0)), m_plain)], "coffee")
    art_mesh = b.add_mesh([G.prim(K.transform(G.disc(0.34, 40), r=qx(-90), t=(0, 0.152, 0)), m_latte)], "latte")
    surf = b.add_node("coffee", mesh=surf_mesh)
    art = b.add_node("latte", mesh=art_mesh, s=(0, 1, 0))
    puffs = steam(b, "coffee_steam", 5, (0, 0.25, 0.0), 0.18, 7)
    group = b.add_node("group", children=[cupN, surf, art] + [p_[0] for p_ in puffs], t=(0, -0.05, 0), r=qx(38))

    def action(root):
        return [{"node": art, "times": [0, 0.3, 0.9, 1.0], "scale": [(0, 1, 0), (0, 1, 0), (1.05, 1, 1.05), (1, 1, 1)],
                 "rotation": [qy(-90), qy(-90), qy(0), qy(0)]},
                {"node": cupN, "times": [0, 0.2, 0.4], "translation": [(0, 0.1, 0), (0, -0.02, 0), (0, 0, 0)]}] + \
            steam_tracks(puffs, 0.25, 0.6, 1.6)

    def idle(root):
        return steam_tracks(puffs, 0.25, 0.6, 1.6)

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.5, 0.35), badge_size=0.8)


# ============================================================
# トースター — チンと鳴ってパンが飛び出す
# ============================================================
def tex_toast(mark="当"):
    img = tex.rgrad((256, 256), (236, 180, 100), (180, 110, 50), cy=0.5)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, 250, 250], 50, outline=(130, 70, 30), width=16)
    if mark:
        tex.draw_text(img, mark, (70, 70, 186, 186), fill=(120, 60, 20), path=SERIF, shadow=False)
    return img


def build_toaster(cat, key, label):
    b = G.Builder()
    m_body = K.col(b, "toaster_body", (230, 80, 70), rough=0.25, metal=0.3)
    m_chrome = K.col(b, "toaster_chrome", (220, 224, 230), rough=0.15, metal=0.95)
    m_slot = K.col(b, "toaster_slot", (20, 16, 16), rough=1.0)
    m_toast = K.texmat(b, "toast", tex_toast("当" if WIN(key) else ""), rough=0.7)
    m_crust = K.col(b, "crust", (170, 100, 40), rough=0.7)
    m_glow = glow_mat(b, "toast_glow", (255, 220, 150), 128, 1.8)
    body = K.rounded_box(1.1, 0.7, 0.62, r=0.2, n=4)
    base = K.transform(K.rounded_box(1.14, 0.06, 0.66, r=0.03, n=1), t=(0, -0.36, 0))
    lever = K.transform(K.rounded_box(0.08, 0.1, 0.12, r=0.03, n=1), t=(0.58, 0.1, 0))
    dial = K.transform(G.cylinder(0.06, 0.04, 20), r=qx(90), t=(0.3, -0.1, 0.32))
    slots = [K.transform(K.rounded_box(0.46, 0.02, 0.1, r=0.009, n=1), t=(0, 0.352, z)) for z in (-0.13, 0.13)]
    mesh = b.add_mesh([G.prim(body, m_body), G.prim(K.merge(base, lever, dial), m_chrome), G.prim(K.merge(*slots), m_slot)], "toaster")
    toaster = b.add_node("toaster", mesh=mesh)
    toast_geo = K.merge(K.transform(G.plane(0.42, 0.42), t=(0, 0, 0.022)))
    crust = K.rounded_box(0.44, 0.44, 0.04, r=0.02, n=1, face_uv=False)
    toast_mesh = b.add_mesh([G.prim(crust, m_crust), G.prim(toast_geo, m_toast), G.prim(K.transform(G.back(G.plane(0.42, 0.42)), t=(0, 0, -0.022)), m_toast)], "toast")
    toasts = [b.add_node("toast_%d" % i, mesh=toast_mesh, t=(0, 0.1, z)) for i, z in enumerate((-0.13, 0.13))]
    glow_mesh = b.add_mesh([G.prim(G.plane(1.2, 1.0), m_glow)], "glow")
    glow = b.add_node("glow", mesh=glow_mesh, t=(0, 0.6, -0.3), s=(0, 0, 0))
    group = b.add_node("group", children=[glow] + toasts + [toaster], t=(0, -0.3, 0), r=qx(10))

    def action(root):
        tr = [{"node": toaster, "times": [0, 0.5, 0.55, 0.62, 0.7], "translation": [(0, 0, 0), (0, 0, 0), (0, -0.03, 0), (0, 0.01, 0), (0, 0, 0)]},
              {"node": glow, "times": [0, 0.6, 0.8, 1.1], "scale": [(0, 0, 0), (0, 0, 0), (1.3,) * 3, (1,) * 3]}]
        for i, n in enumerate(toasts):
            z = (-0.13, 0.13)[i]
            tr.append({"node": n, "times": [0, 0.5, 0.75, 0.9, 1.0],
                       "translation": [(0, 0.1, z), (0, 0.1, z), (0.1 * (i * 2 - 1), 0.9 + 0.08 * i, z), (0.1 * (i * 2 - 1), 0.62 + 0.05 * i, z), (0.1 * (i * 2 - 1), 0.66 + 0.05 * i, z)],
                       "rotation": [qz(0), qz(0), qz(8 * (1 - 2 * i)), qz(4 * (1 - 2 * i)), qz(5 * (1 - 2 * i))]})
        return tr

    def idle(root):
        return [{"node": toaster, "times": [0, 0.15, 0.3, 0.45, 1.2],
                 "translation": [(0, 0, 0), (0.01, 0, 0), (-0.01, 0, 0), (0, 0, 0), (0, 0, 0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.0, badge_pos=(0, 0.72, 0.45), badge_size=0.8)


# ============================================================
# ビール — ジョッキに注がれて泡があふれる
# ============================================================
def build_beer(cat, key, label):
    b = G.Builder()
    m_glass = K.col(b, "mug_glass", (236, 244, 250), rough=0.03, alpha=0.3)
    m_beer = K.col(b, "beer", (240, 170, 40), rough=0.1, alpha=0.92, emissive=(0.25, 0.14, 0.0))
    m_foam = K.col(b, "foam", (252, 250, 244), rough=0.8)
    m_bubble = K.col(b, "bubble", (255, 236, 170), rough=0.1, emissive=(0.3, 0.25, 0.1))
    prof = [(0.34, -0.5), (0.35, -0.46), (0.36, 0.42), (0.37, 0.46)]
    glass = K.lathe(prof, 40)
    bottom = K.transform(G.cylinder(0.34, 0.08, 40), t=(0, -0.46, 0))
    handle = K.transform(G.torus(0.2, 0.05, 24, 8), r=qx(90), t=(0.44, 0.0, 0), s=(0.8, 1.2, 1))
    mug_mesh = b.add_mesh([G.prim(K.merge(glass, K.flip(glass), bottom, handle), m_glass)], "mug")
    mug = b.add_node("mug", mesh=mug_mesh)
    beer_mesh = b.add_mesh([G.prim(K.transform(G.cylinder(0.33, 1.0, 40), t=(0, 0.5, 0)), m_beer)], "beer")
    beer = b.add_node("beer", mesh=beer_mesh, t=(0, -0.42, 0), s=(1, 0.02, 1))
    foam_g = K.merge(K.transform(K.lumpy(G.sphere(0.36, 28, 10), 0.06, 4, 6.0), s=(1, 0.35, 1)),
                     *[K.transform(G.sphere(0.12, 12, 8), t=(math.cos(a) * 0.3, 0.06, math.sin(a) * 0.3)) for a in [k * 1.1 for k in range(6)]])
    foam_mesh = b.add_mesh([G.prim(foam_g, m_foam)], "foam")
    foam = b.add_node("foam", mesh=foam_mesh, t=(0, -0.4, 0), s=(0.9, 0.3, 0.9))
    bubble_mesh = b.add_mesh([G.prim(G.sphere(0.018, 8, 5), m_bubble)], "bubble")
    rnd = random.Random(215)
    bubbles = [(b.add_node("bubble_%d" % i, mesh=bubble_mesh, t=(0, -0.4, 0), s=(0, 0, 0)),
                rnd.uniform(-0.25, 0.25), rnd.uniform(-0.2, 0.25), rnd.uniform(0, 1)) for i in range(12)]
    group = b.add_node("group", children=[beer, foam, mug] + [x[0] for x in bubbles], t=(0, -0.05, 0), r=qx(8))
    full = 0.84

    def action(root):
        tr = [{"node": beer, "times": [0, 0.2, 1.0], "scale": [(1, 0.02, 1), (1, 0.02, 1), (1, full, 1)]},
              {"node": foam, "times": [0, 0.2, 1.0, 1.15, 1.3],
               "translation": [(0, -0.4, 0), (0, -0.4, 0), (0, -0.42 + full + 0.02, 0), (0, -0.42 + full + 0.08, 0), (0, -0.42 + full + 0.06, 0)],
               "scale": [(0.9, 0.3, 0.9), (0.9, 0.3, 0.9), (1, 1, 1), (1.08, 1.3, 1.08), (1.05, 1.2, 1.05)]}]
        for n, x, z, ph in bubbles:
            t0 = 0.3 + ph * 0.6
            tr.append({"node": n, "times": [0, t0, t0 + 0.6], "translation": [(x, -0.4, z), (x, -0.4, z), (x, 0.3, z)],
                       "scale": [(0, 0, 0), (1, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        return [{"node": mug, "times": [0, 0.5, 1.0], "rotation": [qz(-3), qz(3), qz(-3)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.3, badge_pos=(0, 0.12, 0.6), badge_size=0.8)


# ============================================================
# ケーキ — ろうそくに火がともる
# ============================================================
def build_cake(cat, key, label):
    b = G.Builder()
    m_cream = K.col(b, "cream", (252, 248, 240), rough=0.5)
    m_sponge = K.col(b, "sponge", (240, 200, 120), rough=0.7)
    m_straw = K.col(b, "strawberry", (230, 30, 50), rough=0.3)
    m_leaf = K.col(b, "leaf", (60, 160, 70), rough=0.5)
    m_candle = K.texmat(b, "candle", tex.stripes((64, 128), (240, 90, 120), (250, 250, 250), pitch=24), rough=0.5)
    m_flame = glow_mat(b, "flame", (255, 200, 80), 64, 1.2)
    m_plate = K.col(b, "plate", (230, 236, 244), rough=0.2, metal=0.2)
    cake = K.transform(G.cylinder(0.6, 0.42, 48), t=(0, -0.2, 0))
    layer = K.transform(G.cylinder(0.605, 0.05, 48, caps=False), t=(0, -0.2, 0))
    swirls = [K.transform(G.sphere(0.07, 12, 8), s=(1, 0.8, 1), t=(math.cos(a) * 0.5, 0.05, math.sin(a) * 0.5)) for a in [k * K.TAU / 12 for k in range(12)]]
    berries, leaves = [], []
    for k in range(6):
        a = k * K.TAU / 6 + 0.26
        x, z = math.cos(a) * 0.5, math.sin(a) * 0.5
        berries.append(K.transform(G.cylinder(0.002, 0.12, 12, r_top=0.06), t=(x, 0.17, z), r=qx(180)))
        berries.append(K.transform(G.sphere(0.06, 12, 8), t=(x, 0.23, z)))
        leaves.append(K.transform(G.cylinder(0.045, 0.02, 8), t=(x, 0.29, z)))
    plate = K.transform(G.cylinder(0.78, 0.04, 48), t=(0, -0.43, 0))
    cake_mesh = b.add_mesh([G.prim(K.merge(cake, *swirls), m_cream), G.prim(layer, m_sponge), G.prim(K.merge(*berries), m_straw),
                            G.prim(K.merge(*leaves), m_leaf), G.prim(plate, m_plate)], "cake")
    cakeN = b.add_node("cake", mesh=cake_mesh)
    candle_mesh = b.add_mesh([G.prim(K.transform(G.cylinder(0.025, 0.3, 12), t=(0, 0.15, 0)), m_candle)], "candle")
    flame_mesh = b.add_mesh([G.prim(G.plane(0.14, 0.22), m_flame)], "flame")
    candles, flames = [], []
    for k in range(5):
        a = k * K.TAU / 5 + 0.3
        x, z = math.cos(a) * 0.24, math.sin(a) * 0.24
        candles.append(b.add_node("candle_%d" % k, mesh=candle_mesh, t=(x, 0.01, z)))
        flames.append(b.add_node("flame_%d" % k, mesh=flame_mesh, t=(x, 0.38, z), s=(0, 0, 0)))
    group = b.add_node("group", children=[cakeN] + candles + flames, t=(0, -0.1, 0), r=qx(26))

    def action(root):
        tr = []
        for k, n in enumerate(flames):
            t0 = 0.2 + k * 0.15
            tr.append({"node": n, "times": [0, t0, t0 + 0.12, t0 + 0.2, t0 + 0.3, 1.6],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.3, 1.3, 1), (0.9, 1.1, 1), (1, 1, 1), (1, 1, 1)]})
        return tr

    def idle(root):
        return [{"node": cakeN, "times": [0, 1.0, 2.0], "rotation": [qy(0), qy(10), qy(0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.1, badge_pos=(0, 0.62, 0.35), badge_size=0.8)


# ============================================================
# ピザ — 箱が開いて、チーズがのびる
# ============================================================
def tex_pizza(size=512):
    img = tex.rgrad((size, size), (250, 210, 110), (230, 150, 60), cy=0.5, r=0.55)
    d = ImageDraw.Draw(img)
    c = size / 2
    d.ellipse([4, 4, size - 4, size - 4], outline=(200, 120, 50), width=30)
    rnd = random.Random(216)
    for i in range(12):
        a, r = rnd.uniform(0, K.TAU), rnd.uniform(0.1, 0.36) * size
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        d.ellipse([x - 30, y - 30, x + 30, y + 30], fill=(190, 40, 40))
    for i in range(18):
        a, r = rnd.uniform(0, K.TAU), rnd.uniform(0.05, 0.38) * size
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(40, 120, 50))
    return img


def tex_pizza_box():
    img = tex.grain(Image.new("RGB", (512, 512), (200, 160, 110)), 8, 217)
    d = ImageDraw.Draw(img)
    d.ellipse([140, 140, 372, 372], outline=(170, 40, 40), width=12)
    tex.draw_text(img, "PIZZA", (170, 210, 342, 302), fill=(170, 40, 40), shadow=False)
    return img


def build_pizza(cat, key, label):
    b = G.Builder()
    m_pizza = K.texmat(b, "pizza", tex_pizza(), rough=0.6)
    m_box = K.col(b, "box_card", (200, 160, 110), rough=0.8)
    m_lid = K.texmat(b, "box_lid", tex_pizza_box(), rough=0.8)
    m_cheese = K.col(b, "cheese", (252, 220, 110), rough=0.5)
    S = 1.2
    base = K.merge(K.transform(G.box(S, 0.02, S), t=(0, -0.08, 0)),
                   K.transform(G.box(S, 0.1, 0.02), t=(0, -0.04, S / 2)), K.transform(G.box(S, 0.1, 0.02), t=(0, -0.04, -S / 2)),
                   K.transform(G.box(0.02, 0.1, S), t=(S / 2, -0.04, 0)), K.transform(G.box(0.02, 0.1, S), t=(-S / 2, -0.04, 0)))
    base_mesh = b.add_mesh([G.prim(base, m_box)], "box_base")
    baseN = b.add_node("box_base", mesh=base_mesh)
    R = 0.52
    rest_pts = [(0, 0)] + [(math.cos(deg(a)) * R, math.sin(deg(a)) * R) for a in range(60, 361, 10)]
    uvb = (-R, -R, R, R)
    rest = K.transform(K.extrude(rest_pts, 0.04, uv_box=uvb), r=qx(-90), t=(0, -0.05, 0))
    slice_pts = [(0, 0)] + [(math.cos(deg(a)) * R, math.sin(deg(a)) * R) for a in range(0, 61, 10)]
    slc = K.transform(K.extrude(slice_pts, 0.04, uv_box=uvb), r=qx(-90))
    pizza_mesh = b.add_mesh([G.prim(rest, m_pizza)], "pizza")
    pizzaN = b.add_node("pizza", mesh=pizza_mesh)
    slice_mesh = b.add_mesh([G.prim(slc, m_pizza)], "slice")
    sliceN = b.add_node("slice", mesh=slice_mesh, t=(0, -0.05, 0))
    cheese_mesh = b.add_mesh([G.prim(K.merge(*[K.transform(G.cylinder(0.012, 1.0, 6), t=(dx, 0.5, 0)) for dx in (-0.03, 0.0, 0.03)]), m_cheese)], "cheese")
    cheese = b.add_node("cheese", mesh=cheese_mesh, t=(0.24, -0.04, -0.14), s=(1, 0, 1))
    lid = K.merge(K.transform(G.box(S, 0.02, S), t=(0, 0, S / 2)), K.transform(G.box(S, 0.1, 0.02), t=(0, -0.04, S)))
    lid_top = K.transform(G.plane(S, S), r=qx(-90), t=(0, 0.011, S / 2))
    lid_mesh = b.add_mesh([G.prim(lid, m_box), G.prim(lid_top, m_lid)], "lid")
    lidN = b.add_node("lid", mesh=lid_mesh)
    hinge = b.add_node("hinge", children=[lidN], t=(0, 0.02, -S / 2))
    group = b.add_node("group", children=[baseN, pizzaN, sliceN, cheese, hinge], t=(0, -0.2, 0), r=qx(38))

    def action(root):
        return [{"node": hinge, "times": [0, 0.2, 0.6, 0.7], "rotation": [qx(0), qx(0), qx(-110), qx(-100)]},
                {"node": sliceN, "times": [0, 0.7, 1.1, 1.2], "translation": [(0, -0.05, 0), (0, -0.05, 0), (0.1, 0.4, 0.15), (0.1, 0.38, 0.15)],
                 "rotation": [qx(0), qx(0), qx(30), qx(28)]},
                {"node": cheese, "times": [0, 0.7, 1.1, 1.2], "scale": [(1, 0, 1), (1, 0, 1), (1, 0.42, 1), (1, 0.4, 1)]}]

    def idle(root):
        return [{"node": hinge, "times": [0, 0.3, 0.5, 1.2], "rotation": [qx(0), qx(-12), qx(0), qx(0)]}]

    return K.finish(b, [group], label, action, idle, badge_at=1.15, badge_pos=(0, 0.5, 0.4), badge_size=0.8)


BUILDERS = {
    "kusudama": build_kusudama,
    "bingo": build_bingo,
    "striker": build_striker,
    "soccer": build_soccer,
    "basketball": build_basketball,
    "crystal": build_crystal,
    "giftbox": build_giftbox,
    "suikawari": build_suikawari,
    "snowman": build_snowman,
    "tako": build_tako,
    "koinobori": build_koinobori,
    "tsukimi": build_tsukimi,
    "furin": build_furin,
    "jubako": build_jubako,
    "ramen": build_ramen,
    "coffee": build_coffee,
    "toaster": build_toaster,
    "beer": build_beer,
    "cake": build_cake,
    "pizza": build_pizza,
}
