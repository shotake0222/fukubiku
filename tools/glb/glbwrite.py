# -*- coding: utf-8 -*-
"""最小限のGLB(バイナリglTF)ライター。
#
# 既存テンプレートの.glbは12〜3,112ポリゴンで、実体は板・箱・円柱に
# テクスチャを貼っただけの単純な構成だった。同じ水準のものを
# プログラムで組み立てられるようにするための道具。
#
# 対応しているもの:
#   ・メッシュ(位置/法線/UV/インデックス)
#   ・PBRマテリアル(baseColor, metallic, roughness, 半透明, 両面)
#   ・PNGテクスチャの埋め込み
#   ・ノード階層(位置/回転/拡大)
#   ・アニメーション(位置・回転・拡大のキーフレーム)
"""
import json, math, struct


def _pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


class Builder:
    def __init__(self):
        self.bin = bytearray()
        self.bufferViews = []
        self.accessors = []
        self.meshes = []
        self.nodes = []
        self.materials = []
        self.images = []
        self.textures = []
        self.samplers = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
        self.animations = []

    # ---------- バッファ ----------
    def _view(self, data, target=None):
        if len(self.bin) % 4:
            self.bin += b"\x00" * (4 - len(self.bin) % 4)
        off = len(self.bin)
        self.bin += data
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        self.bufferViews.append(v)
        return len(self.bufferViews) - 1

    def _acc_f32(self, values, ncomp, target=None):
        flat = []
        for v in values:
            flat.extend(v if hasattr(v, "__len__") else [v])
        data = struct.pack("<%df" % len(flat), *flat)
        bv = self._view(data, target)
        cols = list(zip(*values)) if ncomp > 1 else [list(values)]
        self.accessors.append({
            "bufferView": bv, "componentType": 5126, "count": len(values),
            "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[ncomp],
            "min": [min(c) for c in cols], "max": [max(c) for c in cols],
        })
        return len(self.accessors) - 1

    def _acc_u16(self, values, target=34963):
        data = struct.pack("<%dH" % len(values), *values)
        bv = self._view(data, target)
        self.accessors.append({
            "bufferView": bv, "componentType": 5123, "count": len(values), "type": "SCALAR",
            "min": [min(values)], "max": [max(values)],
        })
        return len(self.accessors) - 1

    # ---------- 見た目 ----------
    def add_texture(self, png_bytes, name="tex"):
        bv = self._view(png_bytes)
        self.images.append({"name": name, "mimeType": "image/png", "bufferView": bv})
        self.textures.append({"sampler": 0, "source": len(self.images) - 1})
        return len(self.textures) - 1

    def add_material(self, name, color=(1, 1, 1, 1), texture=None, roughness=0.6,
                     metallic=0.0, alpha_mode="OPAQUE", double_sided=True, emissive=None):
        pbr = {"baseColorFactor": list(color), "metallicFactor": metallic, "roughnessFactor": roughness}
        if texture is not None:
            pbr["baseColorTexture"] = {"index": texture}
        m = {"name": name, "pbrMetallicRoughness": pbr, "doubleSided": double_sided}
        if alpha_mode != "OPAQUE":
            m["alphaMode"] = alpha_mode
            if alpha_mode == "MASK":
                m["alphaCutoff"] = 0.5
        if emissive:
            m["emissiveFactor"] = list(emissive)
        self.materials.append(m)
        return len(self.materials) - 1

    # ---------- 形 ----------
    def add_mesh(self, prims, name="mesh"):
        """prims: [{positions, normals, uvs, indices, material}]"""
        out = []
        for p in prims:
            attrs = {
                "POSITION": self._acc_f32(p["positions"], 3, 34962),
                "NORMAL": self._acc_f32(p["normals"], 3, 34962),
            }
            if p.get("uvs"):
                attrs["TEXCOORD_0"] = self._acc_f32(p["uvs"], 2, 34962)
            out.append({"attributes": attrs, "indices": self._acc_u16(p["indices"]),
                        "material": p["material"]})
        self.meshes.append({"name": name, "primitives": out})
        return len(self.meshes) - 1

    def add_node(self, name, mesh=None, t=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1), children=None):
        n = {"name": name, "translation": list(t), "rotation": list(r), "scale": list(s)}
        if mesh is not None:
            n["mesh"] = mesh
        if children:
            n["children"] = list(children)
        self.nodes.append(n)
        return len(self.nodes) - 1

    # ---------- 動き ----------
    def animate(self, tracks, name="anim"):
        """tracks: [{node, times, translation|rotation|scale: [...]}]"""
        samplers, channels = [], []
        for tr in tracks:
            tin = self._acc_f32([(t,) for t in tr["times"]], 1)
            for path in ("translation", "rotation", "scale"):
                if path not in tr:
                    continue
                vals = tr[path]
                tout = self._acc_f32(vals, 4 if path == "rotation" else 3)
                samplers.append({"input": tin, "output": tout,
                                 "interpolation": tr.get("interpolation", "LINEAR")})
                channels.append({"sampler": len(samplers) - 1,
                                 "target": {"node": tr["node"], "path": path}})
        self.animations.append({"name": name, "samplers": samplers, "channels": channels})

    # ---------- 出力 ----------
    def save(self, path, roots):
        js = {
            "asset": {"version": "2.0", "generator": "fukubiku template builder"},
            "scene": 0, "scenes": [{"nodes": list(roots)}],
            "nodes": self.nodes, "meshes": self.meshes, "materials": self.materials,
            "accessors": self.accessors, "bufferViews": self.bufferViews,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        if self.images:
            js["images"] = self.images
            js["textures"] = self.textures
            js["samplers"] = self.samplers
        if self.animations:
            js["animations"] = self.animations
        jb = _pad4(json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), b" ")
        bb = _pad4(bytes(self.bin))
        out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(jb) + 8 + len(bb))
        out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
        out += struct.pack("<II", len(bb), 0x004E4942) + bb
        open(path, "wb").write(out)
        return len(out)


# ================= 基本形状 =================
# すべて中心が原点。UVは0〜1で1面に1枚のテクスチャが貼れるようにする。

def plane(w=1.0, h=1.0, flip_uv_y=False):
    hw, hh = w / 2, h / 2
    pos = [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)]
    nrm = [(0, 0, 1)] * 4
    uv = [(0, 1), (1, 1), (1, 0), (0, 0)] if not flip_uv_y else [(0, 0), (1, 0), (1, 1), (0, 1)]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=[0, 1, 2, 0, 2, 3])


def box(w=1.0, h=1.0, d=1.0):
    hw, hh, hd = w / 2, h / 2, d / 2
    faces = [
        ((0, 0, 1), [(-hw, -hh, hd), (hw, -hh, hd), (hw, hh, hd), (-hw, hh, hd)]),
        ((0, 0, -1), [(hw, -hh, -hd), (-hw, -hh, -hd), (-hw, hh, -hd), (hw, hh, -hd)]),
        ((1, 0, 0), [(hw, -hh, hd), (hw, -hh, -hd), (hw, hh, -hd), (hw, hh, hd)]),
        ((-1, 0, 0), [(-hw, -hh, -hd), (-hw, -hh, hd), (-hw, hh, hd), (-hw, hh, -hd)]),
        ((0, 1, 0), [(-hw, hh, hd), (hw, hh, hd), (hw, hh, -hd), (-hw, hh, -hd)]),
        ((0, -1, 0), [(-hw, -hh, -hd), (hw, -hh, -hd), (hw, -hh, hd), (-hw, -hh, hd)]),
    ]
    pos, nrm, uv, idx = [], [], [], []
    for n, quad in faces:
        b = len(pos)
        pos += quad
        nrm += [n] * 4
        uv += [(0, 1), (1, 1), (1, 0), (0, 0)]
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def cylinder(r=0.5, h=1.0, seg=24, caps=True, r_top=None):
    r_top = r if r_top is None else r_top
    pos, nrm, uv, idx = [], [], [], []
    for i in range(seg + 1):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        pos += [(r * c, -h / 2, r * s), (r_top * c, h / 2, r_top * s)]
        nrm += [(c, 0, s), (c, 0, s)]
        u = i / seg
        uv += [(u, 1), (u, 0)]
    for i in range(seg):
        b = i * 2
        idx += [b, b + 2, b + 3, b, b + 3, b + 1]
    if caps:
        for sign, rr, ny in ((1, r_top, 1), (-1, r, -1)):
            cb = len(pos)
            pos.append((0, sign * h / 2, 0)); nrm.append((0, ny, 0)); uv.append((0.5, 0.5))
            for i in range(seg + 1):
                a = 2 * math.pi * i / seg
                pos.append((rr * math.cos(a), sign * h / 2, rr * math.sin(a)))
                nrm.append((0, ny, 0))
                uv.append((0.5 + 0.5 * math.cos(a), 0.5 + 0.5 * math.sin(a)))
            for i in range(seg):
                if sign > 0:
                    idx += [cb, cb + 1 + i, cb + 2 + i]
                else:
                    idx += [cb, cb + 2 + i, cb + 1 + i]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def disc(r=0.5, seg=24):
    pos = [(0, 0, 0)]
    nrm = [(0, 0, 1)]
    uv = [(0.5, 0.5)]
    idx = []
    for i in range(seg + 1):
        a = 2 * math.pi * i / seg
        pos.append((r * math.cos(a), r * math.sin(a), 0))
        nrm.append((0, 0, 1))
        uv.append((0.5 + 0.5 * math.cos(a), 0.5 - 0.5 * math.sin(a)))
    for i in range(seg):
        idx += [0, i + 1, i + 2]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def torus(r=0.5, tube=0.12, seg=20, tseg=10):
    pos, nrm, uv, idx = [], [], [], []
    for i in range(seg + 1):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        for j in range(tseg + 1):
            b = 2 * math.pi * j / tseg
            cb, sb = math.cos(b), math.sin(b)
            pos.append(((r + tube * cb) * ca, tube * sb, (r + tube * cb) * sa))
            nrm.append((cb * ca, sb, cb * sa))
            uv.append((i / seg, j / tseg))
    row = tseg + 1
    for i in range(seg):
        for j in range(tseg):
            a0 = i * row + j
            idx += [a0, a0 + row, a0 + row + 1, a0, a0 + row + 1, a0 + 1]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def tri(w=1.0, h=1.0, base_y=None):
    """頂点が上の二等辺三角形。base_yを指定すると底辺のY座標を固定できる
    (底辺を軸に開く動きを作るときに使う)。"""
    hw = w / 2
    y0 = -h / 2 if base_y is None else base_y
    y1 = y0 + h
    pos = [(-hw, y0, 0), (hw, y0, 0), (0.0, y1, 0)]
    return dict(positions=pos, normals=[(0, 0, 1)] * 3,
                uvs=[(0, 1), (1, 1), (0.5, 0)], indices=[0, 1, 2])


def poly(points, uv_box=None):
    """凸多角形(XY平面、+Z向き)。pointsは反時計回り。
    UVはuv_box=(minx,miny,maxx,maxy)の矩形に正規化して貼る。"""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0, y0, x1, y1 = uv_box or (min(xs), min(ys), max(xs), max(ys))
    w = (x1 - x0) or 1.0
    h = (y1 - y0) or 1.0
    pos = [(p[0], p[1], 0.0) for p in points]
    uvs = [((p[0] - x0) / w, 1.0 - (p[1] - y0) / h) for p in points]
    idx = []
    for i in range(1, len(points) - 1):
        idx += [0, i, i + 1]
    return dict(positions=pos, normals=[(0, 0, 1)] * len(points), uvs=uvs, indices=idx)


def semicircle(r=0.5, seg=18, side=1, uv_box=None):
    """半円(side=1で右半分、-1で左半分)。中心が原点。"""
    pts = [(0.0, -r)]
    for i in range(seg + 1):
        a = -math.pi / 2 + math.pi * i / seg
        pts.append((side * r * math.cos(a), r * math.sin(a)))
    if side < 0:
        pts = [pts[0]] + list(reversed(pts[1:]))
    return poly(pts, uv_box or (-r, -r, r, r))


def ring(r_out=0.5, r_in=0.35, seg=32):
    """平らなドーナツ(+Z向き)。"""
    pos, nrm, uv, idx = [], [], [], []
    for i in range(seg + 1):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        pos += [(r_out * c, r_out * s, 0), (r_in * c, r_in * s, 0)]
        nrm += [(0, 0, 1), (0, 0, 1)]
        uv += [(0.5 + 0.5 * c, 0.5 - 0.5 * s), (0.5 + 0.35 * c, 0.5 - 0.35 * s)]
    for i in range(seg):
        b = i * 2
        idx += [b, b + 2, b + 3, b, b + 3, b + 1]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def sphere(r=0.5, seg=16, rings=10):
    pos, nrm, uv, idx = [], [], [], []
    for j in range(rings + 1):
        v = j / rings
        phi = v * math.pi
        for i in range(seg + 1):
            u = i / seg
            th = u * 2 * math.pi
            x = math.sin(phi) * math.cos(th)
            y = math.cos(phi)
            z = math.sin(phi) * math.sin(th)
            pos.append((r * x, r * y, r * z))
            nrm.append((x, y, z))
            uv.append((u, v))
    row = seg + 1
    for j in range(rings):
        for i in range(seg):
            a = j * row + i
            idx += [a, a + row, a + row + 1, a, a + row + 1, a + 1]
    return dict(positions=pos, normals=nrm, uvs=uv, indices=idx)


def rot_x(geo, ang):
    c, s = math.cos(ang), math.sin(ang)
    d = dict(geo)
    d["positions"] = [(p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c) for p in geo["positions"]]
    d["normals"] = [(n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c) for n in geo["normals"]]
    return d


def back(geo):
    """面の向きを反転して裏面用にする(法線・巻き順・UVを反転)。
    同じ位置に表裏2枚を重ねるとZファイティングするので、
    呼び出し側でわずかに前後にずらして使うこと。"""
    d = dict(geo)
    d["normals"] = [(-n[0], -n[1], -n[2]) for n in geo["normals"]]
    idx = list(geo["indices"])
    d["indices"] = [idx[i + j] for i in range(0, len(idx), 3) for j in (0, 2, 1)]
    d["uvs"] = [(1 - u, v) for (u, v) in geo["uvs"]]
    return d


def offset(geo, dx=0.0, dy=0.0, dz=0.0):
    d = dict(geo)
    d["positions"] = [(p[0] + dx, p[1] + dy, p[2] + dz) for p in geo["positions"]]
    return d


def prim(geo, material):
    d = dict(geo)
    d["material"] = material
    return d


def quat_axis(axis, angle):
    x, y, z = axis
    n = math.sqrt(x * x + y * y + z * z) or 1
    x, y, z = x / n, y / n, z / n
    s = math.sin(angle / 2)
    return (x * s, y * s, z * s, math.cos(angle / 2))
