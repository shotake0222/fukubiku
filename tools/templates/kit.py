# -*- coding: utf-8 -*-
"""テンプレート作成用の道具箱(形・動き・結果バッジ)。
#
# glbwrite.py の基本形状(板・箱・円柱・球…)だけでは、角の丸い箱や
# 回転体(だるま・瓶・提灯)、くり抜いた形(手裏剣・星)が作れず、
# どうしても「箱と板を並べただけ」の粗い見た目になっていた。
# ここでは次を足す:
#   ・transform / merge     : 形を回転・拡大・移動し、1つにまとめる
#   ・lathe                 : 輪郭を回して作る回転体(なめらかな法線付き)
#   ・rounded_box           : 角を丸めた箱
#   ・extrude               : 2Dの輪郭(凹形も可)に厚みを付けた板
#   ・tube                  : 折れ線に沿った管(縄・龍の胴・持ち手)
#   ・finish                : 結果バッジを付け、演出(結果)/焦らし(ループ)を組み立てる
#
# 向きの約束は build.py と同じ: 正面が+Z、上が+Y。
"""
import math
import glbwrite as G
import tex

TAU = math.pi * 2


def deg(d):
    return d * math.pi / 180.0


# ------------------------------------------------------------
# 回転(クォータニオン)
# ------------------------------------------------------------
def qx(d):
    return G.quat_axis((1, 0, 0), deg(d))


def qy(d):
    return G.quat_axis((0, 1, 0), deg(d))


def qz(d):
    return G.quat_axis((0, 0, 1), deg(d))


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def spin_keys(axis, turns, n_per_turn=4, start=0.0):
    """何回転もさせるための回転キー列(1回のキーで180°を超えないよう刻む)。"""
    n = max(1, int(round(abs(turns) * n_per_turn)))
    return [G.quat_axis(axis, deg(start) + TAU * turns * i / n) for i in range(n + 1)]


def _rotmat(q):
    x, y, z, w = q
    return ((1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)),
            (2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)),
            (2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)))


def _apply(m, v):
    return (m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2])


def _norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


# ------------------------------------------------------------
# 形の操作
# ------------------------------------------------------------
def transform(geo, t=(0, 0, 0), r=None, s=(1, 1, 1)):
    """拡大(s) → 回転(r, クォータニオン) → 移動(t) の順に適用する。"""
    if isinstance(s, (int, float)):
        s = (s, s, s)
    m = _rotmat(r) if r else None
    pos, nrm = [], []
    for p in geo["positions"]:
        q = (p[0] * s[0], p[1] * s[1], p[2] * s[2])
        if m:
            q = _apply(m, q)
        pos.append((q[0] + t[0], q[1] + t[1], q[2] + t[2]))
    inv = (1.0 / (s[0] or 1e-9), 1.0 / (s[1] or 1e-9), 1.0 / (s[2] or 1e-9))
    for n in geo["normals"]:
        q = (n[0] * inv[0], n[1] * inv[1], n[2] * inv[2])
        if m:
            q = _apply(m, q)
        nrm.append(_norm(q))
    d = dict(geo)
    d["positions"], d["normals"] = pos, nrm
    return d


def merge(*geos):
    pos, nrm, uv, idx = [], [], [], []
    for g in geos:
        base = len(pos)
        pos += list(g["positions"])
        nrm += list(g["normals"])
        uv += list(g.get("uvs") or [(0, 0)] * len(g["positions"]))
        idx += [i + base for i in g["indices"]]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def flip(geo):
    """裏返す(法線と巻き順を反転)。内側から見える面に使う。"""
    return G.back(geo)


# ------------------------------------------------------------
# 回転体
# ------------------------------------------------------------
def lathe(profile, seg=48, u_scale=1.0, cap_top=False, cap_bottom=False):
    """profile: 下から上へ [(半径, 高さ), ...]。Y軸まわりに回して作る。

    法線は輪郭の隣り合う点から求めるので、なめらかな曲面になる。
    UVの縦は輪郭の長さに沿って0→1(上端が0)。
    """
    n = len(profile)
    # 輪郭の長さ(UV用)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.hypot(profile[i][0] - profile[i - 1][0],
                                        profile[i][1] - profile[i - 1][1]))
    total = acc[-1] or 1.0
    # 輪郭上の法線(2D)
    nrm2 = []
    for i in range(n):
        a = profile[max(0, i - 1)]
        b = profile[min(n - 1, i + 1)]
        dr, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dr, dy) or 1.0
        nrm2.append((dy / l, -dr / l))
    pos, nrm, uv, idx = [], [], [], []
    for j in range(seg + 1):
        a = TAU * j / seg
        c, s = math.cos(a), math.sin(a)
        for i in range(n):
            r, y = profile[i]
            nr, ny = nrm2[i]
            pos.append((r * c, y, -r * s))
            nrm.append(_norm((nr * c, ny, -nr * s)))
            uv.append((u_scale * j / seg, 1.0 - acc[i] / total))
    for j in range(seg):
        for i in range(n - 1):
            a0 = j * n + i
            b0 = (j + 1) * n + i
            idx += [a0, b0, b0 + 1, a0, b0 + 1, a0 + 1]
    geo = dict(positions=pos, normals=nrm, uvs=uv, indices=idx)
    parts = [geo]
    if cap_top and profile[-1][0] > 1e-6:
        parts.append(transform(G.disc(profile[-1][0], seg), t=(0, profile[-1][1], 0), r=qx(-90)))
    if cap_bottom and profile[0][0] > 1e-6:
        parts.append(transform(G.disc(profile[0][0], seg), t=(0, profile[0][1], 0), r=qx(90)))
    return merge(*parts) if len(parts) > 1 else geo


def smooth_profile(points, steps=6):
    """折れ線の輪郭を Catmull-Rom でなめらかにする(回転体の輪郭用)。"""
    out = []
    n = len(points)
    for i in range(n - 1):
        p0 = points[max(0, i - 1)]
        p1 = points[i]
        p2 = points[i + 1]
        p3 = points[min(n - 1, i + 2)]
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t +
                                    (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
                                    (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)
                             for c in range(2)))
    out.append(points[-1])
    return [(max(0.0, r), y) for r, y in out]


# ------------------------------------------------------------
# 角の丸い箱
# ------------------------------------------------------------
def rounded_box(w, h, d, r=0.06, n=6, face_uv=True):
    """角と辺を半径rで丸めた箱。各面に0〜1のUVを1枚ずつ貼る。"""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
    hw, hh, hd = w / 2, h / 2, d / 2
    iw, ih, idd = hw - r, hh - r, hd - r
    faces = [
        ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
        ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
        ((1, 0, 0), (0, 0, -1), (0, 1, 0)),
        ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
        ((0, 1, 0), (1, 0, 0), (0, 0, -1)),
        ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    ]
    size = (hw, hh, hd)
    grid = 2 * n + 1
    pos, nrm, uv, idx = [], [], [], []
    for (N, U, V) in faces:
        ext_u = abs(U[0]) * hw + abs(U[1]) * hh + abs(U[2]) * hd
        ext_v = abs(V[0]) * hw + abs(V[1]) * hh + abs(V[2]) * hd
        base = len(pos)
        for j in range(grid + 1):
            for i in range(grid + 1):
                # 面上の点(外形)
                fu = -1 + 2 * i / grid
                fv = -1 + 2 * j / grid
                # 丸め領域へ偏らせた分割(角付近を細かく)
                def warp(f):
                    return math.copysign(abs(f) ** 1.0, f)
                pu, pv = warp(fu) * ext_u, warp(fv) * ext_v
                p = [N[k] * size[k] * abs(N[k]) + U[k] * pu + V[k] * pv for k in range(3)]
                # 内側の箱へクランプして、はみ出しを半径rの球面に置き換える
                inner = (max(-iw, min(iw, p[0])), max(-ih, min(ih, p[1])), max(-idd, min(idd, p[2])))
                dv = (p[0] - inner[0], p[1] - inner[1], p[2] - inner[2])
                nv = _norm(dv) if (abs(dv[0]) + abs(dv[1]) + abs(dv[2])) > 1e-9 else N
                q = (inner[0] + nv[0] * r, inner[1] + nv[1] * r, inner[2] + nv[2] * r)
                pos.append(q)
                nrm.append(nv)
                uv.append((i / grid, 1 - j / grid) if face_uv else (0, 0))
        row = grid + 1
        for j in range(grid):
            for i in range(grid):
                a0 = base + j * row + i
                idx += [a0, a0 + 1, a0 + row + 1, a0, a0 + row + 1, a0 + row]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


# ------------------------------------------------------------
# 輪郭に厚みを付ける(凹形にも対応)
# ------------------------------------------------------------
def _area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        a += x0 * y1 - x1 * y0
    return a / 2


def triangulate(pts):
    """耳切り法。ptsは反時計回りの単純多角形。三角形の添字列を返す。"""
    idx = list(range(len(pts)))
    out = []

    def is_convex(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 1e-12

    def inside(p, a, b, c):
        d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])
        d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1])
        d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1])
        neg = d1 < 0 or d2 < 0 or d3 < 0
        pos = d1 > 0 or d2 > 0 or d3 > 0
        return not (neg and pos)

    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        found = False
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pts[i0], pts[i1], pts[i2]
            if not is_convex(a, b, c):
                continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            out += [i0, i1, i2]
            idx.pop(k)
            found = True
            break
        if not found:
            break
    if len(idx) == 3:
        out += idx
    return out


def extrude(points, depth=0.1, uv_box=None, side_uv=False):
    """XY平面の輪郭(反時計回り推奨)に、Zの厚みdepthを付ける。中心はz=0。"""
    pts = list(points)
    if _area(pts) < 0:
        pts.reverse()
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0, x1, y1 = uv_box or (min(xs), min(ys), max(xs), max(ys))
    w = (x1 - x0) or 1.0
    h = (y1 - y0) or 1.0
    tris = triangulate(pts)
    hz = depth / 2
    pos, nrm, uv, idx = [], [], [], []
    # 表
    for p in pts:
        pos.append((p[0], p[1], hz)); nrm.append((0, 0, 1))
        uv.append(((p[0] - x0) / w, 1 - (p[1] - y0) / h))
    idx += tris
    # 裏
    b = len(pos)
    for p in pts:
        pos.append((p[0], p[1], -hz)); nrm.append((0, 0, -1))
        uv.append((1 - (p[0] - x0) / w, 1 - (p[1] - y0) / h))
    for i in range(0, len(tris), 3):
        idx += [b + tris[i], b + tris[i + 2], b + tris[i + 1]]
    # 側面(角は立てる)
    n = len(pts)
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        e = (q[0] - p[0], q[1] - p[1])
        nn = _norm((e[1], -e[0], 0))
        b = len(pos)
        pos += [(p[0], p[1], -hz), (q[0], q[1], -hz), (q[0], q[1], hz), (p[0], p[1], hz)]
        nrm += [nn] * 4
        uv += [(0, 1), (1, 1), (1, 0), (0, 0)] if side_uv else [(0.02, 0.02)] * 4
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def star_points(n, r_out, r_in, rot=90.0):
    return [(math.cos(deg(rot) + math.pi * i / n) * (r_out if i % 2 == 0 else r_in),
             math.sin(deg(rot) + math.pi * i / n) * (r_out if i % 2 == 0 else r_in))
            for i in range(2 * n)]


def ngon(n, r, rot=90.0):
    return [(math.cos(deg(rot) + TAU * i / n) * r, math.sin(deg(rot) + TAU * i / n) * r) for i in range(n)]


def heart_points(size=1.0, n=64):
    pts = []
    for i in range(n):
        t = TAU * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 34.0 * size, y / 34.0 * size + 0.05 * size))
    return pts


def rounded_rect_points(w, h, r, n=8):
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0),
                       (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(n + 1):
            a = deg(a0 + 90.0 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ------------------------------------------------------------
# 管(折れ線に沿った円筒)
# ------------------------------------------------------------
def tube(path, radius=0.05, seg=16, radii=None, closed=False):
    """path: [(x,y,z), ...]。radii を渡すと点ごとに太さを変えられる(龍の胴など)。"""
    n = len(path)
    radii = radii or [radius] * n
    # 接線
    tang = []
    for i in range(n):
        a = path[max(0, i - 1)]
        b = path[min(n - 1, i + 1)]
        tang.append(_norm((b[0] - a[0], b[1] - a[1], b[2] - a[2])))
    # 平行移動フレーム
    t0 = tang[0]
    ref = (0, 1, 0) if abs(t0[1]) < 0.9 else (1, 0, 0)
    nrm0 = _norm(_cross(_cross(t0, ref), t0))
    frames = [nrm0]
    for i in range(1, n):
        prev = frames[-1]
        t = tang[i]
        dotp = prev[0] * t[0] + prev[1] * t[1] + prev[2] * t[2]
        nn = _norm((prev[0] - t[0] * dotp, prev[1] - t[1] * dotp, prev[2] - t[2] * dotp))
        frames.append(nn)
    pos, nrm, uv, idx = [], [], [], []
    for i in range(n):
        t = tang[i]
        nv = frames[i]
        bv = _cross(t, nv)
        for j in range(seg + 1):
            a = TAU * j / seg
            c, s = math.cos(a), math.sin(a)
            d = (nv[0] * c + bv[0] * s, nv[1] * c + bv[1] * s, nv[2] * c + bv[2] * s)
            r = radii[i]
            pos.append((path[i][0] + d[0] * r, path[i][1] + d[1] * r, path[i][2] + d[2] * r))
            nrm.append(d)
            uv.append((j / seg, i / max(1, n - 1)))
    row = seg + 1
    for i in range(n - 1):
        for j in range(seg):
            a0 = i * row + j
            idx += [a0, a0 + row, a0 + row + 1, a0, a0 + row + 1, a0 + 1]
    geo = dict(positions=pos, normals=nrm, uvs=uv, indices=idx)
    # 端をふさぐ(小さな半球)
    caps = []
    for end, sign in ((0, -1), (n - 1, 1)):
        if radii[end] > 1e-4:
            sph = G.sphere(radii[end], seg, max(6, seg // 2))
            caps.append(transform(sph, t=path[end]))
    return merge(geo, *caps) if caps else geo


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def bezier(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(tuple(u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]
                         for k in range(3)))
    return out


# ------------------------------------------------------------
# マテリアル・テクスチャの近道
# ------------------------------------------------------------
def col(b, name, rgb, rough=0.55, metal=0.0, alpha=1.0, emissive=None, blend=False):
    c = tuple(v / 255.0 if max(rgb) > 1.0 else v for v in rgb)
    return b.add_material(name, color=(c[0], c[1], c[2], alpha), roughness=rough, metallic=metal,
                          alpha_mode="BLEND" if (blend or alpha < 1.0) else "OPAQUE",
                          emissive=emissive)


def texmat(b, name, img, rough=0.6, metal=0.0, colors=128, alpha_mode="OPAQUE", emissive=None,
           emissive_texture=False):
    if colors:
        data = tex.to_png(img, colors)
    else:
        # 減色しない(半透明の光は減色すると縁に濁った色が出る)
        import io as _io
        buf = _io.BytesIO()
        img.save(buf, "PNG", optimize=True)
        data = buf.getvalue()
    t = b.add_texture(data, name)
    return b.add_material(name + "_mat", texture=t, roughness=rough, metallic=metal,
                          alpha_mode=alpha_mode, emissive=emissive, emissive_texture=emissive_texture)


def glow_image(rgb=(255, 214, 90), size=256, power=2.2):
    """中心から外へ柔らかく消える光(ビーム・炎・火花の芯に使う)。形のある輪郭は持たない。"""
    from PIL import Image
    # 透明な部分の色も光の色にしておく(黒のままだと減色やフィルタで縁が黒ずむ)
    img = Image.new("RGBA", (size, size), (rgb[0], rgb[1], rgb[2], 0))
    px = img.load()
    c = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / c
            if d < 1:
                a = int(255 * (1 - d) ** power)
                px[x, y] = (rgb[0], rgb[1], rgb[2], a)
    return img


# ------------------------------------------------------------
# 結果バッジと演出の組み立て
# ------------------------------------------------------------
def add_badge(b, label, size=0.8):
    if not label:
        return None
    t = b.add_texture(tex.badge_png(label), "badge_%s" % label)
    m = b.add_material("badge_%s" % label, texture=t, alpha_mode="BLEND", roughness=0.9,
                       emissive=(0.55, 0.55, 0.55), emissive_texture=True)
    return b.add_mesh([G.prim(G.plane(size, size), m)], "badge")


def finish(b, children, label, action=None, idle=None, badge_at=1.2, badge_pos=(0, 0.1, 0.45),
           badge_size=0.82, hold=None, root_t=(0, 0, 0)):
    """ノードをまとめ、結果(ラベル有り)か焦らし(ラベル無し)の動きを付けて返す。

    action(root): 結果用の動き。トラックのリストを返す関数。root のノード番号を受け取る。
    idle(root)  : 焦らし用のループの動き。
    badge_at    : バッジが飛び出す時刻(秒)。
    """
    tracks = []
    kids = list(children)
    badge = None
    if label:
        mesh = add_badge(b, label, badge_size)
        badge = b.add_node("badge", mesh=mesh, t=badge_pos, s=(0, 0, 0))
        kids.append(badge)
    root = b.add_node("root", t=root_t, children=kids)
    if label:
        if action:
            tracks += action(root)
        t0 = badge_at
        end = max(t0 + 1.0, hold or 0)
        bx, by, bz = badge_pos
        tracks.append({"node": badge, "times": [0.0, t0, t0 + 0.2, t0 + 0.36, t0 + 0.5, end],
                       "scale": [(0, 0, 0), (0, 0, 0), (1.22, 1.22, 1.22), (0.94, 0.94, 0.94),
                                 (1, 1, 1), (1, 1, 1)],
                       "translation": [(bx, by - 0.12, bz), (bx, by - 0.12, bz), (bx, by + 0.06, bz),
                                       (bx, by, bz), (bx, by, bz), (bx, by, bz)]})
    elif idle:
        tracks += idle(root)
    if tracks:
        b.animate(tracks, "reveal" if label else "suspense")
    return b, [root]


# よく使う焦らしの動き ------------------------------------------------
def idle_wobble(node, amp=6, period=1.4, bob=0.05, axis=(0, 0, 1)):
    ts = [0, period / 4, period / 2, period * 3 / 4, period]
    return [{"node": node, "times": ts,
             "rotation": [G.quat_axis(axis, deg(a)) for a in (0, amp, 0, -amp, 0)],
             "translation": [(0, 0, 0), (0, bob, 0), (0, 0, 0), (0, bob, 0), (0, 0, 0)]}]


def idle_bob(node, h=0.06, period=1.6, base=(0, 0, 0)):
    x, y, z = base
    return [{"node": node, "times": [0, period / 2, period],
             "translation": [(x, y, z), (x, y + h, z), (x, y, z)]}]


def idle_spin(node, axis=(0, 1, 0), period=2.4, turns=1):
    ks = spin_keys(axis, turns)
    n = len(ks) - 1
    return [{"node": node, "times": [period * i / n for i in range(n + 1)], "rotation": ks}]


def pop(node, t0, dur=0.3, to=1.0, base=(0, 0, 0)):
    """t0 に大きさ0から弾んで現れる。"""
    return {"node": node, "times": [0.0, t0, t0 + dur * 0.65, t0 + dur],
            "scale": [(0, 0, 0), (0, 0, 0), (to * 1.15,) * 3, (to,) * 3]}


def bump(node, t0, h=0.08, base=(0, 0, 0)):
    x, y, z = base
    return {"node": node, "times": [0.0, t0, t0 + 0.14, t0 + 0.34],
            "translation": [(x, y, z), (x, y, z), (x, y + h, z), (x, y, z)]}


def lathe_point(profile, u, v, push=0.0):
    """lathe() で作った面の上の点(u,v)の位置と法線。uは周方向0〜1、vは上端0→下端1。"""
    n = len(profile)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
    total = acc[-1] or 1.0
    target = (1.0 - v) * total
    i = 1
    while i < n - 1 and acc[i] < target:
        i += 1
    seg = (acc[i] - acc[i - 1]) or 1.0
    k = (target - acc[i - 1]) / seg
    r = profile[i - 1][0] + (profile[i][0] - profile[i - 1][0]) * k
    y = profile[i - 1][1] + (profile[i][1] - profile[i - 1][1]) * k
    dr = profile[i][0] - profile[i - 1][0]
    dy = profile[i][1] - profile[i - 1][1]
    l = math.hypot(dr, dy) or 1.0
    nr, ny = dy / l, -dr / l
    a = TAU * u
    c, s = math.cos(a), -math.sin(a)
    nrm = _norm((nr * c, ny, nr * s))
    pos = (r * c + nrm[0] * push, y + nrm[1] * push, r * s + nrm[2] * push)
    return pos, nrm


def look_quat(nrm):
    """+Z をこの法線方向へ向ける回転。"""
    z = (0.0, 0.0, 1.0)
    d = max(-1.0, min(1.0, nrm[0] * z[0] + nrm[1] * z[1] + nrm[2] * z[2]))
    if d > 0.9999:
        return (0.0, 0.0, 0.0, 1.0)
    if d < -0.9999:
        return qy(180)
    axis = _norm(_cross(z, nrm))
    return G.quat_axis(axis, math.acos(d))


def hemisphere(r, seg=24, rings=8, top=True):
    """半球(開口部が下=top / 上=bottom)。カプセルやドームに使う。"""
    prof = [(r * math.sin(math.pi / 2 * i / rings), r * math.cos(math.pi / 2 * i / rings)) for i in range(rings + 1)]
    prof = list(reversed(prof))  # 下(赤道)から上(極)へ
    g = lathe(prof, seg)
    if not top:
        g = transform(g, r=qx(180))
    return g


def lumpy(geo, amount=0.12, seed=1, freq=3.0):
    """球などの頂点を中心から押し引きして、岩や雲のようなでこぼこにする。
    同じ位置の頂点(継ぎ目)が割れないよう、位置から決まるノイズを使う。"""
    import random as _r
    rnd = _r.Random(seed)
    waves = [(rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0, TAU), rnd.uniform(0.6, 1.4))
             for _ in range(6)]

    def noise(p):
        v = 0.0
        for wx, wy, wz, ph, k in waves:
            v += math.sin((p[0] * wx + p[1] * wy + p[2] * wz) * freq * k + ph)
        return v / len(waves)
    pos, nrm = [], []
    for p, n in zip(geo["positions"], geo["normals"]):
        k = 1.0 + amount * noise(p)
        pos.append((p[0] * k, p[1] * k, p[2] * k))
        nrm.append(n)
    d = dict(geo)
    d["positions"], d["normals"] = pos, nrm
    return d


def streak_image(rgb=(255, 240, 200), w=256, h=64):
    """細長い光の筋(斬撃・ビーム・光線)。"""
    from PIL import Image
    img = Image.new("RGBA", (w, h), (rgb[0], rgb[1], rgb[2], 0))
    px = img.load()
    for y in range(h):
        dy = abs(y - (h - 1) / 2) / ((h - 1) / 2)
        for x in range(w):
            dx = abs(x - (w - 1) / 2) / ((w - 1) / 2)
            a = max(0.0, 1 - dy) ** 1.6 * max(0.0, 1 - dx ** 3)
            px[x, y] = (rgb[0], rgb[1], rgb[2], int(255 * a))
    return img
